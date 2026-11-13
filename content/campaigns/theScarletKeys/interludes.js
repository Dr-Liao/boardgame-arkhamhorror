// 《绯红密钥》（The Scarlet Keys）· 幕间 I、世界地图密档幕间（14–55）、状况报告 α–ω、
// 世界地图密档（Foundation Dossier）、快捷旅票与绿地支线幕间（P7）。
//
// 事实源（锁定）：
//   · 参考实现 `Campaigns/TheScarletKeys.hs` 的 `InterludeStep 1/14/20/26/27/32/36/37/44/45/49/50/51/52/53/54/55`
//     逐 step 镜像（含 `doStep`、`storyWithChooseOneM`、`interludeXpAll`、`markTime`、`swapTokens`、
//     `chooseBearer`、`campaignSpecific "unlock"`）；
//   · `Campaigns/TheScarletKeys/Helpers.hs#markTime / #swapTokens / #haven'tSeenTheLastOf / #chooseBearer`；
//   · `Campaigns/TheScarletKeys.hs#CampaignSpecific "statusReport"` 的 α–ω 效果；
//   · 正文键：各幕间 scope（`rusesAndReclamation`…）、`statusReport.*`、`worldMap.dossiers.*`、
//     `headings.interludes.<n>`；正文一律由 parts.js#campaignStoryText 从 story-text 读取。
//
// 三个口径（P7 登记）：
//   1. **时间**：参考 `markTime n` 同时累加 Campaign Log 的 time 并触发跨阈值的状况报告。
//      引擎的时间轴在 `campaign.tsk.map.time`（tsk-map.js），流程层记录在 `records.time`；
//      本文件 `markTime` 两处同时推进，状况报告由世界地图节点（flow.js#worldMap）排队后按阈值依次演出。
//      `tsk-map.js` 目前没有「非旅行加时」的原语，故这里直接写入 `campaign.tsk.map.time`
//      （已登记原语请求 map-advance-time）。
//   2. **选项**：需要玩家决策的点（tell/doNotTell、truth/secrets、accept/reject、token 升级、trauma 选择）
//      优先用流程图 `choice` 节点；只有「选项数量依赖运行时状态」的两处（#37 升级混乱标记、#53 trauma）
//      在处理器里走 `requestChoice`（与 TIC 幕间同一通路），无选择上下文时（单测/审计）退化为确定性默认值。
//   3. **密钥持有者**：`chooseBearer` 用 `requestChoice` 选集，缺省领队；引擎只登记持有关系。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { awardExperience, campaignCardChange } from '../../../src/campaign/campaign.js'
import { changeChaosBag } from '../../../src/engine/chaos-bag.js'
import { ChoicePause, requestChoice } from '../../../src/engine/resolution.js'
import { bindKey, scarletKey, scarletKeys, stealKey } from '../../../src/engine/tsk-scarlet-keys.js'
import { mergeMapTime, 
  completeSideStory, currentMapNode, dossiers, mapTime, readDossier,
  resolveStatusReport, setDynamicStatusReport, unlockDossier, unlockMapNode, worldMapState,
} from '../../../src/engine/tsk-map.js'
import { tskCampaignState } from '../../../src/engine/tsk-state.js'
import {
  TSK_DOSSIER_KEYS, TSK_DOSSIER_INTERLUDE_IDS, TSK_FORCED_ENDGAME_TIME, TSK_WORLD_MAP,
  campaignStoryHeading, campaignStoryText, dossierTextKey, mapNodeArchiveLabel, tskUnlockNodesFor,
} from './parts.js'
import { EXPEDITED_TICKET } from './records.js'
import { ALL_CARDS } from '../../../src/cards/cards-data.js'

export const INTERLUDE_HANDLER_ID = 'scarletKeysInterludes'

// ---------------------------------------------------------------------------
// 卡片常量（数据来自卡表，不手写卡名或规则文本）
// ---------------------------------------------------------------------------
export const STORY_CARD_CODES = Object.freeze({
  expeditedTicket: EXPEDITED_TICKET, // 09765 快捷旅票
  foundationIntel: '09766', // Foundation Intel
  inspectorFlint: '09762', // Inspector Flint
  drIrawan: '09764', // Dr. Dewi Irawan
  paradimensionalUnderstanding: '09767', // 跨维度理解（γ 状况报告洗入）
})

export const KEY_IDS_BY_NAME = Object.freeze({
  theBaleEngine: '09769', // Keys.theBaleEngine
  theRuinousChime: '09770', // Keys.theRuinousChime
  theMirroringBlade: '09768', // Keys.theMirroringBlade
})

// 「尚未见过最后一面」记录 → 敌人卡号（Key.hs 的 10 条 youHaventSeenTheLastOf*）。
export const COTERIE_LAST_SEEN_RECORDS = Object.freeze([
  Object.freeze({ record: 'youHaventSeenTheLastOfTheRedGlovedMan', code: '09752', textKey: 'theRedGlovedMan' }),
  Object.freeze({ record: 'youHaventSeenTheLastOfLaChicaRoja', code: '09753', textKey: 'laChicaRoja' }),
  Object.freeze({ record: 'youHaventSeenTheLastOfTheSanguineWatcher', code: '09754', textKey: 'theSanguineWatcher' }),
  Object.freeze({ record: 'youHaventSeenTheLastOfTheBeastInACowlOfCrimson', code: '09755', textKey: 'theBeastInACowlOfCrimson' }),
  Object.freeze({ record: 'youHaventSeenTheLastOfTheClaretKnight', code: '09756', textKey: 'theClaretKnight' }),
  Object.freeze({ record: 'youHaventSeenTheLastOfThorn', code: '09757', textKey: 'thorne' }),
  Object.freeze({ record: 'youHaventSeenTheLastOfDesiderioDelgadoAlvarez', code: '09758', textKey: 'desiderioDelgadoAlvarez' }),
  Object.freeze({ record: 'youHaventSeenTheLastOfAmaranth', code: '09759', textKey: 'amaranth' }),
  Object.freeze({ record: 'youHaventSeenTheLastOfTzuSanNiang', code: '09760', textKey: 'tzuSanNiang' }),
  Object.freeze({ record: 'youHaventSeenTheLastOfAlikiZoniUperetria', code: '09761', textKey: 'alikiZoniUperetria' }),
])

// 参考 #20 step2 / #54 的「信任 / 声望」计数记录组。
export const GREAT_WORK_TRUST_RECORDS = Object.freeze([
  'eceDoesNotTrustTheCell', 'youHaventSeenTheLastOfLaChicaRoja',
  'youHaventSeenTheLastOfDesiderioDelgadoAlvarez', 'youHaventSeenTheLastOfTheClaretKnight',
  'youHaventSeenTheLastOfThorne', 'youHaventSeenTheLastOfAlikiZoniUperetria',
])
export const INFERNAL_MACHINERY_REPUTATION_RECORDS = Object.freeze([
  'laChicaRojaIsOnYourSide', 'theCellAidedTheKnight', 'alikiIsOnYourSide',
  'desiIsInYourDebt', 'theCellMadeADealWithThorne', 'eceTrustsTheCell',
])

// 数字混乱标记的「升级一档」表（#37 Special Delivery 2/4，参考实现逐档 +1）。
export const NUMERIC_TOKEN_UPGRADE = Object.freeze({
  '0': '+1', '-1': '0', '-2': '-1', '-3': '-2', '-4': '-3', '-5': '-4', '-6': '-5', '-7': '-6', '-8': '-7',
})

// ---------------------------------------------------------------------------
// 通用辅助
// ---------------------------------------------------------------------------
const logLine = (log, line) => { if (typeof log === 'function') log(line) }

function appendStory (state, line) {
  if (!line) return
  const visit = state?.campaign?.flow?.history?.at?.(-1)
  if (visit) visit.storyText = [visit.storyText, line].filter(Boolean).join('\n\n')
}

const recordsOf = state => state?.campaign?.records || null
const graphOf = () => ({ nodes: TSK_WORLD_MAP })

function activeInvestigatorRecords (state) {
  return Object.values(state?.campaign?.investigators || {})
    .filter(record => record && record.status === 'active')
}

/** 参考 `interludeXpAll`：每名现役调查员 +n。 */
export function awardInterludeXp (state, amount, log) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return 0
  let awarded = 0
  for (const record of activeInvestigatorRecords(state)) {
    awardExperience(state.campaign, record.seat, amount)
    awarded += 1
  }
  if (awarded) logLine(log, `✨ 幕间奖励经验：每名调查员 +${amount} 点经验值。`)
  return awarded
}

/** 参考 `markTime n`：时间 +n（引擎时间轴 + Campaign Log 记录）。 */
export function markTime (state, amount, log) {
  if (!Number.isSafeInteger(amount) || amount === 0) return mapTime(state)
  const map = tskCampaignState(state, true)?.map
  if (map) map.time = Number(map.time || 0) + amount
  const records = recordsOf(state)
  const time = map ? Number(map.time) : Number(records?.time || 0) + amount
  if (records) {
    records.time = time
    if (Object.hasOwn(state.campaign.recordSchema || {}, 'tskTime')) records.tskTime = time
  }
  logLine(log, `⌛ 时间 +${amount}（当前 ${time}）。`)
  return time
}

/** 世界地图状态 → 流程记录（当前位置/已访问/时间）。旅行后进入节点时先同步。 */
export function syncMapRecords (state) {
  const records = recordsOf(state)
  if (!records) return null
  const map = worldMapState(state)
  if (map) {
    // P8：章节结局把时间奖励写进 `records.time`，而地图时间只随旅行累加；两者必须取较大值
    // 并写回权威地图存储（worldMapState 是只读副本），否则章节奖励会被 map.time 覆盖。
    const time = mergeMapTime(state, Math.max(Number(map.time) || 0, Number(records.time) || 0))
    records.time = time
    records.currentLocation = map.current || records.currentLocation || ''
    records.mapVisitedLocations = [...map.visited]
    if (Object.hasOwn(state.campaign.recordSchema || {}, 'tskTime')) records.tskTime = records.time
  }
  if (!records.currentLocation) records.currentLocation = currentMapNode(state) || ''
  return map
}

/** 密钥持有关系 → 记录（keysHeld/keysStolen）。 */
export function syncKeyRecords (state) {
  const records = recordsOf(state)
  if (!records) return null
  const held = []
  const engineStolen = []
  for (const key of scarletKeys(state)) {
    if (key.bearer.type === 'investigator') held.push(`${key.id}:${key.bearer.seat}`)
    if (key.bearer.type === 'enemy') engineStolen.push(`${key.id}:${key.bearer.enemyId}`)
  }
  const heldIds = new Set(held.map(entry => String(entry).split(':')[0]))
  // 剧情层面被夺走（敌人不在场）的密钥没有引擎持有者，只能记在 `keysStolen`：
  // 保留这些条目，直到密钥重新被调查员持有（`heldIds` 命中即丢弃）。
  const carried = (Array.isArray(records.keysStolen) ? records.keysStolen : [])
    .filter(entry => !heldIds.has(String(entry).split(':')[0]))
  records.keysHeld = held
  records.keysStolen = [...new Set([...engineStolen, ...carried])]
  return { held, stolen: records.keysStolen }
}

/**
 * 剧情层面的「密钥被夺走」：引擎只登记 none/调查员/在场敌人三种持有者，
 * 而状况报告 ζ 与幕间 14 的窃贼是**不在场**的红色同志会成员，故：
 *   · 引擎侧把密钥置为 `none`（不再属于调查员）；
 *   · 流程记录 `keysStolen` 记 `<keyId>:<enemyCode>`，供幕间 14 追回、尾声统计。
 * 已登记原语请求 `keyTakenOffscreen`（tsk-scarlet-keys）。
 */
export function takeKeyOffscreen (state, keyId, enemyCode, log) {
  bindKey(state, keyId, { type: 'none' })
  const records = recordsOf(state)
  if (records) {
    records.keysStolen = [...new Set([...(records.keysStolen || []), `${keyId}:${enemyCode}`])]
    records.keysHeld = (records.keysHeld || []).filter(entry => String(entry).split(':')[0] !== keyId)
  }
  logLine(log, `🩸 「${ALL_CARDS[enemyCode]?.nameZh || enemyCode}」夺走了「${ALL_CARDS[keyId]?.nameZh || keyId}」。`)
  return `${keyId}:${enemyCode}`
}

function unionRecord (state, key, values) {
  const records = recordsOf(state)
  if (!records) return
  const current = Array.isArray(records[key]) ? records[key] : []
  records[key] = [...new Set([...current, ...values.filter(Boolean)])]
}

function countRecords (state, keys) {
  const records = recordsOf(state) || {}
  return keys.filter(key => records[key] === true).length
}

function addChaosTokens (state, token, amount) {
  const campaign = state.campaign
  // 引擎 setup 会按 manifest.chaosBags 初始化战役袋；旧存档/夹具可能还没有容器，
  // 这里先补齐空袋，避免 changeChaosBag 在 undefined 上展开（不改变已有内容）。
  if (!Array.isArray(campaign.chaosBag)) campaign.chaosBag = []
  if (Array.isArray(state.chaosBag)) return changeChaosBag(state, token, amount, { permanent: true })
  const bag = [...campaign.chaosBag]
  for (let index = 0; index < Math.abs(amount); index += 1) {
    if (amount > 0) bag.push(token)
    else {
      const at = bag.indexOf(token)
      if (at >= 0) bag.splice(at, 1)
    }
  }
  campaign.chaosBag = bag
  return bag
}

/**
 * 参考 `swapTokens from to`：移除 1 枚 from、加入 1 枚 to；
 * 若 to 已达 4 枚则改为每名调查员 +1 经验（`xp.chaosTokens`）。
 */
export function swapChaosTokens (state, from, to, log, { xpKey = 'xp.chaosTokens' } = {}) {
  const campaign = state?.campaign
  if (!campaign) return null
  const bag = Array.isArray(state.chaosBag) ? state.chaosBag : (campaign.chaosBag || [])
  const fromCount = bag.filter(token => token === from).length
  const toCount = bag.filter(token => token === to).length
  if (fromCount === 0) {
    logLine(log, `🎲 混乱袋中没有 ${from} 标记，跳过交换。`)
    return { swapped: false, reason: 'missing' }
  }
  if (toCount >= 4) {
    awardInterludeXp(state, 1, log)
    logLine(log, `🎲 混乱袋中的 ${to} 已达到 4 枚（${campaignStoryText(xpKey) || 'Already at 4 chaos tokens'}）：每名调查员改为获得 1 点经验。`)
    logLine(log, `🎲 ${from} 标记保留。`)
    return { swapped: false, reason: 'cap', xp: 1 }
  }
  addChaosTokens(state, from, -1)
  addChaosTokens(state, to, 1)
  logLine(log, `🎲 混乱袋：移除 1 枚 ${from}，加入 1 枚 ${to}。`)
  return { swapped: true, from, to }
}

function addStoryCard (state, code, { seats = null, all = false, reason = '幕间奖励' } = {}, log) {
  const campaign = state?.campaign
  if (!campaign || !ALL_CARDS[code]) return []
  const targets = seats?.length
    ? seats
    : all
      ? activeInvestigatorRecords(state).map(record => record.seat)
      : [Number.isInteger(campaign.leadSeat) ? campaign.leadSeat : activeInvestigatorRecords(state)[0]?.seat]
        .filter(Number.isInteger)
  const added = []
  for (const seat of targets) {
    const record = campaign.investigators?.[seat]
    if (!record || record.deck?.includes(code)) continue
    campaignCardChange(campaign, seat, code, 'add', reason)
    added.push(seat)
  }
  if (added.length) {
    logLine(log, `🃏 「${ALL_CARDS[code].nameZh || ALL_CARDS[code].name}」加入 ${added.length} 名调查员的战役牌组。`)
  }
  return added
}

function removeStoryCard (state, code, log) {
  const campaign = state?.campaign
  if (!campaign) return 0
  let removed = 0
  for (const record of Object.values(campaign.investigators || {})) {
    if (!record?.deck?.includes(code)) continue
    campaignCardChange(campaign, record.seat, code, 'remove', '幕间结算')
    removed += 1
  }
  if (removed) logLine(log, `🃏 「${ALL_CARDS[code]?.nameZh || code}」从 ${removed} 名调查员的战役牌组移除。`)
  return removed
}

function sufferTrauma (state, seat, kind, amount, log) {
  const campaign = state?.campaign
  const record = campaign?.investigators?.[seat]
  if (!record || !['physical', 'mental'].includes(kind) || amount <= 0) return null
  campaign.trauma ||= {}
  const current = campaign.trauma[seat] || record.trauma || { physical: 0, mental: 0 }
  const next = { ...current, [kind]: (Number(current[kind]) || 0) + amount }
  campaign.trauma[seat] = next
  record.trauma = { ...next }
  logLine(log, `💔 ${record.name || `座位 ${seat}`} 承受 ${amount} 点${kind === 'physical' ? '肉体' : '精神'}创伤（累计 ${next[kind]}）。`)
  return next
}

/** 有选择上下文时请玩家选择；无上下文（单测/审计）返回 null，让调用方走确定性默认。 */
function askOptional (state, spec) {
  try {
    return requestChoice(state, spec)
  } catch (error) {
    if (error instanceof ChoicePause) throw error
    return null
  }
}

/** 参考 `chooseBearer def`：把密钥绑定给一名调查员（缺省领队）。 */
export function chooseBearer (state, keyId, log) {
  const campaign = state?.campaign
  if (!campaign) return null
  const candidates = activeInvestigatorRecords(state)
  if (!candidates.length) return null
  try {
    scarletKey(state, keyId)
  } catch {
    logLine(log, `🔑 密钥 ${keyId} 尚未初始化，跳过持有者选择。`)
    return null
  }
  const leadSeat = Number.isInteger(campaign.leadSeat) ? campaign.leadSeat : candidates[0].seat
  const chosen = askOptional(state, {
    kind: 'storyCard',
    source: keyId,
    seat: leadSeat,
    prompt: `选择绯红密钥「${ALL_CARDS[keyId]?.nameZh || keyId}」的持有者。`,
    options: candidates.map(record => ({ id: String(record.seat), label: record.name || `调查员 ${record.seat + 1}` })),
  })
  const seat = Number.isInteger(Number(chosen)) && campaign.investigators?.[Number(chosen)]
    ? Number(chosen)
    : (campaign.investigators?.[leadSeat] ? leadSeat : candidates[0].seat)
  bindKey(state, keyId, { type: 'investigator', seat })
  syncKeyRecords(state)
  logLine(log, `🔑 「${ALL_CARDS[keyId]?.nameZh || keyId}」由 ${campaign.investigators[seat]?.name || `座位 ${seat}`} 持有。`)
  return seat
}

/** 解锁地图节点（剧情 `campaignSpecific "unlock"`）；图结构固定为 shared.js#WORLD_MAP。 */
export function unlockNodes (state, nodes, log, { source = null } = {}) {
  const unlocked = []
  for (const node of nodes) {
    try {
      unlockMapNode(state, node, { graph: graphOf() })
      unlocked.push(node)
    } catch (error) {
      logLine(log, `⚠️ 解锁地图节点 ${node} 失败：${error.message}`)
    }
  }
  if (unlocked.length) logLine(log, `🗺️ 世界地图解锁：${unlocked.join('、')}${source ? `（${source}）` : ''}。`)
  return unlocked
}

// 幕间标题：幕间 I 用 scope 标题，密档幕间用档案号（`headings.interludes.<n>`）。
function interludeHeading (number, scopeId) {
  if (number === 1) return campaignStoryHeading(scopeId) || campaignStoryHeading('headings.interludes.1')
  return campaignStoryHeading(`headings.interludes.${number}`) || campaignStoryHeading(scopeId)
}

// 节点构造器：正文只存 key（textKey/textKeys），展示文本由 parts.js#campaignStoryText 读取。
function storyNode (textKey, next, { textKeys = [], ...extra } = {}) {
  return {
    type: 'story',
    textKey,
    ...(textKeys.length ? { textKeys } : {}),
    text: [textKey, ...textKeys].map(campaignStoryText).filter(Boolean).join('\n\n'),
    next,
    ...extra,
  }
}

function interludeEntry (number, scopeId, textKey, next, extra = {}) {
  return {
    type: 'interlude',
    title: interludeHeading(number, scopeId),
    upgrades: true,
    ...(textKey ? { textKey, text: campaignStoryText(textKey) } : {}),
    next,
    ...extra,
  }
}

function routeNode (number, scopeId, step, rules, next, extra = {}) {
  return {
    type: 'stepReturn',
    title: interludeHeading(number, scopeId),
    titleKey: `headings.interludes.${number}`,
    step,
    rules,
    next,
    ...extra,
  }
}

function choiceNode (number, scopeId, textKey, options, extra = {}) {
  return {
    type: 'choice',
    title: interludeHeading(number, scopeId),
    textKey,
    text: campaignStoryText(textKey),
    prompt: campaignStoryHeading(`headings.interludes.${number}`),
    options,
    ...extra,
  }
}

const condition = (record, equals = true) => ({ record, equals })
const includes = (record, value) => ({ record, includes: value })
const compare = (left, op, right) => ({ compare: { left, op, right } })
const sumAtLeast = (keys, amount) => ({ compare: { left: { sum: keys }, right: amount, op: '>=' } })

// ---------------------------------------------------------------------------
// 幕间 1：基金会（The Foundation）
// ---------------------------------------------------------------------------
const foundation = {
  interlude1: interludeEntry(1, 'interlude1', 'interlude1.theFoundation1', 'interlude1Choice'),
  interlude1Choice: choiceNode(1, 'interlude1', 'interlude1.theFoundation1', [
    { id: 'tell', labelKey: 'interlude1.label.tell', label: campaignStoryText('interlude1.label.tell'), next: 'interlude1Step2' },
    { id: 'doNotTell', labelKey: 'interlude1.label.doNotTell', label: campaignStoryText('interlude1.label.doNotTell'), next: 'interlude1Step3' },
  ]),
  interlude1Step2: storyNode('interlude1.theFoundation2', 'interlude1Step4', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude1ToldTruth' }],
  }),
  interlude1Step3: storyNode('interlude1.theFoundation3', 'interlude1Step4', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude1HidTruth' }],
  }),
  interlude1Step4: storyNode('interlude1.theFoundation4', 'embarkRules'),
  // 参考实现：幕间 I 第 4 步同时讲述「启程与旅行」与世界地图密档的读法，然后进入启程循环。
  embarkRules: storyNode('embarkingAndTravel', 'foundationDossiers'),
  foundationDossiers: storyNode('theFoundationDossiers', 'worldMap'),
}

// ---------------------------------------------------------------------------
// 幕间 14：拨乱反正（Ruses and Reclamation）——四座密档城市
// ---------------------------------------------------------------------------
const ruses = {
  // 参考实现：进入幕间 14 时先做「错误线索」检索（无正文），再按结果进入第 1/2 步。
  interlude14: interludeEntry(14, 'rusesAndReclamation', null, 'interlude14Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude14Search' }],
  }),
  interlude14Branch1: routeNode(14, 'rusesAndReclamation', 1,
    [
      { id: 'wrongLeadsExhausted', when: compare('wrongLeadCount', '>=', 3), next: 'interlude14Step2' },
      { id: 'leadFound', when: condition('rusesFound'), next: 'interlude14Step2' },
    ],
    'interlude14Step1'),
  interlude14Step1: storyNode('rusesAndReclamation.rusesAndReclamation1', 'worldMap', {
    effects: [{ type: 'increment', key: 'wrongLeadCount', amount: 1 }],
  }),
  interlude14Step2: storyNode('rusesAndReclamation.rusesAndReclamation2', 'worldMap', {
    textKeys: ['rusesAndReclamation.continue'],
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude14RecoverKeys' }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 20：伟业（The Great Work）——百慕大
// ---------------------------------------------------------------------------
const greatWork = {
  interlude20: interludeEntry(20, 'theGreatWork', 'theGreatWork.theGreatWork1', 'interlude20Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude20Read' }],
  }),
  interlude20Branch1: routeNode(20, 'theGreatWork', 1,
    [{ id: 'masaiFledToBermuda', when: condition('tuwileMasaiFledToBermuda'), next: 'interlude20Step2' }],
    'interlude20Step5'),
  interlude20Step2: storyNode('theGreatWork.theGreatWork2', 'interlude20Branch2', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude20CountTrust' }],
  }),
  interlude20Branch2: routeNode(20, 'theGreatWork', 2,
    [{ id: 'trustedByAtLeastTwo', when: sumAtLeast(GREAT_WORK_TRUST_RECORDS, 2), next: 'interlude20Step3' }],
    'interlude20Step4'),
  interlude20Step3: storyNode('theGreatWork.theGreatWork3', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude20Proceed' }],
  }),
  interlude20Step4: storyNode('theGreatWork.theGreatWork4', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude20Ally' }],
  }),
  interlude20Step5: storyNode('theGreatWork.theGreatWork5', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude20NoActivity' }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 26：交换条件（Quid Pro Quo）——莫斯科／旧金山
// ---------------------------------------------------------------------------
const quidProQuo = {
  interlude26: interludeEntry(26, 'quidProQuo', 'quidProQuo.body', 'interlude26Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude26Read' }],
  }),
  interlude26Branch1: routeNode(26, 'quidProQuo', 1,
    [{ id: 'inSanFrancisco', when: condition('currentLocation', 'SanFrancisco'), next: 'interlude26Step1' }],
    'interlude26Step2'),
  interlude26Step1: storyNode('quidProQuo.quidProQuo1', 'interlude26Choice1'),
  interlude26Choice1: choiceNode(26, 'quidProQuo', 'quidProQuo.quidProQuo1', [
    {
      id: 'ticket',
      labelKey: 'quidProQuo.label.ticket',
      label: campaignStoryText('quidProQuo.label.ticket'),
      next: 'worldMap',
      effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude26Ticket' }],
    },
    {
      id: 'supplies',
      labelKey: 'quidProQuo.label.supplies',
      label: campaignStoryText('quidProQuo.label.supplies'),
      next: 'worldMap',
      effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude26Supplies' }],
    },
    {
      id: 'intel11',
      labelKey: 'quidProQuo.label.intel11',
      label: campaignStoryText('quidProQuo.label.intel11'),
      when: { not: includes('mapVisitedLocations', 'Marrakesh') },
      next: 'interlude26Step3',
    },
  ]),
  interlude26Step2: storyNode('quidProQuo.quidProQuo2', 'interlude26Choice2'),
  interlude26Choice2: choiceNode(26, 'quidProQuo', 'quidProQuo.quidProQuo2', [
    {
      id: 'ticket',
      labelKey: 'quidProQuo.label.ticket',
      label: campaignStoryText('quidProQuo.label.ticket'),
      next: 'worldMap',
      effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude26Ticket' }],
    },
    {
      id: 'supplies',
      labelKey: 'quidProQuo.label.supplies',
      label: campaignStoryText('quidProQuo.label.supplies'),
      next: 'worldMap',
      effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude26Supplies' }],
    },
    {
      id: 'intel28',
      labelKey: 'quidProQuo.label.intel28',
      label: campaignStoryText('quidProQuo.label.intel28'),
      when: { not: includes('mapVisitedLocations', 'Havana') },
      next: 'interlude26Step4',
    },
  ]),
  interlude26Step3: storyNode('quidProQuo.quidProQuo3', 'worldMap', {
    effects: [{ type: 'record', key: 'theCellKnowsAmaranthsRealName', value: true }],
  }),
  interlude26Step4: storyNode('quidProQuo.quidProQuo4', 'worldMap', {
    effects: [{ type: 'record', key: 'theCellKnowsOfDesisPast', value: true }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 27：逝者已矣（Dead and Gone）——伦敦
// ---------------------------------------------------------------------------
const deadAndGone = {
  interlude27: interludeEntry(27, 'deadAndGone', 'deadAndGone.deadAndGone1', 'interlude27Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude27Read' }],
  }),
  interlude27Branch1: routeNode(27, 'deadAndGone', 1,
    [{ id: 'quinnDoesNotTrust', when: condition('agentQuinnDoesNotTrustTheCell'), next: 'interlude27Step2' }],
    'interlude27Step5'),
  interlude27Step2: storyNode('deadAndGone.deadAndGone2', 'interlude27Choice2'),
  interlude27Choice2: choiceNode(27, 'deadAndGone', 'deadAndGone.deadAndGone2', [
    { id: 'truth', labelKey: 'deadAndGone.label.truth', label: campaignStoryText('deadAndGone.label.truth'), next: 'interlude27Step3' },
    { id: 'secrets', labelKey: 'deadAndGone.label.secrets', label: campaignStoryText('deadAndGone.label.secrets'), next: 'interlude27Step4' },
  ]),
  interlude27Step3: storyNode('deadAndGone.deadAndGone3', 'interlude27Branch3', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude27Step3' }],
  }),
  interlude27Branch3: routeNode(27, 'deadAndGone', 3,
    [{ id: 'goOffMission', when: { all: [condition('theCellPossessesAMysteriousWhistle'), compare('time', '<=', 30)] }, next: 'interlude27Step6' }],
    'interlude27Step7'),
  interlude27Step4: storyNode('deadAndGone.deadAndGone4', 'worldMap', {
    effects: [
      { type: 'record', key: 'theFoundationRemainsInTheDark', value: true },
      { type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude27Step4' },
    ],
  }),
  interlude27Step5: storyNode('deadAndGone.deadAndGone5', 'interlude27Branch5', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude27Step5' }],
  }),
  interlude27Branch5: routeNode(27, 'deadAndGone', 5,
    [{ id: 'goOffMission', when: { all: [condition('theCellPossessesAMysteriousWhistle'), compare('time', '<=', 30)] }, next: 'interlude27Step6' }],
    'interlude27Step7'),
  interlude27Step6: storyNode('deadAndGone.deadAndGone6', 'worldMap', {
    effects: [
      { type: 'record', key: 'theCellIsOffMission', value: true },
      { type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude27Step6' },
    ],
  }),
  interlude27Step7: storyNode('deadAndGone.deadAndGone7', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude27Step7' }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 32：盘蛇（The Coiled Serpent）——上海
// ---------------------------------------------------------------------------
const coiledSerpent = {
  interlude32: interludeEntry(32, 'theCoiledSerpent', 'theCoiledSerpent.theCoiledSerpent1', 'interlude32Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude32Read' }],
  }),
  interlude32Branch1: routeNode(32, 'theCoiledSerpent', 1,
    [{ id: 'toldTheTruth', when: condition('theCellToldTheTruthToTaylor'), next: 'interlude32Step2' }],
    'interlude32Step3'),
  interlude32Step2: storyNode('theCoiledSerpent.theCoiledSerpent2', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude32FlintSolo' }],
  }),
  interlude32Step3: storyNode('theCoiledSerpent.theCoiledSerpent3', 'interlude32Choice3'),
  interlude32Choice3: choiceNode(32, 'theCoiledSerpent', 'theCoiledSerpent.theCoiledSerpent3', [
    { id: 'keepInquiring', labelKey: 'theCoiledSerpent.label.keepInquiring', label: campaignStoryText('theCoiledSerpent.label.keepInquiring'), next: 'interlude32Step4' },
    { id: 'stickAround', labelKey: 'theCoiledSerpent.label.stickAround', label: campaignStoryText('theCoiledSerpent.label.stickAround'), next: 'interlude32Step5' },
    { id: 'forgetHer', labelKey: 'theCoiledSerpent.label.forgetHer', label: campaignStoryText('theCoiledSerpent.label.forgetHer'), next: 'interlude32Step6' },
  ]),
  interlude32Step4: storyNode('theCoiledSerpent.theCoiledSerpent4', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude32FlintSolo' }],
  }),
  interlude32Step5: storyNode('theCoiledSerpent.theCoiledSerpent5', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude32AidedFlint' }],
  }),
  interlude32Step6: storyNode('theCoiledSerpent.theCoiledSerpent6', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude32FlintAbandoned' }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 36：奇异的建筑（Strange Architecture）——孟买／斯德哥尔摩
// ---------------------------------------------------------------------------
const strangeArchitecture = {
  interlude36: interludeEntry(36, 'strangeArchitecture', 'strangeArchitecture.body', 'interlude36Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude36Read' }],
  }),
  interlude36Branch1: routeNode(36, 'strangeArchitecture', 1,
    [{ id: 'inBombay', when: condition('currentLocation', 'Bombay'), next: 'interlude36Step1' }],
    'interlude36Step4'),
  interlude36Step1: storyNode('strangeArchitecture.strangeArchitecture1', 'interlude36Branch1b', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude36BombayRead' }],
  }),
  interlude36Branch1b: routeNode(36, 'strangeArchitecture', 1,
    [{ id: 'appreciated', when: condition('theCellAppreciatedTheArchitecture'), next: 'interlude36Step2' }],
    'interlude36Step3'),
  interlude36Step2: storyNode('strangeArchitecture.strangeArchitecture2', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude36Appreciated' }],
  }),
  interlude36Step3: storyNode('strangeArchitecture.strangeArchitecture3', 'worldMap', {
    effects: [{ type: 'record', key: 'theCellAppreciatedTheArchitecture', value: true }],
  }),
  interlude36Step4: storyNode('strangeArchitecture.strangeArchitecture4', 'interlude36Branch4', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude36StockholmRead' }],
  }),
  interlude36Branch4: routeNode(36, 'strangeArchitecture', 4,
    [{ id: 'appreciated', when: condition('theCellAppreciatedTheArchitecture'), next: 'interlude36Step5' }],
    'interlude36Step6'),
  interlude36Step5: storyNode('strangeArchitecture.strangeArchitecture5', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude36Appreciated' }],
  }),
  interlude36Step6: storyNode('strangeArchitecture.strangeArchitecture6', 'worldMap', {
    effects: [{ type: 'record', key: 'theCellAppreciatedTheArchitecture', value: true }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 37：特殊快递（Special Delivery）——拉各斯／东京
// ---------------------------------------------------------------------------
const specialDelivery = {
  interlude37: interludeEntry(37, 'specialDelivery', 'specialDelivery.body', 'interlude37Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude37Read' }],
  }),
  interlude37Branch1: routeNode(37, 'specialDelivery', 1, [
    { id: 'deliveringInTokyo', when: { all: [condition('theCellIsDeliveringFoundationIntel'), condition('currentLocation', 'Tokyo')] }, next: 'interlude37Step2' },
    { id: 'deliveringInLagos', when: condition('theCellIsDeliveringFoundationIntel'), next: 'interlude37Step4' },
    { id: 'notDeliveringInTokyo', when: condition('currentLocation', 'Tokyo'), next: 'interlude37Step1' },
  ], 'interlude37Step3'),
  interlude37Step1: storyNode('specialDelivery.specialDelivery1', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude37Deliver' }],
  }),
  interlude37Step2: storyNode('specialDelivery.specialDelivery2', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude37Complete' }],
  }),
  interlude37Step3: storyNode('specialDelivery.specialDelivery3', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude37Deliver' }],
  }),
  interlude37Step4: storyNode('specialDelivery.specialDelivery4', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude37Complete' }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 44：湮灭理论（Theory of Annihilation）——里约热内卢
// ---------------------------------------------------------------------------
const theoryOfAnnihilation = {
  interlude44: interludeEntry(44, 'theoryOfAnnihilation', 'theoryOfAnnihilation.theoryOfAnnihilation1', 'interlude44Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude44Read' }],
  }),
  interlude44Branch1: routeNode(44, 'theoryOfAnnihilation', 1, [
    { id: 'traveled', when: { all: [condition('theCellMetDrIrawan'), compare('time', '<', 25)] }, next: 'interlude44Step2' },
    { id: 'vanished', when: condition('theCellMetDrIrawan'), next: 'interlude44Step3' },
  ], 'interlude44Step4'),
  interlude44Step2: storyNode('theoryOfAnnihilation.theoryOfAnnihilation2', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude44Traveled' }],
  }),
  interlude44Step3: storyNode('theoryOfAnnihilation.theoryOfAnnihilation3', 'worldMap', {
    effects: [{ type: 'record', key: 'drIrawanVanishedFromExistence', value: true }],
  }),
  interlude44Step4: storyNode('theoryOfAnnihilation.theoryOfAnnihilation4', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude44Met' }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 45：蜕变（Metamorphosis）——马诺夸里
// ---------------------------------------------------------------------------
const metamorphosis = {
  interlude45: interludeEntry(45, 'metamorphosis', 'metamorphosis.metamorphosis1', 'interlude45Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude45Read' }],
  }),
  interlude45Branch1: routeNode(45, 'metamorphosis', 1, [
    { id: 'withinTenTime', when: compare('time', '<=', 'deltaDeadline'), next: 'interlude45Step2' },
  ], 'interlude45Step3'),
  interlude45Step2: storyNode('metamorphosis.metamorphosis2', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude45Intact' }],
  }),
  interlude45Step3: storyNode('metamorphosis.metamorphosis3', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude45Vanished' }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 49：空洞回响（Ringing Hollow）——悉尼
// ---------------------------------------------------------------------------
const ringingHollow = {
  interlude49: interludeEntry(49, 'ringingHollow', 'ringingHollow.body', 'interlude49Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude49Read' }],
  }),
  interlude49Branch1: routeNode(49, 'ringingHollow', 1, [
    { id: 'lessThanTwentyTime', when: compare('time', '<', 20), next: 'interlude49Step1' },
  ], 'interlude49Step4'),
  interlude49Step1: storyNode('ringingHollow.ringingHollow1', 'interlude49Branch1b', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude49Step1' }],
  }),
  interlude49Branch1b: routeNode(49, 'ringingHollow', 1, [
    { id: 'toldTheTruth', when: condition('theCellToldTheTruthToTaylor'), next: 'interlude49Step2' },
  ], 'interlude49Step3'),
  interlude49Step2: storyNode('ringingHollow.ringingHollow2', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude49QuinnTrusts' }],
  }),
  interlude49Step3: storyNode('ringingHollow.ringingHollow3', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude49QuinnDistrusts' }],
  }),
  interlude49Step4: storyNode('ringingHollow.ringingHollow4', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude49QuinnVanished' }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 50：血、汗与茶（Blood, Sweat, and Tea）——香港
// ---------------------------------------------------------------------------
const bloodSweatAndTea = {
  interlude50: interludeEntry(50, 'bloodSweatAndTea', 'bloodSweatAndTea.body', 'interlude50Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude50Read' }],
  }),
  interlude50Branch1: routeNode(50, 'bloodSweatAndTea', 1, [
    { id: 'aided', when: condition('theCellAidedInFlintsInvestigation'), next: 'interlude50Step1' },
    { id: 'withinTenTime', when: { all: [condition('flintIsWorkingSolo'), compare('time', '<=', 'psiDeadline')] }, next: 'interlude50Step2' },
  ], 'interlude50Step3'),
  interlude50Step1: storyNode('bloodSweatAndTea.bloodSweatAndTea1', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude50FlintMoved' }],
  }),
  interlude50Step2: storyNode('bloodSweatAndTea.bloodSweatAndTea2', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude50FlintMoved' }],
  }),
  interlude50Step3: storyNode('bloodSweatAndTea.bloodSweatAndTea3', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude50FlintMissing' }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 51：罗慕路斯与雷穆斯（Romulus and Remus）——罗马
// ---------------------------------------------------------------------------
const romulusAndRemus = {
  interlude51: interludeEntry(51, 'romulusAndRemus', 'romulusAndRemus.body', 'interlude51Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude51Read' }],
  }),
  interlude51Branch1: routeNode(51, 'romulusAndRemus', 1, [
    { id: 'offMission', when: condition('theCellIsOffMission'), next: 'interlude51Step1' },
  ], 'interlude51Step2'),
  interlude51Step1: storyNode('romulusAndRemus.romulusAndRemus1', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude51UnlockBermuda' }],
  }),
  interlude51Step2: storyNode('romulusAndRemus.romulusAndRemus2', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude51OnMission' }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 52：安全屋（The Safehouse）——宜博市
// ---------------------------------------------------------------------------
const theSafehouse = {
  interlude52: interludeEntry(52, 'theSafehouse', 'theSafehouse.theSafehouse1', 'interlude52Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude52Read' }],
  }),
  interlude52Branch1: routeNode(52, 'theSafehouse', 1, [
    { id: 'safehouse', when: { all: [condition('youKnowThePassphrase'), compare('time', '>=', 'thetaTime')] }, next: 'interlude52Step2' },
  ], 'interlude52Step3'),
  interlude52Step2: storyNode('theSafehouse.theSafehouse2', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude52Safehouse' }],
  }),
  interlude52Step3: storyNode('theSafehouse.theSafehouse3', 'worldMap'),
}

// ---------------------------------------------------------------------------
// 幕间 53：风中哨音（Whistle on the Wind）——加德满都
// ---------------------------------------------------------------------------
const whistleOnTheWind = {
  interlude53: interludeEntry(53, 'whistleOnTheWind', 'whistleOnTheWind.whistleOnTheWind1Part1', 'interlude53Choice', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude53Read' }],
  }),
  interlude53Choice: choiceNode(53, 'whistleOnTheWind', 'whistleOnTheWind.whistleOnTheWind1Part2', [
    { id: 'accept', labelKey: 'whistleOnTheWind.label.accept', label: campaignStoryText('whistleOnTheWind.label.accept'), next: 'interlude53Step2' },
    { id: 'reject', labelKey: 'whistleOnTheWind.label.reject', label: campaignStoryText('whistleOnTheWind.label.reject'), next: 'interlude53Step3' },
  ]),
  interlude53Step2: storyNode('whistleOnTheWind.whistleOnTheWind2', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude53Accept' }],
  }),
  interlude53Step3: storyNode('whistleOnTheWind.whistleOnTheWind3', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude53Reject' }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 54：地狱机器（Infernal Machinery）——内罗毕
// ---------------------------------------------------------------------------
const infernalMachinery = {
  interlude54: interludeEntry(54, 'infernalMachinery', 'infernalMachinery.infernalMachinery1', 'interlude54Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude54Read' }],
  }),
  interlude54Branch1: routeNode(54, 'infernalMachinery', 1,
    [{ id: 'reputation', when: sumAtLeast(INFERNAL_MACHINERY_REPUTATION_RECORDS, 3), next: 'interlude54Step2' }],
    'interlude54Step3'),
  interlude54Step2: storyNode('infernalMachinery.infernalMachinery2', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude54Ally' }],
  }),
  interlude54Step3: storyNode('infernalMachinery.infernalMachinery3', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude54Fled' }],
  }),
}

// ---------------------------------------------------------------------------
// 幕间 55：超自然选择（Paranatural Selection）——珀斯
// ---------------------------------------------------------------------------
const paranaturalSelection = {
  interlude55: interludeEntry(55, 'paranaturalSelection', 'paranaturalSelection.paranaturalSelection1', 'interlude55Branch1', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude55Read' }],
  }),
  interlude55Branch1: routeNode(55, 'paranaturalSelection', 1, [
    { id: 'traveled', when: { all: [condition('theCellMetDrIrawan'), compare('time', '<', 25)] }, next: 'interlude55Step2' },
    { id: 'vanished', when: condition('theCellMetDrIrawan'), next: 'interlude55Step3' },
  ], 'interlude55Step4'),
  interlude55Step2: storyNode('paranaturalSelection.paranaturalSelection2', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude55Traveled' }],
  }),
  interlude55Step3: storyNode('paranaturalSelection.paranaturalSelection3', 'worldMap', {
    effects: [{ type: 'record', key: 'drIrawanVanishedFromExistence', value: true }],
  }),
  interlude55Step4: storyNode('paranaturalSelection.paranaturalSelection4', 'worldMap', {
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude55Met' }],
  }),
}

// ---------------------------------------------------------------------------
// 状况报告 α–ω（参考 `CampaignSpecific "statusReport"` 的八个分支）
// ---------------------------------------------------------------------------
function statusReportNode (id) {
  return {
    type: 'story',
    // 标题 = 「状况报告 · ALPHA」；小标题直接取 story-text 的 statusReport.title（不走 titleKey，
    // 否则会把节点标题压回成「状况报告」，丢掉报告字母）。
    title: `${campaignStoryHeading('statusReport')} · ${id.toUpperCase()}`,
    textKey: `statusReport.${id}`,
    text: campaignStoryText(`statusReport.${id}`),
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'statusReport', report: id }],
    next: 'worldMap',
  }
}

export const STATUS_REPORT_NODES = Object.freeze({
  statusReportAlpha: statusReportNode('alpha'),
  statusReportEpsilon: statusReportNode('epsilon'),
  statusReportBeta: statusReportNode('beta'),
  statusReportZeta: statusReportNode('zeta'),
  statusReportGamma: statusReportNode('gamma'),
  statusReportTheta: statusReportNode('theta'),
  statusReportPsi: statusReportNode('psi'),
  statusReportOmega: statusReportNode('omega'),
})

// ---------------------------------------------------------------------------
// 世界地图密档（Foundation Dossier，14 份；「任何时候都可以阅读」）
// ---------------------------------------------------------------------------
export const DOSSIER_NODES = Object.freeze(Object.fromEntries(TSK_DOSSIER_KEYS.map(dossier => {
  const mapNode = dossier.nodes[0]
  const name = campaignStoryText(`locations.${mapNode}.name`) || mapNode
  const archive = mapNodeArchiveLabel(mapNode)
  return [dossier.stepId, {
    type: 'story',
    title: [name, archive].filter(Boolean).join(' · '),
    textKey: dossierTextKey(dossier.key),
    text: campaignStoryText(dossierTextKey(dossier.key)),
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'dossier', key: dossier.key }],
    next: 'worldMap',
  }]
})))

// ---------------------------------------------------------------------------
// 快捷旅票（09765）与绿地支线幕间
// ---------------------------------------------------------------------------
export const TRAVEL_NODES = Object.freeze({
  // 快捷旅票：放逐 1 张快捷旅票，记 1 时间直达任意目的地（参考 `travelWithTicket`）。
  // 目的地选择由世界地图面板的 `ctx.api.tsk.map` 事务完成（useExpeditedTicket），
  // 本节点只负责讲清卡面规则并记账（正文取卡表，不手写）。
  expeditedTicket: {
    type: 'story',
    title: ALL_CARDS[STORY_CARD_CODES.expeditedTicket]?.nameZh
      || ALL_CARDS[STORY_CARD_CODES.expeditedTicket]?.name || 'Expedited Ticket',
    cardCode: STORY_CARD_CODES.expeditedTicket,
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'expeditedTicket' }],
    next: 'worldMap',
  },
  // 绿地（Arkham/Cairo/Venice/NewOrleans/MonteCarlo）触发的支线幕间：
  // 支线冒险本体属于独立冒险包（不在本循环卡包），本节点只做时间与记录记账。
  sideStory: {
    type: 'story',
    title: campaignStoryHeading('headings.kind.embark') || 'Embark',
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'sideStory' }],
    next: 'worldMap',
  },
})

// ---------------------------------------------------------------------------
// 全部幕间侧节点
// ---------------------------------------------------------------------------
export const INTERLUDE_NODES = Object.freeze({
  ...foundation,
  ...ruses,
  ...greatWork,
  ...quidProQuo,
  ...deadAndGone,
  ...coiledSerpent,
  ...strangeArchitecture,
  ...specialDelivery,
  ...theoryOfAnnihilation,
  ...metamorphosis,
  ...ringingHollow,
  ...bloodSweatAndTea,
  ...romulusAndRemus,
  ...theSafehouse,
  ...whistleOnTheWind,
  ...infernalMachinery,
  ...paranaturalSelection,
  ...STATUS_REPORT_NODES,
  ...DOSSIER_NODES,
  ...TRAVEL_NODES,
})

// 幕间入口节点（世界地图触发）/ 状况报告节点 / 密档节点，供 flow.js 与验收账本读取。
export const INTERLUDE_ENTRY_IDS = Object.freeze(['interlude1', ...TSK_DOSSIER_INTERLUDE_IDS])
export const STATUS_REPORT_NODE_IDS = Object.freeze(Object.keys(STATUS_REPORT_NODES))
export const STATUS_REPORT_IDS_IN_ORDER = Object.freeze(
  STATUS_REPORT_NODE_IDS.map(nodeId => STATUS_REPORT_NODES[nodeId].effects[0].report))
export const DOSSIER_STEP_IDS = Object.freeze(TSK_DOSSIER_KEYS.map(dossier => dossier.stepId))

// ---------------------------------------------------------------------------
// 处理器
// ---------------------------------------------------------------------------
function stolenKeyEnemyText (state, log) {
  const records = recordsOf(state) || {}
  const picked = COTERIE_LAST_SEEN_RECORDS.find(entry => records[entry.record] === true)
  if (!picked) return null
  appendStory(state, campaignStoryText(`rusesAndReclamation.${picked.textKey}`))
  logLine(log, `🩸 夺走密钥的敌人：${ALL_CARDS[picked.code]?.nameZh || picked.code}。`)
  return picked
}

function recoverStolenKeys (state, log) {
  const records = recordsOf(state) || {}
  const recorded = Array.isArray(records.keysStolen) ? [...records.keysStolen] : []
  const enemyHeld = scarletKeys(state).filter(key => key.bearer.type === 'enemy')
    .map(key => `${key.id}:${key.bearer.enemyId}`)
  const stolen = [...new Set([...recorded, ...enemyHeld])]
  if (!stolen.length) {
    logLine(log, '🔑 没有被敌人夺走的绯红密钥。')
    return 0
  }
  const seat = activeInvestigatorRecords(state)[0]?.seat
  if (!Number.isInteger(seat)) return 0
  for (const entry of stolen) {
    const [keyId] = String(entry).split(':')
    try {
      stealKey(state, keyId, { type: 'investigator', seat })
      logLine(log, `🔑 追回「${ALL_CARDS[keyId]?.nameZh || keyId}」，交给 ${state.campaign.investigators[seat]?.name || `座位 ${seat}`}。`)
    } catch (error) {
      logLine(log, `⚠️ 追回密钥 ${keyId} 失败：${error.message}`)
    }
  }
  records.keysStolen = []
  syncKeyRecords(state)
  return stolen.length
}

function deliverFoundationIntel (state, log) {
  const records = recordsOf(state)
  if (records) records.theCellIsDeliveringFoundationIntel = true
  addStoryCard(state, STORY_CARD_CODES.foundationIntel, { all: true, reason: '特殊快递' }, log)
  markTime(state, 1, log)
}

function completeFoundationDelivery (state, log) {
  const records = recordsOf(state)
  if (records) {
    records.theCellIsDeliveringFoundationIntel = false
    records.foundationIntelDelivered = true
  }
  const bag = Array.isArray(state.chaosBag) ? state.chaosBag : (state.campaign.chaosBag || [])
  const faces = [...new Set(bag.filter(token => Object.hasOwn(NUMERIC_TOKEN_UPGRADE, token)))]
  if (!faces.length) {
    logLine(log, '🎲 混乱袋中没有可升级的数字标记。')
    removeStoryCard(state, STORY_CARD_CODES.foundationIntel, log)
    return null
  }
  const options = faces.map(face => ({ id: `token:${face}`, label: `${face} → ${NUMERIC_TOKEN_UPGRADE[face]}` }))
  const leadSeat = Number.isInteger(state.campaign.leadSeat)
    ? state.campaign.leadSeat
    : (activeInvestigatorRecords(state)[0]?.seat ?? 0)
  const chosen = askOptional(state, {
    kind: 'storyChoice',
    source: 'specialDelivery',
    seat: leadSeat,
    prompt: campaignStoryText('specialDelivery.label.chooseToken') || '选择要升级的混乱标记。',
    options,
  })
  const requested = String(chosen ?? '').replace(/^token:/, '')
  const picked = faces.includes(requested)
    ? requested
    : (faces.includes('0') ? '0' : faces.slice().sort((left, right) => Number(right) - Number(left))[0])
  addChaosTokens(state, picked, -1)
  addChaosTokens(state, NUMERIC_TOKEN_UPGRADE[picked], 1)
  logLine(log, `🎲 混乱袋：${picked} → ${NUMERIC_TOKEN_UPGRADE[picked]}。`)
  removeStoryCard(state, STORY_CARD_CODES.foundationIntel, log)
  return picked
}

function chooseTrauma (state, log) {
  for (const record of activeInvestigatorRecords(state)) {
    const answer = askOptional(state, {
      kind: 'storyChoice',
      source: 'whistleOnTheWind',
      seat: record.seat,
      prompt: '选择 1 点创伤：肉体或精神。',
      options: [{ id: 'physical', label: '承受 1 点肉体创伤' }, { id: 'mental', label: '承受 1 点精神创伤' }],
    })
    sufferTrauma(state, record.seat, answer === 'mental' ? 'mental' : 'physical', 1, log)
  }
}

/** 状况报告效果（参考 `CampaignSpecific "statusReport"`）。 */
function runStatusReport (state, report, log) {
  const records = recordsOf(state)
  const notes = []
  if (report === 'alpha') {
    addChaosTokens(state, 'cultist', 1)
    notes.push('混乱袋加入 1 枚 [cultist] 标记。')
  } else if (report === 'beta') {
    addChaosTokens(state, 'cultist', 1)
    notes.push('混乱袋加入 1 枚 [cultist] 标记。')
    unlockNodes(state, tskUnlockNodesFor('statusReport.beta'), log, { source: '状况报告 β' })
    notes.push('世界地图解锁通古斯卡。')
  } else if (report === 'zeta') {
    const held = scarletKeys(state).filter(key => key.bearer.type === 'investigator')
    const candidates = COTERIE_LAST_SEEN_RECORDS.filter(entry => records?.[entry.record] === true)
    const stealCount = held.length >= 5 ? 2 : 1
    if (held.length && candidates.length) {
      const thief = candidates[0]
      for (const key of held.slice(0, stealCount)) takeKeyOffscreen(state, key.id, thief.code, log)
      syncKeyRecords(state)
      notes.push(`${Math.min(stealCount, held.length)} 把密钥被红色同志会夺走（可在幕间 14 追回）。`)
    } else {
      notes.push('没有可被夺走的绯红密钥（或没有「尚未见过最后一面」的敌人）。')
    }
    unlockNodes(state, tskUnlockNodesFor('statusReport.zeta'), log, { source: '状况报告 ζ' })
    notes.push('世界地图解锁喀布尔、基多、圣胡安、雷克雅未克。')
  } else if (report === 'gamma') {
    addChaosTokens(state, 'cultist', 1)
    addStoryCard(state, STORY_CARD_CODES.paradimensionalUnderstanding, { all: true, reason: '状况报告 γ' }, log)
    notes.push('每名调查员将「跨维度理解」洗入牌组。')
  } else if (report === 'psi') {
    unlockNodes(state, tskUnlockNodesFor('statusReport.psi'), log, { source: '状况报告 ψ' })
    notes.push('世界地图解锁香港。')
  } else if (report === 'theta') {
    notes.push('θ 状况报告只讲述剧情。')
  } else if (report === 'omega') {
    addChaosTokens(state, 'cultist', 1)
    notes.push('混乱袋加入 1 枚 [cultist] 标记；时间已到，必须前往通古斯卡。')
  } else if (report === 'epsilon') {
    notes.push('红色同志会开始每关注入 1 名「恩怨未了」成员（P8 接线）。')
  }
  // 引擎状况报告队列：从未处理队列里结算，并把已读报告记进流程记录。
  try {
    resolveStatusReport(state, report, notes)
  } catch {
    // 未排队（例如直接进入节点）时仍然演出正文并记账。
  }
  unionRecord(state, 'statusReportsSeen', [report])
  if (records) records.statusReportsRead = Array.isArray(records.statusReportsSeen) ? records.statusReportsSeen.length : 0
  for (const note of notes) logLine(log, `📻 状况报告 ${report.toUpperCase()}：${note}`)
  return { report, notes }
}

// ---------------------------------------------------------------------------
// 幕间/状况报告处理器分派
// ---------------------------------------------------------------------------
export function runInterludeEffect (state, effect, log) {
  if (!state?.campaign) throw new Error('幕间效果需要 state.campaign')
  state.campaign.records ||= {}
  const records = state.campaign.records
  // 进入任何幕间/密档/状况报告前先同步地图与密钥记录（旅行刚发生在这些节点之前）。
  syncMapRecords(state)
  syncKeyRecords(state)
  const event = String(effect.event || '')
  if (/^interlude\d+/.test(event)) unionRecord(state, 'interludeVisits', [event.replace(/[A-Z].*$/, '')])

  switch (event) {
    // 幕间 1：基金会
    case 'interlude1ToldTruth':
      records.theCellToldTheTruthToTaylor = true
      if (Object.hasOwn(state.campaign.recordSchema || {}, 'tskPrologueIntent')) records.tskPrologueIntent = 'trust'
      swapChaosTokens(state, 'elderthing', 'tablet', log)
      logLine(log, '📔 在剧本日志中记录：调查员把失踪案告诉了泰勒。')
      return null
    case 'interlude1HidTruth':
      records.theCellHidTheTruthFromTaylor = true
      if (Object.hasOwn(state.campaign.recordSchema || {}, 'tskPrologueIntent')) records.tskPrologueIntent = 'deception'
      swapChaosTokens(state, 'tablet', 'elderthing', log)
      logLine(log, '📔 在剧本日志中记录：调查员对泰勒隐瞒了失踪案。')
      return null

    // 幕间 14：拨乱反正
    case 'interlude14Search': {
      const leads = Number(records.wrongLeadCount) || 0
      if (leads >= 3) {
        records.rusesFound = true
        logLine(log, '🔎 错误线索已经用尽：这次终于找对了方向。')
        return true
      }
      const found = Math.random() < 1 / (4 - leads)
      records.rusesFound = found
      logLine(log, found ? '🔎 你们在错误线索里发现了一条真线索。' : '🔎 又一条线索被证明是假的（错误线索 +1）。')
      return found
    }
    case 'interlude14RecoverKeys': {
      const enemyText = stolenKeyEnemyText(state, log)
      const recovered = recoverStolenKeys(state, log)
      const leads = Number(records.wrongLeadCount) || 0
      awardInterludeXp(state, 1 + leads, log)
      markTime(state, 1, log)
      logLine(log, `🔎 拨乱反正：追回 ${recovered} 把密钥${enemyText ? `（${ALL_CARDS[enemyText.code]?.nameZh || enemyText.code}）` : ''}。`)
      return { recovered }
    }

    // 幕间 20：伟业
    case 'interlude20Read': {
      const fled = records.tuwileMasaiFledToBermuda === true
      appendStory(state, campaignStoryText(fled ? 'theGreatWork.activity' : 'theGreatWork.noActivity'))
      return fled
    }
    case 'interlude20CountTrust': {
      const n = countRecords(state, GREAT_WORK_TRUST_RECORDS)
      appendStory(state, campaignStoryText(n >= 2 ? 'theGreatWork.proceed' : 'theGreatWork.otherwise'))
      logLine(log, `🧾 同志会信任计数：${n}/6。`)
      return n
    }
    case 'interlude20Proceed':
      awardInterludeXp(state, 3, log)
      return null
    case 'interlude20Ally':
      records.tuwileMasaiIsOnYourSide = true
      awardInterludeXp(state, 1, log)
      markTime(state, 1, log)
      chooseBearer(state, KEY_IDS_BY_NAME.theBaleEngine, log)
      return null
    case 'interlude20NoActivity':
      records.tskStartingHandBonus = 1
      logLine(log, '🃏 下一次冒险开局：每名调查员起始手牌 +1（记录 tskStartingHandBonus）。')
      return null

    // 幕间 26：交换条件
    case 'interlude26Read': {
      const inSanFrancisco = records.currentLocation === 'SanFrancisco'
      appendStory(state, campaignStoryText(inSanFrancisco ? 'quidProQuo.sanFrancisco' : 'quidProQuo.moscow'))
      return inSanFrancisco
    }
    case 'interlude26Ticket':
      addStoryCard(state, STORY_CARD_CODES.expeditedTicket, { seats: [state.campaign.leadSeat ?? 0], reason: '交换条件' }, log)
      records.expeditedTickets = Number(records.expeditedTickets || 0) + 1
      return null
    case 'interlude26Supplies':
      awardInterludeXp(state, 1, log)
      return null

    // 幕间 27：逝者已矣
    case 'interlude27Read': {
      const distrust = records.agentQuinnDoesNotTrustTheCell === true
      appendStory(state, campaignStoryText(distrust ? 'deadAndGone.noTrust' : 'deadAndGone.trust'))
      return distrust
    }
    case 'interlude27Step3': {
      records.agentQuinnDoesNotTrustTheCell = false
      swapChaosTokens(state, 'elderthing', 'tablet', log)
      for (const key of ['deadAndGone.gainTrust', 'deadAndGone.swapElderThingForTablet', 'deadAndGone.check']) {
        appendStory(state, campaignStoryText(key))
      }
      const whistle = records.theCellPossessesAMysteriousWhistle === true
      const time = Number(records.time) || 0
      const offMission = whistle && time <= 30
      appendStory(state, campaignStoryText(offMission ? 'deadAndGone.goOffMission' : 'deadAndGone.stayOnMission'))
      return offMission
    }
    case 'interlude27Step4':
      swapChaosTokens(state, 'tablet', 'elderthing', log)
      return null
    case 'interlude27Step5': {
      for (const key of ['deadAndGone.goOffMission', 'deadAndGone.stayOnMission']) {
        appendStory(state, campaignStoryText(key))
      }
      const whistle = records.theCellPossessesAMysteriousWhistle === true
      const time = Number(records.time) || 0
      return whistle && time <= 30
    }
    case 'interlude27Step6':
      awardInterludeXp(state, 1, log)
      markTime(state, 1, log)
      return null
    case 'interlude27Step7':
      awardInterludeXp(state, 2, log)
      markTime(state, 1, log)
      return null

    // 幕间 32：盘蛇
    case 'interlude32Read': {
      const truth = records.theCellToldTheTruthToTaylor === true
      appendStory(state, campaignStoryText(truth ? 'theCoiledSerpent.toldTheTruth' : 'theCoiledSerpent.hidTheTruth'))
      return truth
    }
    case 'interlude32FlintSolo': {
      records.flintIsWorkingSolo = true
      const time = Number(records.time) || 0
      const psi = Math.min(TSK_FORCED_ENDGAME_TIME, time + 6)
      records.psiTime = psi
      records.psiDeadline = psi + 10
      if (tskCampaignState(state, true)?.statusReports) setDynamicStatusReport(state, 'psi', psi)
      logLine(log, `🕵️ 福林独自行动：ψ 状况报告设在时间 ${psi}（宽限到 ${psi + 10}）。`)
      return psi
    }
    case 'interlude32AidedFlint':
      records.theCellAidedInFlintsInvestigation = true
      awardInterludeXp(state, 1, log)
      unlockNodes(state, tskUnlockNodesFor('interlude32Step5'), log, { source: '盘蛇' })
      markTime(state, 3, log)
      return null
    case 'interlude32FlintAbandoned':
      records.flintAbandonedHisSearch = true
      addStoryCard(state, STORY_CARD_CODES.inspectorFlint, { all: true, reason: '盘蛇' }, log)
      return null

    // 幕间 36：奇异的建筑
    case 'interlude36Read': {
      const inBombay = records.currentLocation === 'Bombay'
      appendStory(state, campaignStoryText(inBombay ? 'strangeArchitecture.inBombay' : 'strangeArchitecture.inStockholm'))
      return inBombay
    }
    case 'interlude36BombayRead':
    case 'interlude36StockholmRead': {
      const scope = event.includes('Bombay') ? 'strangeArchitecture.bombay' : 'strangeArchitecture.stockholm'
      const appreciated = records.theCellAppreciatedTheArchitecture === true
      appendStory(state, campaignStoryText(`${scope}.${appreciated ? 'appreciated' : 'notAppreciated'}`))
      return appreciated
    }
    case 'interlude36Appreciated':
      records.theCellAppreciatedTheArchitecture = false
      awardInterludeXp(state, 2, log)
      markTime(state, 1, log)
      return null

    // 幕间 37：特殊快递
    case 'interlude37Read': {
      const delivering = records.theCellIsDeliveringFoundationIntel === true
      const inTokyo = records.currentLocation === 'Tokyo'
      appendStory(state, campaignStoryText(delivering ? 'specialDelivery.deliveringIntel' : 'specialDelivery.notDeliveringIntel'))
      appendStory(state, campaignStoryText(delivering
        ? (inTokyo ? 'specialDelivery.deliveringIntelInTokyo' : 'specialDelivery.deliveringIntelInLagos')
        : (inTokyo ? 'specialDelivery.notDeliveringIntelInTokyo' : 'specialDelivery.notDeliveringIntelInLagos')))
      return { delivering, inTokyo }
    }
    case 'interlude37Deliver':
      deliverFoundationIntel(state, log)
      return null
    case 'interlude37Complete':
      return completeFoundationDelivery(state, log)

    // 幕间 44／55：伊拉万博士
    case 'interlude44Read':
    case 'interlude55Read': {
      const scope = event.startsWith('interlude44') ? 'theoryOfAnnihilation' : 'paranaturalSelection'
      const met = records.theCellMetDrIrawan === true
      const time = Number(records.time) || 0
      appendStory(state, campaignStoryText(`${scope}.${!met ? 'met' : time < 25 ? 'traveled' : 'vanished'}`))
      return { met, time }
    }
    case 'interlude44Traveled':
    case 'interlude55Traveled': {
      const scope = event.startsWith('interlude44') ? 'theoryOfAnnihilation' : 'paranaturalSelection'
      const unlocked = event.startsWith('interlude44')
        ? tskUnlockNodesFor('interlude44Step2')
        : tskUnlockNodesFor('interlude55Step2')
      records.drIrawanTraveledToNewGuinea = true
      awardInterludeXp(state, 1, log)
      unlockNodes(state, unlocked, log, { source: scope })
      records.deltaTime = Number(records.time) || 0
      records.deltaDeadline = (Number(records.deltaTime) || 0) + 10
      logLine(log, `🧭 δ = 时间 ${records.deltaTime}（马诺夸里的宽限到 ${records.deltaDeadline}）。`)
      return null
    }
    case 'interlude44Met':
    case 'interlude55Met':
      records.theCellMetDrIrawan = true
      awardInterludeXp(state, 1, log)
      return null

    // 幕间 45：蜕变
    case 'interlude45Read': {
      const delta = Number(records.deltaTime) || 0
      records.deltaDeadline = delta + 10
      appendStory(state, campaignStoryText((Number(records.time) || 0) <= records.deltaDeadline
        ? 'metamorphosis.tenOrLessTime'
        : 'metamorphosis.moreThanTenTime'))
      return delta
    }
    case 'interlude45Intact':
      addStoryCard(state, STORY_CARD_CODES.drIrawan, { all: true, reason: '蜕变' }, log)
      chooseBearer(state, KEY_IDS_BY_NAME.theRuinousChime, log)
      markTime(state, 1, log)
      return null
    case 'interlude45Vanished':
      records.drIrawanVanishedFromExistence = true
      awardInterludeXp(state, 2, log)
      markTime(state, 1, log)
      return null

    // 幕间 49：空洞回响
    case 'interlude49Read': {
      const time = Number(records.time) || 0
      appendStory(state, campaignStoryText(time < 20 ? 'ringingHollow.lessThanTwentyTime' : 'ringingHollow.twentyOrMoreTime'))
      return time < 20
    }
    case 'interlude49Step1': {
      const truth = records.theCellToldTheTruthToTaylor === true
      appendStory(state, campaignStoryText(truth ? 'ringingHollow.toldTheTruth' : 'ringingHollow.hidTheTruth'))
      return truth
    }
    case 'interlude49QuinnTrusts':
      unlockNodes(state, tskUnlockNodesFor('interlude49Step2'), log, { source: '空洞回响' })
      return null
    case 'interlude49QuinnDistrusts':
      records.agentQuinnDoesNotTrustTheCell = true
      unlockNodes(state, tskUnlockNodesFor('interlude49Step3'), log, { source: '空洞回响' })
      return null
    case 'interlude49QuinnVanished':
      records.agentQuinnVanishedFromExistence = true
      return null

    // 幕间 50：血、汗与茶
    case 'interlude50Read': {
      const aided = records.theCellAidedInFlintsInvestigation === true
      const solo = records.flintIsWorkingSolo === true
      const psi = Number(records.psiTime) || 0
      records.psiDeadline = psi + 10
      const time = Number(records.time) || 0
      appendStory(state, campaignStoryText(aided
        ? 'bloodSweatAndTea.aided'
        : solo && time - psi <= 10 ? 'bloodSweatAndTea.tenOrLessTime' : 'bloodSweatAndTea.moreThanTenTime'))
      return { aided, solo, time, psi }
    }
    case 'interlude50FlintMoved':
      records.flintTraveledToKualaLumpur = true
      unlockNodes(state, tskUnlockNodesFor('interlude50'), log, { source: '血、汗与茶' })
      return null
    case 'interlude50FlintMissing':
      records.agentFlintIsMissing = true
      unlockNodes(state, tskUnlockNodesFor('interlude50'), log, { source: '血、汗与茶' })
      return null

    // 幕间 51：罗慕路斯与雷穆斯
    case 'interlude51Read': {
      const offMission = records.theCellIsOffMission === true
      appendStory(state, campaignStoryText(offMission ? 'romulusAndRemus.offMission' : 'romulusAndRemus.onMission'))
      return offMission
    }
    case 'interlude51UnlockBermuda':
      unlockNodes(state, tskUnlockNodesFor('interlude51Step1'), log, { source: '罗慕路斯与雷穆斯' })
      return null
    case 'interlude51OnMission':
      records.tskStartingResourcesBonus = 1
      logLine(log, '💰 下一次冒险开局：每名调查员起始资源 +1（记录 tskStartingResourcesBonus）。')
      return null

    // 幕间 52：安全屋
    case 'interlude52Read': {
      const passphrase = records.youKnowThePassphrase === true
      const time = Number(records.time) || 0
      const theta = Number(records.thetaTime) || 0
      const safehouse = passphrase && time >= theta
      appendStory(state, campaignStoryText(safehouse ? 'theSafehouse.safehouse' : 'theSafehouse.noSafehouse'))
      return { passphrase, theta, time, safehouse }
    }
    case 'interlude52Safehouse':
      awardInterludeXp(state, 2, log)
      chooseBearer(state, KEY_IDS_BY_NAME.theMirroringBlade, log)
      markTime(state, 1, log)
      return null

    // 幕间 53：风中哨音
    case 'interlude53Read': {
      const drifter = Object.values(state.campaign.investigators || {})
        .some(record => record && record.status === 'active' && (record.traits || []).includes('Drifter'))
      if (drifter) appendStory(state, campaignStoryText('whistleOnTheWind.drifter'))
      return drifter
    }
    case 'interlude53Accept':
      records.theCellPossessesAMysteriousWhistle = true
      swapChaosTokens(state, 'elderthing', 'tablet', log)
      chooseTrauma(state, log)
      return null
    case 'interlude53Reject':
      records.theCellRefusedAlikisOffer = true
      awardInterludeXp(state, 1, log)
      swapChaosTokens(state, 'tablet', 'elderthing', log)
      return null

    // 幕间 54：地狱机器
    case 'interlude54Read': {
      const n = countRecords(state, INFERNAL_MACHINERY_REPUTATION_RECORDS)
      appendStory(state, campaignStoryText(n >= 3 ? 'infernalMachinery.reputation' : 'infernalMachinery.noReputation'))
      return n
    }
    case 'interlude54Ally':
      records.tuwileMasaiIsOnYourSide = true
      awardInterludeXp(state, 1, log)
      chooseBearer(state, KEY_IDS_BY_NAME.theBaleEngine, log)
      markTime(state, 1, log)
      return null
    case 'interlude54Fled':
      records.tuwileMasaiFledToBermuda = true
      return null

    // 状况报告
    case 'statusReport':
      return runStatusReport(state, String(effect.report || ''), log)

    // 密档（Foundation Dossier）
    case 'dossier': {
      const key = String(effect.key || '')
      if (!key) throw new Error('密档效果缺少 key')
      appendStory(state, campaignStoryText('worldMap.dossierHeading'))
      unlockDossier(state, key)
      readDossier(state, key)
      logLine(log, `🗂️ 阅读密档：${key}（已读 ${dossiers(state).read.length} 份）。`)
      return key
    }

    // 快捷旅票
    case 'expeditedTicket': {
      const card = ALL_CARDS[STORY_CARD_CODES.expeditedTicket]
      const text = card?.textZh || card?.text || ''
      appendStory(state, text)
      logLine(log, `🎫 ${card?.nameZh || card?.name || '快捷旅票'}：${text}`)
      records.expeditedTickets = Number(records.expeditedTickets || 0)
      return STORY_CARD_CODES.expeditedTicket
    }

    // 绿地支线幕间（支线冒险本体在范围外的独立冒险包）
    case 'sideStory': {
      const node = records.currentLocation || currentMapNode(state) || 'sideStory'
      completeSideStory(state, node)
      unionRecord(state, 'sideStoriesCompleted', [node])
      logLine(log, `🌿 支线幕间：${node}（支线冒险本体由独立冒险包提供，本循环只记时间与记录）。`)
      return node
    }
  }
  throw new Error(`未知幕间效果：${event}`)
}

registerCampaignEffectHandler(INTERLUDE_HANDLER_ID, runInterludeEffect)
