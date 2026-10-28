// 诡镇奇谈 Mod · 调试控制台服务端解析层（契约：artifacts/debug-console/CONTRACT.md §4/§5/§10）。
//
// buildDebugCommand(session, seat, command) -> { move, message }
//   command = { text, targetSeat? }
//   - 纯同步、只读：不修改 session/state；
//   - 解析失败 / 不可执行统一 throw new Error(中文提示)，message 直接展示给玩家；
//   - 成功返回引擎的 action:'debug' 动作（由大厅 host-only 调试通道走 commitMove 事务提交）；
//   - 「帮助」「状态」返回 { move:null, message }，不提交、不改状态。
//
// 名称匹配顺序：精确 code > 精确名 > 前缀 > 包含；同级出现多个候选时先优先当前关卡/战役相关项，
// 仍不唯一则抛错并列出候选（带 code/id）。卡名/敌人名来自 cards-data、card-lookup 与 content 注册表，
// 地点名来自 state.locations；真正能不能执行由引擎的 validateMove（src/engine/debug.js）最终复核，
// 这里只负责解析与友好报错。

import { validateMove } from '../engine/engine.js'
import { ALL_ENEMIES, cardDef, cardName, enemyDef } from '../engine/card-lookup.js'
import { ALL_CARDS } from '../cards/cards-data.js'
import { contentRegistry } from '../../content/registered.js'

const HELP_TEXT = [
  '🛠️ 调试控制台 · 指令帮助',
  '',
  '【关卡】',
  '  跳到 <关卡>（跳关 / goto / jump / scenario）：序号 1 起、关卡 ID 或名称，例：跳到 2',
  '  重开本关（restart / 重新开始本关）：重新布置当前关卡',
  '',
  '【敌人】',
  '  生成 <敌人>（刷出 / spawn / addEnemy）：在目标调查员所在地点生成并交战',
  '  消灭 <敌人>（击杀 / 杀死 / kill / defeat）；消灭全部 / kill all 清空全场',
  '',
  '【卡牌 / 手牌】',
  '  发 <卡牌> 到手上（发卡 / 给卡 / give）：可写卡号或卡名；',
  '  也可发到牌库顶 / 牌库底 / 弃牌堆，例：发 01025 到牌库顶',
  '  抽 [N]（抽牌 / draw / 摸牌）：默认抽 1 张，例：抽 2',
  '  行动点 +N（actions / 行动 +N / 给 N 行动点），例：行动点 +1',
  '',
  '【资源 / 经验 / 线索】',
  '  给 <N> 经验（xp / 经验），例：给 3 经验',
  '  获得 <N> 资源（资源 / resources），例：获得 3 资源',
  '  获得 <N> 线索（线索 / clues），例：获得 3 线索',
  '',
  '【治疗 / 伤害 / 位置】',
  '  治疗 <N>（回复 <N>）：伤害与恐惧各恢复 N',
  '  治疗伤害 <N>（回复生命 / heal）、治疗恐惧 <N>（回复理智 / healhorror）',
  '  受到 <N> 伤害（受伤 <N> / take N damage）、受到 <N> 恐惧（受惊 <N> / take N horror）',
  '  传送到 <地点>（移动到 / 去 / teleport / travel）：按地点 ID 或名称匹配',
  '',
  '【场景 / 全局】',
  '  揭示全部（reveal all）、揭示 <地点>（reveal <地点>）',
  '  加毁灭 <N>（doom +N）、减毁灭 <N>（doom -N）',
  '  状态（info / status）：显示场景、轮次、调查员、敌人、线索与毁灭摘要',
  '',
  '帮助：帮助 / help / ? / 指令。目标座位由面板「目标调查员」下拉选择，缺省为自己。',
  '示例：跳到 2 · 生成 食尸鬼爪牙 · 抽 2 · 传送到 河岸城 · 治疗 2 · 受到 1 伤害 · 加毁灭 1',
].join('\n')

// 精确等于这些词 = 帮助；「帮助？」这类带问号的写法在匹配时先去掉问号再判定。
const HELP_ALIASES = new Set(['帮助', 'help', '?', '？', '指令', 'help?', '帮助?', '帮助？'])

// 指令别名表。顺序即匹配优先级：更长 / 更具体的别名在前（例如「给卡」先于「给」，「发卡」先于「发」，
// 「治疗伤害」先于「治疗」，「抽牌」先于「抽」）。
// kind 为 null 表示由剩余文本决定（「获得 3 资源」/「给 2 经验」/「给 1 行动点」这类通用动词）。
const COMMAND_GROUPS = [
  { aliases: ['跳到', '跳关', 'goto', 'jump', 'scenario'], kind: 'scenario' },
  { aliases: ['重开本关', '重新开始本关', 'restart'], kind: 'restart' },
  { aliases: ['生成', '刷出', 'spawn', 'addenemy'], kind: 'spawn' },
  { aliases: ['消灭', '击杀', '杀死', 'kill', 'defeat'], kind: 'defeat' },
  { aliases: ['发卡', '给卡', 'give', '发'], kind: 'card' },
  { aliases: ['抽牌', '摸牌', 'draw', '抽'], kind: 'draw' },
  { aliases: ['行动点', '行动', 'actions'], kind: 'actions' },
  { aliases: ['传送到', '移动到', 'teleport', 'travel', '去'], kind: 'moveTo' },
  { aliases: ['治疗伤害', '治疗恐惧', '治疗', '回复生命', '回复理智', '回复', 'healhorror', 'heal'], kind: 'heal' },
  { aliases: ['受伤', '受惊', '受到', 'take'], kind: 'harm' },
  { aliases: ['揭示全部', '揭示', 'reveal'], kind: 'reveal' },
  { aliases: ['加毁灭', '减毁灭', 'doom'], kind: 'doom' },
  { aliases: ['状态', 'info', 'status'], kind: 'status' },
  { aliases: ['获得', '给'], kind: null },
  { aliases: ['经验', 'xp'], kind: 'xp' },
  { aliases: ['资源', 'resources', 'resource'], kind: 'resources' },
  { aliases: ['线索', 'clues', 'clue'], kind: 'clues' },
]

// 输入清理：成对引号（「」『』“”‘’"" ''）去掉首尾、全角数字/空格归一、去掉句末标点。
const QUOTE_PAIRS = [['「', '」'], ['『', '』'], ['“', '”'], ['‘', '’'], ['"', '"'], ["'", "'"]]

const ALL_TARGET_WORDS = new Set(['全部', '所有', '全', '一切', 'all', 'everything', 'everyone', '*', '全场'])

const CARD_TYPES = new Set(['asset', 'event', 'skill'])

// 名称匹配层级：1 精确名、2 前缀、3 包含（精确 code 在调用方单独处理）。
const TIER_EXACT = 1
const TIER_PREFIX = 2
const TIER_CONTAINS = 3

function stripQuotes(value) {
  let text = String(value ?? '').trim()
  for (let i = 0; i < 4; i++) {
    if (text.length < 2) break
    const pair = QUOTE_PAIRS.find(([open, close]) => text.startsWith(open) && text.endsWith(close))
    if (!pair) break
    text = text.slice(pair[0].length, text.length - pair[1].length).trim()
  }
  return text
}

function normalizeText(raw) {
  if (typeof raw !== 'string') throw new Error('调试指令必须是文本。')
  let text = raw.replace(/\u3000/g, ' ').replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
  text = stripQuotes(text)
  text = text.replace(/[。．.！!,，;；]+$/u, '').trim()
  return text
}

function cleanArg(value) {
  return stripQuotes(value).replace(/^[：:]\s*/u, '').trim()
}

function matchAlias(text, alias) {
  const lower = text.toLowerCase()
  if (!lower.startsWith(alias)) return null
  const rest = text.slice(alias.length)
  // 英文别名要求词边界：「scenario」不能吃掉「scenarios」的开头。
  if (/^[a-z]/.test(alias) && /^[A-Za-z]/.test(rest)) return null
  return rest
}

function matchCommand(text) {
  for (const group of COMMAND_GROUPS) {
    for (const alias of group.aliases) {
      const rest = matchAlias(text, alias)
      if (rest === null) continue
      // group.kind 为 null 的通用动词（获得 / 给）由剩余文本决定数量类型，先归入 amount。
      return { kind: group.kind ?? 'amount', unit: group.kind ?? null, rest: rest.trim(), alias }
    }
  }
  return null
}

function matchByLabels(candidates, needle) {
  let best = null
  for (const candidate of candidates) {
    let tier = null
    for (const label of candidate.labels || []) {
      if (typeof label !== 'string' || !label) continue
      const value = label.toLowerCase()
      if (value === needle) tier = tier === null ? TIER_EXACT : Math.min(tier, TIER_EXACT)
      else if (value.startsWith(needle)) tier = tier === null ? TIER_PREFIX : Math.min(tier, TIER_PREFIX)
      else if (value.includes(needle)) tier = tier === null ? TIER_CONTAINS : Math.min(tier, TIER_CONTAINS)
    }
    if (tier === null) continue
    if (!best || tier < best.tier) best = { tier, list: [candidate] }
    else if (tier === best.tier) best.list.push(candidate)
  }
  return best
}

function campaignPackSet(state) {
  const campaign = state?.campaign?.id ? contentRegistry.getCampaign(state.campaign.id) : null
  return new Set(campaign?.requiredPackIds || [])
}

function englishWords(id) {
  return String(id).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
}

function withoutLeadingThe(text) {
  return text.replace(/^the\s+/u, '')
}

function scenarioNameParts(manifest, id) {
  const name = typeof manifest?.name === 'string' && manifest.name ? manifest.name : id
  const short = name.split(/[：:]/u).pop().trim()
  return { name, short: short || name }
}

// ---------------------------------------------------------------------------
// 场景（跳到）候选与匹配
// ---------------------------------------------------------------------------

function scenarioCandidates(state) {
  const campaign = state?.campaign?.id ? contentRegistry.getCampaign(state.campaign.id) : null
  if (!campaign) throw new Error('当前对局没有战役信息。')
  const ids = Array.isArray(campaign.scenarioIds) ? campaign.scenarioIds : []
  if (!ids.length) throw new Error('当前战役没有可跳转的关卡。')
  return ids.map((id, index) => {
    const manifest = contentRegistry.getScenario(id)
    const { name, short } = scenarioNameParts(manifest, id)
    const english = englishWords(id)
    return {
      id,
      index,
      name,
      short,
      labels: [...new Set([id, name, short, english, withoutLeadingThe(english)])],
    }
  })
}

function formatScenarioCandidate(candidate) {
  return `第 ${candidate.index + 1} 关「${candidate.short}」(${candidate.id})`
}

const CHINESE_DIGITS = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }

// 「2」「第2关」「第二关」「十二」→ 0 起始序号；不是序号则返回 null。
function parseScenarioIndex(needle) {
  const arabic = needle.match(/^第?\s*(\d{1,3})\s*关?$/u)
  if (arabic) return Number(arabic[1]) - 1
  const chinese = needle.match(/^第?\s*([一二两三四五六七八九十]+)\s*关?$/u)
  if (!chinese) return null
  const value = chinese[1]
  if (value === '十') return 9
  if (/^[一二两三四五六七八九]$/u.test(value)) return CHINESE_DIGITS[value] - 1
  const tens = value.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/u)
  if (!tens) return null
  const high = tens[1] ? CHINESE_DIGITS[tens[1]] : 1
  const low = tens[2] ? CHINESE_DIGITS[tens[2]] : 0
  return high * 10 + low - 1
}

function resolveScenario(candidates, arg) {
  const needle = arg.trim().toLowerCase().replace(/\s+/g, ' ')
  // 1 起始序号：「2」「第2关」「第二关」「2 关」。
  const index = parseScenarioIndex(needle)
  if (index !== null) {
    const found = candidates[index]
    if (!found) throw new Error(`本战役共 ${candidates.length} 关，没有第 ${index + 1} 关。`)
    return found
  }
  const compact = needle.replace(/\s+/g, '')
  const exactId = candidates.filter(candidate => candidate.id.toLowerCase() === compact)
  if (exactId.length === 1) return exactId[0]
  const best = matchByLabels(candidates, needle)
  if (!best) throw new Error(`没有找到关卡「${arg}」。`)
  if (best.list.length === 1) return best.list[0]
  throw new Error(`关卡「${arg}」不唯一：${best.list.map(formatScenarioCandidate).join('、')}。请使用序号或关卡 ID。`)
}

// ---------------------------------------------------------------------------
// 敌人（生成）候选池与匹配
// ---------------------------------------------------------------------------

let spawnPoolCache

function enemyKey(code) {
  const card = ALL_CARDS[code]
  if (card?.duplicateOfCode && ALL_CARDS[card.duplicateOfCode]) return card.duplicateOfCode
  if (card?.originalCode && ALL_CARDS[card.originalCode]) return card.originalCode
  const rule = ALL_ENEMIES[code]
  if (rule?.originalCode && ALL_CARDS[rule.originalCode]) return rule.originalCode
  return code
}

function baseSpawnPool() {
  if (spawnPoolCache) return spawnPoolCache
  const byKey = new Map()
  const ensure = (key) => {
    let entry = byKey.get(key)
    if (!entry) {
      const card = ALL_CARDS[key]
      entry = {
        key, originalCode: key, codes: new Set([key]), labels: new Set(),
        aliases: [], preferredCode: key,
        nameZh: card?.nameZh || null, nameEn: card?.name || null, pack: card?.pack || null,
      }
      byKey.set(key, entry)
    }
    return entry
  }
  // 1) 剧本敌人规则别名（card-lookup 的 ALL_ENEMIES）：带词条原名与规则定义。
  for (const [alias, def] of Object.entries(ALL_ENEMIES)) {
    if (!def || typeof def !== 'object') continue
    const key = enemyKey(def.originalCode || alias)
    const entry = ensure(key)
    entry.codes.add(alias)
    entry.aliases.push(alias)
    if (def.name) entry.labels.add(def.name)
  }
  // 2) cards-data 里所有敌人型卡（含弱点敌人）：补中/英文名与卡包。
  for (const [code, card] of Object.entries(ALL_CARDS)) {
    if (!card || card.type !== 'enemy') continue
    const entry = ensure(enemyKey(code))
    entry.codes.add(code)
    if (card.name) { entry.labels.add(card.name); entry.nameEn ||= card.name }
    if (card.nameZh) { entry.labels.add(card.nameZh); entry.nameZh ||= card.nameZh }
    entry.pack ||= card.pack || null
  }
  for (const entry of byKey.values()) {
    entry.preferredCode = entry.aliases[0] || entry.originalCode
    const def = enemyDef(entry.originalCode) || (entry.preferredCode !== entry.originalCode ? enemyDef(entry.preferredCode) : null)
    if (def?.name) { entry.labels.add(def.name); entry.nameZh ||= def.name }
    const card = ALL_CARDS[entry.originalCode]
    if (card?.name) entry.labels.add(card.name)
    if (card?.nameZh) entry.labels.add(card.nameZh)
    entry.display = entry.nameZh || card?.nameZh || entry.nameEn || entry.originalCode
    entry.labels = [...entry.labels]
    entry.codes = [...new Set([entry.preferredCode, ...entry.codes])]
  }
  spawnPoolCache = [...byKey.values()]
  return spawnPoolCache
}

function spawnCandidatesFor(state) {
  const scenarioAliasByOriginal = new Map()
  for (const [alias, def] of Object.entries(state?.scenario?.enemies || {})) {
    if (!def || typeof def !== 'object') continue
    const key = enemyKey(def.originalCode || alias)
    if (!scenarioAliasByOriginal.has(key)) scenarioAliasByOriginal.set(key, alias)
  }
  const campaignPacks = campaignPackSet(state)
  return baseSpawnPool().map(candidate => {
    const scenarioAlias = scenarioAliasByOriginal.get(candidate.originalCode) || null
    const code = scenarioAlias || candidate.preferredCode
    return {
      ...candidate,
      code,
      codes: [...new Set([code, ...candidate.codes])],
      scenarioRelevant: Boolean(scenarioAlias),
      packRelevant: Boolean(candidate.pack) && campaignPacks.has(candidate.pack),
    }
  })
}

function formatSpawnCandidate(candidate) {
  return `「${candidate.display}」(${candidate.codes.slice(0, 2).join('/')})`
}

function preferCandidates(list, { scenario = true, packs = false } = {}) {
  if (list.length <= 1) return list
  if (scenario) {
    const preferred = list.filter(candidate => candidate.scenarioRelevant)
    if (preferred.length) return preferred
  }
  if (packs) {
    const preferred = list.filter(candidate => candidate.packRelevant)
    if (preferred.length) return preferred
  }
  return list
}

function resolveSpawnCandidate(state, arg) {
  const needle = arg.toLowerCase()
  const pool = spawnCandidatesFor(state)
  const exactCode = pool.filter(candidate => candidate.codes.some(code => String(code).toLowerCase() === needle))
  if (exactCode.length === 1) return exactCode[0]
  if (exactCode.length > 1) {
    throw new Error(`敌人卡号「${arg}」不唯一：${preferCandidates(exactCode).map(formatSpawnCandidate).join('、')}。`)
  }
  const best = matchByLabels(pool, needle)
  if (!best) throw new Error(`没有找到敌人「${arg}」。`)
  if (best.list.length === 1) return best.list[0]
  const preferred = preferCandidates(best.list, { scenario: true, packs: true })
  if (preferred.length === 1) return preferred[0]
  throw new Error(`敌人「${arg}」不唯一：${preferred.map(formatSpawnCandidate).join('、')}。请使用更精确的名称或卡号。`)
}

// ---------------------------------------------------------------------------
// 场上敌人（消灭）匹配
// ---------------------------------------------------------------------------

function enemyLabels(enemy) {
  const labels = new Set()
  if (typeof enemy?.name === 'string' && enemy.name) labels.add(enemy.name)
  for (const code of [enemy?.code, enemy?.originalCode, enemy?.ruleId]) {
    if (typeof code !== 'string' || !code) continue
    // 敌人卡号可能同时是规则别名（ALL_ENEMIES 键）与原卡号：英文名只能从 cards-data 的
    // 印刷卡记录取（cardDef 会被剧本规则中文名覆盖），所以这里中英文都按原卡补一遍。
    const printed = ALL_CARDS[code]
    if (printed?.name) labels.add(printed.name)
    if (printed?.nameZh) labels.add(printed.nameZh)
    if (ALL_ENEMIES[code]?.name) labels.add(ALL_ENEMIES[code].name)
    const def = cardDef(code)
    if (def?.name) labels.add(def.name)
    if (def?.nameZh) labels.add(def.nameZh)
    const rule = enemyDef(code)
    if (rule?.name) labels.add(rule.name)
  }
  return [...labels]
}

function formatEnemyInstance(enemy) {
  const code = enemy.originalCode || enemy.code || enemy.id
  return `「${enemy.name || cardName(code)}」(${code})`
}

function isAllTarget(arg) {
  const compact = arg.toLowerCase().replace(/\s+/g, '')
  if (!compact) return false
  const stripped = compact.replace(/敌人|敌|enemies|enemy|怪物/g, '')
  return ALL_TARGET_WORDS.has(stripped)
}

function resolveDefeatTargets(state, arg) {
  const needle = arg.toLowerCase()
  const enemies = Array.isArray(state?.enemies) ? state.enemies : []
  const exactCode = enemies.filter(enemy =>
    [enemy?.code, enemy?.originalCode, enemy?.ruleId]
      .some(code => typeof code === 'string' && code.toLowerCase() === needle))
  if (exactCode.length) return exactCode
  const items = enemies.map(enemy => ({
    enemy,
    labels: enemyLabels(enemy),
    typeKey: enemy?.originalCode || enemy?.code || enemy?.id,
  }))
  const best = matchByLabels(items, needle)
  if (!best) throw new Error(`场上没有找到敌人「${arg}」。`)
  const groups = new Map()
  for (const item of best.list) {
    if (!groups.has(item.typeKey)) groups.set(item.typeKey, [])
    groups.get(item.typeKey).push(item.enemy)
  }
  if (groups.size > 1) {
    const candidates = [...groups.values()].map(group => formatEnemyInstance(group[0]))
    throw new Error(`敌人「${arg}」不唯一：${candidates.join('、')}。请使用更精确的名称或卡号，或使用「消灭全部」。`)
  }
  return [...groups.values()][0]
}

// ---------------------------------------------------------------------------
// 卡牌（发到手牌）候选池与匹配
// ---------------------------------------------------------------------------

let cardPoolCache

function baseCardPool() {
  if (cardPoolCache) return cardPoolCache
  const pool = []
  for (const [code, card] of Object.entries(ALL_CARDS)) {
    if (!card || !CARD_TYPES.has(card.type) || card.permanent) continue
    const display = card.nameZh || card.name || code
    pool.push({
      code,
      display,
      labels: [...new Set([card.name, card.nameZh].filter(Boolean))],
      pack: card.pack || null,
    })
  }
  cardPoolCache = pool
  return pool
}

function currentCardCodes(state) {
  const codes = new Set()
  for (const inv of state?.investigators || []) {
    for (const zone of ['hand', 'deck', 'discard']) {
      for (const code of inv?.[zone] || []) if (typeof code === 'string') codes.add(code)
    }
  }
  for (const code of Object.keys(state?.scenario?.storyAssets || {})) codes.add(code)
  for (const code of state?.encounterDeck || []) if (typeof code === 'string') codes.add(code)
  for (const code of state?.setAside || []) if (typeof code === 'string') codes.add(code)
  return codes
}

function resolveCardCandidate(state, arg) {
  const needle = arg.toLowerCase()
  // 精确 5 位卡号（允许末尾小写字母的双面牌号）。契约只承诺 5 位；放宽到 3-6 位便于调试。
  if (/^\d{3,6}[a-z]?$/u.test(needle)) {
    const code = needle
    const card = ALL_CARDS[code]
    if (!card) throw new Error(`卡牌不存在：${code}。`)
    if (!CARD_TYPES.has(card.type) || card.permanent) {
      throw new Error(`「${card.nameZh || card.name || code}」不是可加入手牌的卡牌（仅限非永久的支援/事件/技能）。`)
    }
    return { code, display: card.nameZh || card.name || code }
  }
  const campaignPacks = campaignPackSet(state)
  const inGame = currentCardCodes(state)
  const pool = baseCardPool().map(candidate => ({
    ...candidate,
    packRelevant: Boolean(candidate.pack) && campaignPacks.has(candidate.pack),
    inGameRelevant: inGame.has(candidate.code),
  }))
  const best = matchByLabels(pool, needle)
  if (!best) throw new Error(`没有找到卡牌「${arg}」。`)
  if (best.list.length === 1) return best.list[0]
  const inGamePreferred = best.list.filter(candidate => candidate.inGameRelevant)
  const pool2 = inGamePreferred.length ? inGamePreferred : best.list
  const packPreferred = pool2.filter(candidate => candidate.packRelevant)
  const preferred = packPreferred.length ? packPreferred : pool2
  if (preferred.length === 1) return preferred[0]
  throw new Error(`卡牌「${arg}」不唯一：${preferred.map(candidate => `「${candidate.display}」(${candidate.code})`).join('、')}。请使用 5 位卡号。`)
}

// ---------------------------------------------------------------------------
// 目标座位 / 数量
// ---------------------------------------------------------------------------

function findInvestigator(state, seat) {
  return (state?.investigators || []).find(inv => inv?.seat === seat) || null
}

function resolveTargetSeat(state, seat, command, { requireCampaignRecord = false } = {}) {
  const raw = command?.targetSeat
  let target = raw
  if (target === undefined || target === null || target === '') target = seat
  if (typeof target === 'number') {
    if (!Number.isInteger(target)) throw new Error(`目标座位无效：${JSON.stringify(raw)}。`)
  } else if (typeof target === 'string' && /^\d+$/u.test(target.trim())) {
    target = Number(target.trim())
  } else {
    throw new Error(`目标座位无效：${JSON.stringify(raw)}。`)
  }
  const inv = findInvestigator(state, target)
  if (!inv) {
    const seats = (state?.investigators || []).map(item => item?.seat).filter(Number.isInteger)
    throw new Error(`目标座位无效：${target}${seats.length ? `（可用座位：${seats.join('、')}）` : ''}。`)
  }
  if (requireCampaignRecord && !state?.campaign?.investigators?.[target]) {
    throw new Error(`${inv.name || '该调查员'}还没有战役记录，无法给予经验。`)
  }
  return target
}

function parseAmount(rest) {
  if (/-\s*\d/u.test(rest)) throw new Error('数量必须是 1 到 999 的整数。')
  const match = rest.match(/(\d+)/u)
  if (!match) throw new Error(`请提供数量（1-999）：「${rest}」。`)
  const amount = Number(match[1])
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 999) {
    throw new Error('数量必须是 1 到 999 的整数。')
  }
  return amount
}

function resolveAmountKind(kind, rest) {
  if (kind) return kind
  const lower = rest.toLowerCase()
  if (/经验|\bxp\b|\bexp\b/u.test(lower)) return 'xp'
  if (/资源|\bresource/u.test(lower)) return 'resources'
  if (/线索|\bclue/u.test(lower)) return 'clues'
  if (/行动点|行动力|\bactions?\b/u.test(lower)) return 'actions'
  throw new Error('请说明要给予的是经验、资源、线索还是行动点（例如「获得 3 资源」）。')
}

const AMOUNT_UNITS = { xp: '点经验', resources: '点资源', clues: '个线索', actions: '点行动点' }

function locationName(state, locationId) {
  const location = (state?.locations || []).find(item => item?.id === locationId)
  return location?.name || location?.id || '未知地点'
}

// 卡牌目的地：到手上（默认）/ 牌库顶 / 牌库底 / 弃牌堆。返回 { zone, arg }，arg 去掉目的地后缀。
const CARD_ZONE_SUFFIXES = [
  ['deckTop', ['到牌库顶部', '到牌堆顶部', '到牌库顶', '到牌堆顶', '牌库顶部', '牌堆顶部', '牌库顶', '牌堆顶', '到牌库上方']],
  ['deckBottom', ['到牌库底部', '到牌堆底部', '到牌库底', '到牌堆底', '牌库底部', '牌堆底部', '牌库底', '牌堆底', '到牌库下方']],
  ['discard', ['到弃牌堆', '进弃牌堆', '弃牌堆']],
  ['hand', ['到手上', '到手牌', '到手中', '到手', '进手上', '进手牌', '进手', '放入手牌', '加入手牌']],
]
const CARD_ZONE_LABELS = { hand: '手牌', deckTop: '牌库顶', deckBottom: '牌库底', discard: '弃牌堆' }

function parseCardDestination(value) {
  const text = value.trim()
  for (const [zone, suffixes] of CARD_ZONE_SUFFIXES) {
    const suffix = suffixes.find(item => text.endsWith(item))
    if (suffix) return { zone, arg: text.slice(0, -suffix.length).trim() }
  }
  return { zone: 'hand', arg: text }
}

// ---------------------------------------------------------------------------
// 地点（传送到 / 揭示）候选与匹配：精确 id > 精确名 > 前缀 > 包含，歧义列出候选。
// ---------------------------------------------------------------------------

function locationCandidates(state) {
  return (state?.locations || []).map(location => ({
    id: location.id,
    name: location.name || location.id,
    revealed: location.revealed === true,
    labels: [...new Set([location.id, location.name].filter(Boolean))],
    location,
  }))
}

function formatLocationCandidate(candidate) {
  return `「${candidate.name}」(${candidate.id})`
}

function resolveLocation(state, arg) {
  const needle = arg.toLowerCase()
  const candidates = locationCandidates(state)
  if (!candidates.length) throw new Error('当前关卡还没有已放置的地点。')
  const exactId = candidates.filter(candidate => candidate.id.toLowerCase() === needle)
  if (exactId.length === 1) return exactId[0]
  const best = matchByLabels(candidates, needle)
  if (!best) throw new Error(`没有找到地点「${arg}」。`)
  if (best.list.length === 1) return best.list[0]
  throw new Error(`地点「${arg}」不唯一：${best.list.map(formatLocationCandidate).join('、')}。请使用地点 ID 或更精确的名称。`)
}

function isAllRevealTarget(arg) {
  const compact = arg.toLowerCase().replace(/\s+/g, '').replace(/地点|场所|区域/g, '')
  return !compact || ALL_TARGET_WORDS.has(compact)
}

// ---------------------------------------------------------------------------
// 状态摘要（状态 / info / status）：只读，返回多行中文摘要。
// ---------------------------------------------------------------------------

const PHASE_LABELS = {
  mythos: '神话阶段',
  investigation: '调查阶段',
  enemy: '敌人阶段',
  upkeep: '维护阶段',
  scenarioSetup: '关卡准备',
  interlude: '幕间',
  scenarioResult: '关卡结算',
  campaignResult: '战役结算',
}

function phaseLabel(phase) {
  return PHASE_LABELS[phase] || phase || '未知'
}

function investigatorStatusLine(state, inv) {
  const flags = [inv?.defeated ? '已败退' : null, inv?.resigned ? '已撤退' : null].filter(Boolean)
  const health = inv?.maxHealth ?? inv?.health ?? '?'
  const sanity = inv?.maxSanity ?? inv?.sanity ?? '?'
  return `  [${inv?.seat ?? '?'}] ${inv?.name || '调查员'}${flags.length ? `（${flags.join('/')}）` : ''}`
    + ` @${locationName(state, inv?.location)}`
    + ` 伤害 ${inv?.damage ?? 0}/${health} 恐惧 ${inv?.horror ?? 0}/${sanity}`
    + ` 资源 ${inv?.resources ?? 0} 线索 ${inv?.clues ?? 0} 行动点 ${inv?.actionsLeft ?? 0}`
    + ` 手牌 ${(inv?.hand || []).length} 牌库 ${(inv?.deck || []).length}`
}

function enemyStatusLine(state, enemy) {
  const health = Number.isFinite(enemy?.health) ? enemy.health : '?'
  const remaining = Number.isFinite(enemy?.health) ? Math.max(0, health - (enemy?.damageTaken || 0)) : '?'
  const parts = [`「${enemy?.name || enemy?.code || '敌人'}」`, `@${locationName(state, enemy?.location)}`, `生命 ${remaining}/${health}`]
  if (enemy?.engagedSeat != null) parts.push(`交战座位 ${enemy.engagedSeat}`)
  return '  ' + parts.join(' ')
}

function statusSummary(state) {
  const lines = ['🛠️ 调试控制台 · 对局状态']
  lines.push(`状态：${state?.status || '未知'}${state?.pendingChoice ? '（有未处理的待决选择）' : ''}`)
  const scenario = state?.scenario
  if (scenario?.id) {
    lines.push(`场景：${scenario.name || scenario.id}（${scenario.id}）`)
  } else {
    lines.push(`场景：局外（${state?.uiState || '未知'}）`)
  }
  const turnSeat = Number.isInteger(state?.turnSeat) ? state.turnSeat : state?.currentSeat
  lines.push(`轮次：${state?.round ?? '?'} · 阶段：${phaseLabel(state?.phase)}`
    + `${Number.isInteger(turnSeat) ? ` · 当前回合座位：${turnSeat}` : ''}`)
  const act = Array.isArray(state?.acts) ? state.acts[state.actIndex] : null
  if (act) {
    let progress = ''
    if (act.objective?.type === 'clues' && Number.isFinite(act.objective.perInvestigator)) {
      const total = act.objective.perInvestigator * (state.numInvestigators || 1)
      progress = `（线索 ${state.actClues ?? 0}/${total}${act.objective.atLocation ? ` @${locationName(state, act.objective.atLocation)}` : ''}）`
    }
    lines.push(`幕：${[act.stage, act.name || act.id].filter(Boolean).join(' ')}${progress}`)
  }
  const agenda = Array.isArray(state?.agendas) ? state.agendas[state.agendaIndex] : null
  if (agenda) {
    lines.push(`密谋：${[agenda.stage, agenda.name || agenda.id].filter(Boolean).join(' ')}`
      + `（毁灭 ${state.doom ?? 0}/${agenda.doomThreshold ?? '?'}）`)
  }
  lines.push(`全局：线索 ${state?.clues ?? 0} · 毁灭 ${state?.doom ?? 0} · 胜点 ${state?.victory ?? 0}`)
  const investigators = Array.isArray(state?.investigators) ? state.investigators : []
  lines.push(`调查员（${investigators.length}）：`)
  for (const inv of investigators) lines.push(investigatorStatusLine(state, inv))
  const enemies = Array.isArray(state?.enemies) ? state.enemies : []
  lines.push(enemies.length ? `场上敌人（${enemies.length}）：` : '场上敌人：无')
  for (const enemy of enemies) lines.push(enemyStatusLine(state, enemy))
  if (state?.pendingChoice) lines.push(`待决选择：${state.pendingChoice.prompt || state.pendingChoice.kind || '待处理'}`)
  return lines.join('\n')
}

// 毁灭 ±N：加毁灭/减毁灭 指定方向，doom 允许自行写 +/-；绝对值 1..999。
function parseDoomAmount(rest, sign) {
  let text = rest.replace(/\s+/g, '')
  if (text.startsWith('+') || text.startsWith('＋')) {
    if (sign === -1) throw new Error('「减毁灭」后面请不要再加正号。')
    text = text.slice(1)
    sign ??= 1
  } else if (text.startsWith('-') || text.startsWith('−')) {
    if (sign === 1) throw new Error('「加毁灭」后面请不要再加负号。')
    text = text.slice(1)
    sign ??= -1
  }
  if (sign == null) sign = 1
  if (!/^\d{1,3}$/u.test(text)) throw new Error('毁灭数量必须是 1 到 999 的整数（例如「加毁灭 2」或「doom -1」）。')
  const size = Number(text)
  if (!Number.isSafeInteger(size) || size < 1 || size > 999) throw new Error('毁灭数量必须是 1 到 999 的整数。')
  return sign * size
}

// ---------------------------------------------------------------------------
// 各指令构造
// ---------------------------------------------------------------------------

function buildScenarioCommand(state, rest) {
  const arg = cleanArg(rest)
  if (!arg) throw new Error('请提供要跳转的关卡：序号、关卡 ID 或名称。')
  const candidate = resolveScenario(scenarioCandidates(state), arg)
  return {
    move: { action: 'debug', kind: 'scenario', scenarioId: candidate.id },
    message: `已跳到第 ${candidate.index + 1} 关「${candidate.short}」。`,
  }
}

function buildSpawnCommand(state, seat, command, rest) {
  const arg = cleanArg(rest)
  if (!arg) throw new Error('请提供要生成的敌人名称或卡号。')
  const targetSeat = resolveTargetSeat(state, seat, command)
  const inv = findInvestigator(state, targetSeat)
  const candidate = resolveSpawnCandidate(state, arg)
  return {
    move: { action: 'debug', kind: 'spawn', code: candidate.code, targetSeat },
    message: `已在「${locationName(state, inv.location)}」生成「${candidate.display}」（目标：${inv.name}）。`,
  }
}

function buildDefeatCommand(state, rest) {
  const arg = cleanArg(rest)
  if (!arg) throw new Error('请提供要消灭的敌人名称/卡号，或使用「消灭全部」。')
  if (isAllTarget(arg)) {
    const total = (state?.enemies || []).length
    return {
      move: { action: 'debug', kind: 'defeat', all: true },
      message: `已消灭场上全部 ${total} 个敌人。`,
    }
  }
  const targets = resolveDefeatTargets(state, arg)
  const names = targets.map(enemy => enemy.name || cardName(enemy.code) || enemy.code)
  return {
    move: { action: 'debug', kind: 'defeat', enemyIds: targets.map(enemy => enemy.id) },
    message: `已消灭「${names.join('」「')}」。`,
  }
}

function buildCardCommand(state, seat, command, rest) {
  const { zone, arg } = parseCardDestination(cleanArg(rest))
  if (!arg) throw new Error('请提供要发放的卡牌（5 位卡号或中/英文卡名）。')
  const targetSeat = resolveTargetSeat(state, seat, command)
  const inv = findInvestigator(state, targetSeat)
  const card = resolveCardCandidate(state, arg)
  const move = { action: 'debug', kind: 'card', code: card.code, targetSeat }
  if (zone !== 'hand') move.zone = zone
  const message = zone === 'hand'
    ? `已将「${card.display}」放入${inv.name}的手牌。`
    : `已将「${card.display}」放到${inv.name}的${CARD_ZONE_LABELS[zone]}。`
  return { move, message }
}

function buildAmountCommand(state, seat, command, unit, rest) {
  const kind = resolveAmountKind(unit, rest)
  const amount = parseAmount(rest)
  const targetSeat = resolveTargetSeat(state, seat, command, { requireCampaignRecord: kind === 'xp' })
  const inv = findInvestigator(state, targetSeat)
  const current = kind === 'xp'
    ? state.campaign.investigators[targetSeat].xp
    : kind === 'resources' ? (inv.resources || 0)
      : kind === 'clues' ? (inv.clues || 0)
        : (inv.actionsLeft || 0)
  return {
    move: { action: 'debug', kind, amount, targetSeat },
    message: `${inv.name}获得 ${amount} ${AMOUNT_UNITS[kind]}（当前 ${current}）。`,
  }
}

function buildDrawCommand(state, seat, command, rest) {
  // 抽 [N]：N 缺省 1。
  const amount = rest ? parseAmount(rest) : 1
  const targetSeat = resolveTargetSeat(state, seat, command)
  const inv = findInvestigator(state, targetSeat)
  return {
    move: { action: 'debug', kind: 'draw', amount, targetSeat },
    message: `${inv.name}抽了 ${amount} 张牌。`,
  }
}

function buildActionsCommand(state, seat, command, rest) {
  return buildAmountCommand(state, seat, command, 'actions', rest)
}

function buildMoveToCommand(state, seat, command, rest) {
  const arg = cleanArg(rest)
  if (!arg) throw new Error('请提供要传送到的地点（地点 ID 或名称）。')
  const targetSeat = resolveTargetSeat(state, seat, command)
  const inv = findInvestigator(state, targetSeat)
  const location = resolveLocation(state, arg)
  return {
    move: { action: 'debug', kind: 'moveTo', locationId: location.id, targetSeat },
    message: `${inv.name}传送到「${location.name}」。`,
  }
}

// 治疗效果按别名分三种：只治伤害 / 只治恐惧 / 两者都治。
const HEAL_MODES = {
  治疗伤害: 'damage', 回复生命: 'damage', heal: 'damage',
  治疗恐惧: 'horror', 回复理智: 'horror', healhorror: 'horror',
  治疗: 'both', 回复: 'both',
}

function buildHealCommand(state, seat, command, rest, alias) {
  const mode = HEAL_MODES[alias] || 'both'
  const amount = parseAmount(rest)
  const targetSeat = resolveTargetSeat(state, seat, command)
  const inv = findInvestigator(state, targetSeat)
  const move = { action: 'debug', kind: 'heal', targetSeat }
  if (mode !== 'horror') move.damage = amount
  if (mode !== 'damage') move.horror = amount
  const message = mode === 'both'
    ? `${inv.name}恢复了 ${amount} 点伤害与 ${amount} 点恐惧。`
    : mode === 'damage' ? `${inv.name}恢复了 ${amount} 点伤害。` : `${inv.name}恢复了 ${amount} 点恐惧。`
  return { move, message }
}

// 受到伤害/恐惧：受伤/受惊 指定类型；受到/take 由剩余文本里的「伤害/damage」「恐惧/horror」决定。
function parseHarmMode(alias, rest) {
  if (alias === '受伤') return 'damage'
  if (alias === '受惊') return 'horror'
  const lower = rest.toLowerCase()
  const damage = /伤害|damage/u.test(lower)
  const horror = /恐惧|horror|惊吓/u.test(lower)
  if (damage && horror) throw new Error('一条指令只能造成伤害或恐惧，请分开使用。')
  if (damage) return 'damage'
  if (horror) return 'horror'
  throw new Error('请说明是受到伤害还是恐惧（例如「受到 2 伤害」或「受惊 1」）。')
}

function buildHarmCommand(state, seat, command, rest, alias) {
  const mode = parseHarmMode(alias, rest)
  const amount = parseAmount(rest)
  const targetSeat = resolveTargetSeat(state, seat, command)
  const inv = findInvestigator(state, targetSeat)
  const move = { action: 'debug', kind: 'harm', targetSeat }
  if (mode === 'damage') move.damage = amount
  else move.horror = amount
  return {
    move,
    message: mode === 'damage' ? `${inv.name}受到 ${amount} 点伤害。` : `${inv.name}受到 ${amount} 点恐惧。`,
  }
}

function buildRevealCommand(state, rest, alias) {
  const revealAll = () => ({ move: { action: 'debug', kind: 'reveal', all: true }, message: '已揭示全部未揭示的地点。' })
  // 「揭示全部」本身就是一个完整别名；「揭示 全部 / reveal all」由剩余文本判断。
  if (alias === '揭示全部') return revealAll()
  const arg = cleanArg(rest)
  if (!arg) throw new Error('请提供要揭示的地点，或使用「揭示全部」。')
  if (isAllRevealTarget(arg)) return revealAll()
  const location = resolveLocation(state, arg)
  return {
    move: { action: 'debug', kind: 'reveal', locationId: location.id },
    message: `已揭示「${location.name}」。`,
  }
}

function buildDoomCommand(state, rest, alias) {
  const sign = alias === '加毁灭' ? 1 : alias === '减毁灭' ? -1 : null
  const amount = parseDoomAmount(rest, sign)
  return {
    move: { action: 'debug', kind: 'doom', amount },
    message: `毁灭 ${amount > 0 ? '+' : ''}${amount}（当前 ${state?.doom ?? 0}）。`,
  }
}

function buildRestartCommand(state) {
  const scenario = state?.scenario
  const scenarioId = scenario?.id
  if (!scenarioId) throw new Error('当前没有进行中的关卡，无法重开本关。')
  const fullName = String(scenario.name || scenarioId)
  const shortName = fullName.split(/[：:]/u).pop().trim() || fullName
  return {
    move: { action: 'debug', kind: 'scenario', scenarioId },
    message: `已重开本关「${shortName}」。`,
  }
}

/**
 * 解析一条调试控制台指令。
 *
 * @param {{ state: object }} session 权威会话（本函数只读 session.state）
 * @param {number} seat 调用者座位
 * @param {{ text: string, targetSeat?: number|string }} command 前端上传的指令
 * @returns {{ move: object|null, message: string }} move 为 null 时只回显 message（帮助 / 状态），不提交
 */
export function buildDebugCommand(session, seat, command) {
  const state = session?.state
  if (!state || typeof state !== 'object') throw new Error('当前没有可用的对局状态。')
  if (!command || typeof command !== 'object' || Array.isArray(command)) throw new Error('调试指令格式无效。')
  if (!Number.isInteger(seat)) throw new Error('调试控制台座位无效。')
  const text = normalizeText(command.text)
  if (!text) throw new Error('请输入调试指令，发送「帮助」查看可用指令。')

  const helpKey = text.toLowerCase()
  if (HELP_ALIASES.has(helpKey) || HELP_ALIASES.has(helpKey.replace(/[?？]+$/u, '').trim())) {
    return { move: null, message: HELP_TEXT }
  }
  const matched = matchCommand(text)
  if (!matched) throw new Error(`未知调试指令「${text}」。发送「帮助」查看可用指令。`)

  let result
  switch (matched.kind) {
    case 'scenario':
      result = buildScenarioCommand(state, matched.rest)
      break
    case 'restart':
      result = buildRestartCommand(state)
      break
    case 'spawn':
      result = buildSpawnCommand(state, seat, command, matched.rest)
      break
    case 'defeat':
      result = buildDefeatCommand(state, matched.rest)
      break
    case 'card':
      result = buildCardCommand(state, seat, command, matched.rest)
      break
    case 'draw':
      result = buildDrawCommand(state, seat, command, matched.rest)
      break
    case 'actions':
      result = buildActionsCommand(state, seat, command, matched.rest)
      break
    case 'moveTo':
      result = buildMoveToCommand(state, seat, command, matched.rest)
      break
    case 'heal':
      result = buildHealCommand(state, seat, command, matched.rest, matched.alias)
      break
    case 'harm':
      result = buildHarmCommand(state, seat, command, matched.rest, matched.alias)
      break
    case 'reveal':
      result = buildRevealCommand(state, matched.rest, matched.alias)
      break
    case 'doom':
      result = buildDoomCommand(state, matched.rest, matched.alias)
      break
    case 'status':
      return { move: null, message: statusSummary(state) }
    case 'amount':
    case 'xp':
    case 'resources':
    case 'clues':
      result = buildAmountCommand(state, seat, command, matched.unit, matched.rest)
      break
    default:
      throw new Error(`未知调试指令「${text}」。发送「帮助」查看可用指令。`)
  }
  // 契约 §4/§5：解析后必须用引擎 validateMove 复核，有错误直接把引擎错误文本抛给玩家。
  if (result.move) {
    const error = validateMove(state, seat, result.move)
    if (error) throw new Error(String(error))
  }
  return result
}
