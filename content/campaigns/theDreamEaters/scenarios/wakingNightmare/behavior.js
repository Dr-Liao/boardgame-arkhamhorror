// 清醒噩梦（Waking Nightmare · 06063）· 引擎钩子（章节流程 + 蛛群滋生袋机械）。
//
// 约定：
//   · `export const behavior = { ...encounterRules, id: 'wakingNightmare', ... }`；覆盖共享钩子时
//     必须在函数体里显式转发 `encounterRules.<hook>(...)`（否则其它 TDE 章的共享组静默失效）。
//   · 逐卡规则在各单卡条目的 enemyScript / actRule / agendaRule / locationRule / flags；
//     behavior 只做分派与本章专属机械（滋生袋、蛛巢、护工替换、结局记录），不按卡号写分支。
//   · 内容层（behavior）允许直接读写 state（卡条目禁止）；卡条目只拿 ctx.api。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, enemyScriptFor, entryFlags, locationRuleFor, treacheryRuleFor,
} from '../../../../../src/cards/card-rules.js'
import { encounterRules, activeInvestigators, original, here } from '../../encounter-rules.js'
import { hardSide } from '../../tde-chaos.js'
import {
  WAKING_NIGHTMARE_TOKEN_MEANINGS, wakingNightmareChaosToken, wakingNightmareChaosAfterTest,
} from './chaos.js'
import { DR_MAHESWARAN, INFESTATION_BEGINS, OUTBREAK, RANDOLPH_CARTER, SET_ASIDE_ALIASES, SET_ASIDE_LOCATIONS, SUSPICIOUS_ORDERLY, RAW_CODES as RAW } from './definition.js'

const CHAPTER_ID = 'wakingNightmare'
const INFESTATION_BAG = 'infestation'
const SPIDER_TRAIT = 'spider'
const BASEMENT_TRAIT = 'basement'

const codeOf = card => original(card)
const locationOf = (state, inv) => (state.locations || []).find(location => location.id === inv?.location) || null
const isInfested = (state, locationId) => (state.infestedLocations || []).map(String).includes(String(locationId))
const infestedLocationIds = state => (state.infestedLocations || []).map(String)
const traitsOf = card => (ALL_CARDS[codeOf(card)]?.traits || card?.traits || [])
  .map(trait => String(trait).toLowerCase())
const hasTrait = (card, trait) => traitsOf(card).includes(String(trait).toLowerCase())
const isSpiderEnemyCode = code => ALL_CARDS[code]?.type === 'enemy' && (ALL_CARDS[code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === SPIDER_TRAIT)
const locationIdOfCode = (state, code) => Object.entries(state.scenario?.locations || {})
  .find(([, definition]) => codeOf(definition) === code)?.[0] || null
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const leadSeat = state => Number(state.campaign?.leadSeat ?? 0)

// 结局里的「是否双线互联」：TDE 的八章战役由战役层记 mode；单线时该记录不写。
const isInterconnected = state => ['pick', 'parallel'].includes(String(state.campaign?.mode || ''))

// ---------------------------------------------------------------------------
// 蛛群滋生袋（06078 的 flags：袋内容/标记效果；机械在本文件），infestation test 的唯一实现。
// ---------------------------------------------------------------------------
const processedAfterTests = new WeakSet()

function ensureInfestationBag(state, api) {
  const flags = entryFlags(INFESTATION_BEGINS) || {}
  const bag = flags.infestationBag || { id: INFESTATION_BAG, tokens: ['skull', 'tablet', 'tablet', 'tablet', 'tablet', 'cultist', 'cultist'] }
  const info = api.tokenBag?.info?.(bag.id)
  if (!info || info.exists !== true) {
    api.tokenBag?.create?.(bag.id, bag.tokens)
    api.info?.('🕷️ 建立蛛群滋生袋（骷髅×1、石板×4、异教徒×2）。')
  }
  return bag.id
}

function setAsideTokenBag(state, api) {
  const bagId = ensureInfestationBag(state, api)
  const info = api.tokenBag.info(bagId)
  return { bagId, revealed: Array.isArray(info.revealed) ? [...info.revealed] : [] }
}

// 与寄生地点相邻、且尚未寄生/没有恐惧标记的地点（卡面 [cultist] 的合法目标）。
function adjacentNonInfested(state) {
  const out = []
  for (const location of state.locations || []) {
    if (!isInfested(state, location.id)) continue
    for (const connection of location.connections || []) {
      const target = state.locations.find(entry => entry.id === connection)
      if (!target || isInfested(state, target.id)) continue
      if ((target.horror || 0) > 0) continue
      if (!out.some(entry => entry.id === target.id)) out.push(target)
    }
  }
  return out
}

function nearestInfestedLocation(state, api) {
  const infested = infestedLocationIds(state)
  if (!infested.length) return null
  let best = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const inv of activeInvestigators(state)) {
    if (!inv.location) continue
    const distance = api.locationDistance?.(inv.location, infested)
    if (typeof distance === 'number' && distance >= 0 && distance < bestDistance) {
      bestDistance = distance
      best = inv.location
    }
  }
  if (bestDistance === Number.POSITIVE_INFINITY) return infested[0]
  // 从调查员位置沿最短路找到第一个寄生地点。
  let current = best
  const seen = new Set([current])
  while (current && !infested.includes(String(current))) {
    const location = state.locations.find(entry => entry.id === current)
    const next = (location?.connections || []).find(id => !seen.has(id) && state.locations.some(entry => entry.id === id))
    if (!next) break
    seen.add(next)
    current = next
  }
  return infested.includes(String(current)) ? String(current) : infested[0]
}

// 从遭遇牌库/弃牌堆找 1 个蜘蛛敌人（先牌库顶、再弃牌堆），移出对应堆。
function takeSpiderEnemyCard(state) {
  for (let index = state.encounterDeck.length - 1; index >= 0; index -= 1) {
    if (!isSpiderEnemyCode(state.encounterDeck[index])) continue
    const [code] = state.encounterDeck.splice(index, 1)
    return code
  }
  for (let index = state.encounterDiscard.length - 1; index >= 0; index -= 1) {
    if (!isSpiderEnemyCode(state.encounterDiscard[index])) continue
    const [code] = state.encounterDiscard.splice(index, 1)
    return code
  }
  return null
}

/**
 * 蛛群滋生检定（卡面 06078 的另一面）：
 *   [skull] 从遭遇牌库/弃牌堆找 1 个[[蜘蛛]]敌人生成在「离任一调查员最近的寄生地点」；
 *   [tablet] 无事；
 *   [cultist] 选一个与寄生地点相邻的地点变为寄生；若已放置 2 个 [cultist] 则把所有滋生标记放回袋。
 * 揭示出的标记留在 tokenBag 的 revealed 区（= 卡面「放在一边」），直到 [cultist] 重置。
 */
function runInfestationTest(state, seat, api, options = {}) {
  const depth = Number(state.scenarioFlags?.infestationTestDepth || 0)
  if (depth > 4) {
    api.info?.('🕷️ 滋生检定嵌套过深，跳过（防止递归）。')
    return
  }
  state.scenarioFlags ||= {}
  state.scenarioFlags.infestationTestDepth = depth + 1
  try {
    const { bagId } = setAsideTokenBag(state, api)
    const token = api.tokenBag?.reveal?.(bagId)
    if (!token) {
      api.info?.('🕷️ 滋生袋已空：没有标记可揭示。')
      return
    }
    const tester = state.investigators?.[seat] || activeInvestigators(state)[0] || null
    const label = api.tokenLabel?.(token) || token
    // 06080 的反应：持有者可以把这张卡移出游戏来取消标记并放回袋。
    const canceller = tester && (tester.assets || []).find(asset =>
      (entryFlags(codeOf(asset))?.cancelInfestationToken || []).includes(token))
    if (canceller) {
      const answer = api.choice?.({
        kind: 'reaction', source: codeOf(canceller), seat: tester.seat,
        prompt: `滋生检定揭示了「${label}」。是否把「席瓦妮·马斯沃伦医生」移出游戏以取消该标记并放回滋生袋？`,
        options: [{ id: 'cancel', label: '移出游戏并放回标记' }, { id: 'skip', label: '不取消' }],
      })
      if (answer === 'cancel') {
        api.removeAsset?.(tester.seat, canceller.id)
        api.tokenBag?.return?.(bagId, token)
        api.info?.(`🩺 席瓦妮·马斯沃伦医生移出游戏：取消「${label}」并放回滋生袋。`)
        return
      }
    }
    // Outbreak 在寄生地点把每个 tablet 当 skull 结算。
    const face = options.treatTabletAsSkull === true && token === 'tablet' ? 'skull' : token
    api.info?.(`🕷️ 蛛群滋生检定：${tester?.name || '调查员'} 揭示「${api.tokenLabel?.(face) || face}」。`)
    if (face === 'skull') {
      const code = takeSpiderEnemyCard(state)
      const targetLocation = nearestInfestedLocation(state, api)
      if (!code || !targetLocation) {
        api.info?.(!code
          ? '🕷️ 遭遇牌库与弃牌堆里没有蜘蛛敌人。'
          : '🕷️ 场上没有寄生地点，蜘蛛敌人无处生成。')
        return
      }
      const enemy = api.spawn?.(code, targetLocation)
      api.info?.(`🕷️ 「${ALL_CARDS[code]?.nameZh || code}」生成在离调查员最近的寄生地点「${api.locName?.(targetLocation) || targetLocation}」${enemy ? '' : '（生成失败）'}。`)
      return
    }
    if (face === 'cultist') {
      const candidates = adjacentNonInfested(state)
      if (!candidates.length) {
        api.info?.('🕷️ 没有可蔓延的相邻地点。')
      } else {
        const answer = api.choice?.({
          kind: 'location', source: INFESTATION_BEGINS, seat,
          prompt: '选择与寄生地点相邻的地点：该地点变为寄生。',
          options: candidates.map(entry => ({ id: entry.id, label: entry.name || entry.id })),
        })
        const chosen = candidates.find(entry => entry.id === String(answer)) || candidates[0]
        api.tokenBag?.markInfested?.(chosen.id)
        api.info?.(`🕷️ 蛛群蔓延：「${chosen.name || chosen.id}」成为寄生地点。`)
        // 地点条目声明「变成寄生后」的强制：梯井（06074）→ 再来一次滋生检定。
        const rule = locationRuleFor(codeOf(chosen))
        if (rule?.infestationTestOnInfest || entryFlags(codeOf(chosen))?.infestationTestOnInfest) {
          api.info?.(`🕷️ 「${chosen.name || chosen.id}」变成寄生地点：再进行一次蛛群滋生检定。`)
          runInfestationTest(state, seat, api, options)
        }
      }
      // 「若已放置 2 个 [cultist]：把所有放在一边的滋生标记放回袋」。
      const revealed = api.tokenBag.info(bagId).revealed || []
      if (revealed.filter(value => value === 'cultist').length >= 2) {
        for (const value of [...revealed]) api.tokenBag?.return?.(bagId, value)
        api.info?.('🕷️ 已放置 2 个异教徒标记：所有放在一边的滋生标记放回滋生袋。')
      }
    }
  } finally {
    state.scenarioFlags.infestationTestDepth = Math.max(0, (Number(state.scenarioFlags.infestationTestDepth) || 1) - 1)
  }
}

// ---------------------------------------------------------------------------
// 06078 故事卡结算：放伤害标记（= 寄生）+ 建袋 + 翻面。
// 由议程 06064 的 agenda.chapterFlow === 'theInfestationBegins' 触发（definition 的 AGENDA_EXTRA）。
// ---------------------------------------------------------------------------
function resolveInfestationBegins(state, api) {
  api.cardReveal?.(INFESTATION_BEGINS, '蛛群入侵')
  const counts = state.investigators.length >= 3 ? 2 : 1
  const withClues = [...(state.locations || [])]
    .filter(location => location.revealed !== false)
    .sort((left, right) => (Number(right.clues) || 0) - (Number(left.clues) || 0))
  const targets = withClues.slice(0, counts)
  for (const location of targets) {
    api.tokenBag?.markInfested?.(location.id)
    api.info?.(`🕷️ 蛛群入侵：在「${location.name || location.id}」放置 1 个伤害标记（寄生地点）。`)
  }
  const bagId = ensureInfestationBag(state, api)
  api.tokenBag?.create?.(bagId, (entryFlags(INFESTATION_BEGINS)?.infestationBag?.tokens)
    || ['skull', 'tablet', 'tablet', 'tablet', 'tablet', 'cultist', 'cultist'])
  api.info?.('🕷️ 蛛群入侵：建立独立滋生袋，并翻到背面（滋生检定结果表）。')
  api.setScenarioFlag?.('theInfestationBegins', true)
}

// ---------------------------------------------------------------------------
// 06065 背面：把场上的「可疑的护工」替换为「堕落的护工」（保留游戏状态）。
// 卡条目只写 api 化部分并置 needsOrderlyReplacement；敌人类实例的改写在本文件完成。
// ---------------------------------------------------------------------------
function replaceSuspiciousOrderlies(state, api) {
  const orderlies = (state.enemies || []).filter(enemy => codeOf(enemy) === SUSPICIOUS_ORDERLY)
  for (const enemy of orderlies) {
    enemy.code = RAW.c06082
    enemy.originalCode = RAW.c06082
    const definition = state.scenario?.enemies?.[RAW.c06082] || {}
    if (definition.name) enemy.name = definition.name
    for (const key of ['fight', 'evade', 'health', 'damage', 'horror']) {
      if (definition[key] != null) enemy[key] = definition[key]
    }
    api.info?.(`🕷️ 「可疑的护工」被替换为「堕落的护工」（保留其游戏状态）。`)
  }
}

// ---------------------------------------------------------------------------
// 章节钩子
// ---------------------------------------------------------------------------
export const scenarioApproximations = Object.freeze([
  '06071 急救病房「每投入 1 张牌难度 +1」：引擎的检定难度在检定开始时固定，没有「投入后难度重算」读点；'
    + 'behavior 在 beforeCommitCard 里递增 state.skillTest.difficulty（揭示符号标记的检定会在符号窗口回读该值），'
    + '无符号标记的检定可能仍按初始难度结算。',
  '06072 实验疗法病房的反应改为「调查行动开始前询问」（引擎没有调查内的可选反应读点），本次调查结束由 behavior.afterInvestigate 清除。',
  '06073 档案室「一次一个进行 4 次调查」按连续结算近似（引擎没有 4 次调查之间的行动窗口）。',
  '06078 的「地点上的伤害标记」用 P3 原语 tokenBag 的 infestedLocations 承载（不在地点实例上放 damage 标记）；'
    + '「伤害标记→恐惧标记」的封印在 06069 的前排能力里用清除寄生 + scenarioFlags.sealedRifts 近似。',
  '06080 的 [fast] 自动躲避与滋生标记取消是条目 flags + 本文件接线（storyAsset scope 不能声明 free 能力）。',
  '06081「不能攻击/不能被攻击/不能被伤害/不能被击败」是条目 flags + 本文件接到引擎的 enemyCannotAttack / '
    + 'enemyCannotBeAttacked / enemyDamageAllowed / enemyCanBeDefeated / investigationError 读点。',
  '06082「在寄生地点受到伤害时取消 1 点」在 enemyDamaged 钩子里用 api.healEnemy(enemy, 1) 撤回 1 点伤害。',
])

export const scenarioGaps = Object.freeze([
  '「寄生地点上的伤害标记」与「封印后替换为恐惧标记」的可见面板属 P5/P9；本层只维护 tokenBag 的寄生状态与 scenarioFlags.sealedRifts。',
])

// 本章单卡条目的原卡号（审计/覆盖用；剧本参考卡 06063 与背面故事面 06057b/06058b 不建条目）。
export const implementedEncounterCodes = Object.freeze([
  RAW.c06064, RAW.c06065, RAW.c06066, RAW.c06067, RAW.c06068, RAW.c06069,
  RAW.c06070, RAW.c06071, RAW.c06072, RAW.c06073, RAW.c06074, RAW.c06075, RAW.c06076, RAW.c06077,
  RAW.c06078, RAW.c06079, RAW.c06080, RAW.c06081, RAW.c06082, RAW.c06083,
])

export const behavior = {
  ...encounterRules,
  id: CHAPTER_ID,
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps,

  // ---- 开局：介绍（医生是否同行）+ 地点/放一边/在 play 的剧情支援 ----
  preScenarioSetup(state, events, api) {
    const flags = (state.scenarioFlags ||= {})
    const records = recordsFor(state)
    if (flags.introResolved) return
    flags.introResolved = true
    const seat = leadSeat(state)
    if (!state.campaign.mode && state.campaign.parts) state.campaign.mode = 'pick'
    const answer = api.choose({
      kind: 'story', source: '06063-intro', seat,
      prompt: '介绍 1：要说服马赫斯瓦兰医生怎么做？',
      options: [
        { id: 'bringDoctor', label: '说服她与你们一同调查（她的人身安全与你们绑在一起）' },
        { id: 'leaveDoctor', label: '说服她留在病人身边照看他们' },
      ],
    })
    if (answer === 'leaveDoctor') {
      records.drMaheswaranStayedWithHerPatients = true
      flags.drMaheswaranJoined = false
      api.info?.('🩺 记录：马赫斯瓦兰医生留在病人身边（Intro 3）。')
      return
    }
    records.drMaheswaranJoinedTheInvestigation = true
    flags.drMaheswaranJoined = true
    api.info?.('🩺 记录：马赫斯瓦兰医生加入调查（Intro 2）。')
    // 已在场的调查员已经准备好；直接把她放到队长控制下（剧情支援资产）。
    api.giveAsset?.(seat, DR_MAHESWARAN)
  },

  setupLocations(state, events, helper = {}) {
    const zones = (state.scenarioZones ||= {})
    const flags = (state.scenarioFlags ||= {})
    const locationCodes = SET_ASIDE_LOCATIONS
      .map(id => codeOf(state.scenario.locations?.[id]))
      .filter(Boolean)
    zones.setAside = [...locationCodes, ...SET_ASIDE_ALIASES]
    zones.removed = []
    state.infestedLocations = []
    state.tokenBags ||= {}
    flags.sealedRifts = {}
    flags.encounterDeckReady = true
    // 若开局没有医生同行记录，也把她放一边（setup 文本：留在病人身边 → 放一边）。
    if (flags.drMaheswaranJoined !== true && !zones.setAside.includes(DR_MAHESWARAN)) {
      zones.setAside.push(DR_MAHESWARAN)
    }
    helper.info?.('🏥 清醒噩梦：候诊室、急救病房、实验疗法病房、档案室入场；其余地点与指定卡牌放在一边。')
    return ['waitingRoom', 'emergencyRoom', 'experimentalTherapiesWard', 'recordsOffice']
  },

  setupEnemies() {},

  // ---- 幕背面：06067 的「放梯井/地下室的门 + 检查议程」流程 ----
  actReveal(state, act, api) {
    const code = codeOf(act)
    const chapterFlow = act.chapterFlow || actRuleFor(code)?.chapterFlow || null
    if (chapterFlow === 'lookingForAnswers') {
      for (const [id, definition] of Object.entries(state.scenario?.locations || {})) {
        const original = codeOf(definition)
        if (![RAW.c06074, RAW.c06075, RAW.c06076, RAW.c06077].includes(original)) continue
        api.takeFromSetAside?.(original)
        api.place?.(id)
      }
      const agendaStep = (Number(state.agendaIndex) || 0) + 1
      if (agendaStep === 1) {
        api.info?.('🕷️ 「寻求答案」背面：当前是议程 1，立即推进到议程 2。')
        api.advanceAgenda?.()
      } else {
        api.info?.('🕷️ 「寻求答案」背面：当前是议程 2/3，进行一次蛛群滋生检定。')
        runInfestationTest(state, leadSeat(state), api)
      }
      return true
    }
    const rule = actRuleFor(code)
    return rule?.onReveal ? rule.onReveal(state, act, api) : undefined
  },

  agendaReveal(state, agenda, api) {
    const code = codeOf(agenda)
    const rule = agendaRuleFor(code, CHAPTER_ID)
    rule?.onReveal?.(state, agenda, api)
    // 06065 背面：条目把「替换护工」置成标记，敌人类实例的改写由本文件完成（卡条目禁止写敌人实例）。
    const flags = (state.scenarioFlags ||= {})
    if (flags.needsOrderlyReplacement) {
      replaceSuspiciousOrderlies(state, api)
      delete flags.needsOrderlyReplacement
    }
    const chapterFlow = agenda.chapterFlow || null
    if (chapterFlow === 'theInfestationBegins') resolveInfestationBegins(state, api)
    return true
  },

  agendaForced(state, when, api, forcedType) {
    const agenda = state.agendas?.[state.agendaIndex]
    if (!agenda) return undefined
    return agendaRuleFor(codeOf(agenda), CHAPTER_ID)?.forced?.[when]?.(state, agenda, api, forcedType)
  },

  // ---- 幕目标：数据驱动（条目 actRule.objective；引擎原生 clues/enterLocation 不在这里重复） ----
  checkObjectives(state, api) {
    const act = state.acts?.[state.actIndex]
    if (!act) return
    const objective = actRuleFor(codeOf(act))?.objective
    if (!objective) return
    if (objective.type === 'controlsStoryAsset') {
      const controlled = state.investigators.some(inv =>
        (inv.assets || []).some(asset => codeOf(asset) === objective.originalCode))
      if (controlled) api.advanceAct?.()
      return
    }
    if (objective.type === 'noInfestedLocations') {
      if ((state.infestedLocations || []).length === 0) api.advanceAct?.()
    }
  },

  // ---- 玩家行动：本章 action = 地点条目行动 + 缠身护工的封印裂隙 + 医生的 [fast] 自动躲避 ----
  actions(state, inv) {
    const moves = encounterRules.actions?.(state, inv) || []
    const act = state.acts?.[state.actIndex]
    const rule = act ? actRuleFor(codeOf(act)) : null
    if (rule?.grantSealRiftAction && isInfested(state, inv.location)) {
      moves.push({
        action: 'scenarioAction', rule: 'sealRift', actions: 1,
        label: '🕳️ 封印裂隙：检定意志(X=本地点帷幕)；本地调查员可团队花费线索自动成功',
      })
    }
    const location = here(state, inv)
    if (location) locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
    if (inv.assets?.some(asset => entryFlags(codeOf(asset))?.fastAutoEvadeOrderly)) {
      const target = (state.enemies || []).find(enemy => enemy.engagedSeat === inv.seat
        && hasTrait(enemy, 'humanoid') && traitsOf(enemy).includes('staff') && codeOf(enemy) === SUSPICIOUS_ORDERLY)
      if (target) {
        moves.push({
          action: 'scenarioAction', rule: 'shivaniEvade', actions: 0, fast: true,
          label: '🩺 横置席瓦妮·马斯沃伦医生：自动躲避与你交战的可疑的护工',
        })
      }
    }
    return moves
  },

  fastActions(state, inv) {
    const moves = []
    const location = here(state, inv)
    if (location) locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
    if (inv.assets?.some(asset => entryFlags(codeOf(asset))?.fastAutoEvadeOrderly)) {
      const engaged = (state.enemies || []).some(enemy => enemy.engagedSeat === inv.seat)
      if (engaged) {
        moves.push({
          action: 'scenarioAction', rule: 'shivaniEvade', actions: 0, fast: true,
          label: '🩺 横置席瓦妮·马斯沃伦医生：自动躲避与你交战的可疑的护工',
        })
      }
    }
    return moves.filter(move => move.actions === 0 && move.fast === true)
  },

  performAction(state, inv, move, api) {
    if (move.rule === 'sealRift') {
      const location = locationOf(state, inv)
      if (!location) return
      const shroud = Number(location.shroud || 0) + Number(location.shroudMod || 0) + Number(state.fogMod || 0)
      const required = Math.max(1, Number(state.numInvestigators) || 1)
      const hereInvestigators = activeInvestigators(state).filter(entry => entry.location === location.id)
      const teamClues = hereInvestigators.reduce((sum, entry) => sum + (entry.clues || 0), 0)
      let autoSuccess = false
      if (teamClues >= required) {
        const answer = api.choose?.({
          kind: 'story', source: RAW.c06069, seat: inv.seat,
          prompt: `是否由本地点的调查员团队支付 ${required} 个线索以自动成功？`,
          options: [{ id: 'pay', label: `支付 ${required} 个线索` }, { id: 'skip', label: '改为检定' }],
        })
        if (answer === 'pay') {
          api.payClues?.(required, location.id)
          autoSuccess = true
        }
      }
      if (autoSuccess) {
        api.tokenBag?.clearInfested?.(location.id)
        state.scenarioFlags.sealedRifts ||= {}
        state.scenarioFlags.sealedRifts[location.id] = true
        api.info?.(`🕳️ ${inv.name} 团队支付线索封印了「${location.name || location.id}」的裂隙。`)
        return
      }
      api.test?.(inv.seat, 'willpower', shroud, result => {
        if (!result.success) return
        api.tokenBag?.clearInfested?.(location.id)
        state.scenarioFlags.sealedRifts ||= {}
        state.scenarioFlags.sealedRifts[location.id] = true
        api.info?.(`🕳️ ${inv.name} 封印了「${location.name || location.id}」的裂隙（伤害标记→恐惧标记）。`)
      })
      return
    }
    if (move.rule === 'shivaniEvade') {
      const asset = (inv.assets || []).find(entry => entryFlags(codeOf(entry))?.fastAutoEvadeOrderly)
      const target = (state.enemies || []).find(enemy => enemy.engagedSeat === inv.seat
        && codeOf(enemy) === SUSPICIOUS_ORDERLY)
      if (!asset || !target) return
      asset.exhausted = true
      api.evadeEnemy?.(target)
      api.info?.('🩺 席瓦妮·马斯沃伦医生自动躲避了可疑的护工。')
      return
    }
    const location = here(state, inv)
    if (location && locationRuleFor(codeOf(location))?.performAction?.(state, inv, move, api)) return
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知清醒噩梦行动：${move.rule}`)
  },

  // ---- 遭遇行动：威胁区摆脱 + 敌人条目（谈判/遭遇行动） ----
  encounterActions(state, inv) {
    const moves = encounterRules.encounterActions?.(state, inv) || []
    for (const enemy of (state.enemies || []).filter(entry => entry.location === inv.location)) {
      const action = enemyScriptFor(codeOf(enemy))?.encounterAction?.(state, inv, enemy)
      if (action) moves.push(action)
    }
    return moves
  },

  performEncounterAction(state, inv, move, api) {
    if (move.enemyId) {
      const enemy = (state.enemies || []).find(entry => entry.id === move.enemyId && entry.location === inv.location)
      const handler = enemy ? enemyScriptFor(codeOf(enemy))?.performEncounterAction : null
      if (enemy && typeof handler === 'function') return handler(state, inv, enemy, move, api) === true
      return false
    }
    return encounterRules.performEncounterAction?.(state, inv, move, api) === true
  },

  // ---- 诡计结算：数据声明「滋生检定」的诡计（Outbreak 06083）走本文件，其余转发共享 ----
  resolveEncounter(state, inv, treachery, api) {
    const code = codeOf(treachery)
    const rule = treacheryRuleFor(code)
    if (rule?.infestationTest) {
      const treatTabletAsSkull = rule.treatTabletAsSkullAtInfested === true && isInfested(state, inv.location)
      runInfestationTest(state, inv.seat, api, { treatTabletAsSkull })
      return false
    }
    return encounterRules.resolveEncounter(state, inv, treachery, api)
  },

  // ---- 敌人阶段 / 神话阶段 / 回合末 ----
  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
  },
  enemyMoved(state, enemy, locationArg, api, previousArg) {
    encounterRules.enemyMoved?.(state, enemy, locationArg, api, previousArg)
  },
  enemyPhaseStart(state, api) {
    encounterRules.enemyPhaseStart?.(state, api)
  },
  enemyPhaseEnd(state, api) {
    encounterRules.enemyPhaseEnd?.(state, api)
  },
  enemyDefeated(state, enemy, api) {
    return encounterRules.enemyDefeated?.(state, enemy, api)
  },
  enemyDamaged(state, enemy, api, seat, source) {
    encounterRules.enemyDamaged?.(state, enemy, api, seat, source)
    if (entryFlags(codeOf(enemy))?.cancelOneDamageAtInfestedLocation && isInfested(state, enemy.location)) {
      api.healEnemy?.(enemy, 1)
      api.info?.(`🕷️ 「${enemy.name || codeOf(enemy)}」在寄生地点受到伤害：取消其中 1 点。`)
    }
  },
  mythosEnded(state, api) {
    encounterRules.mythosEnded?.(state, api)
    const agenda = state.agendas?.[state.agendaIndex]
    const rule = agenda ? agendaRuleFor(codeOf(agenda), CHAPTER_ID) : null
    if (rule?.mythosEndInfestationTest) {
      api.info?.('🕷️ 神话阶段结束：进行一次蛛群滋生检定。')
      runInfestationTest(state, leadSeat(state), api)
    }
  },
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
  },
  turnBegins(state, inv, api) {
    encounterRules.turnBegins?.(state, inv, api)
    const location = locationOf(state, inv)
    if (location) locationRuleFor(codeOf(location))?.onTurnBegins?.(state, inv, location, api)
  },

  // ---- 检定后：[cultist] 补滋生检定；共享 afterTest 转发 ----
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    if (!result || processedAfterTests.has(result)) return
    processedAfterTests.add(result)
    if (wakingNightmareChaosAfterTest(state, inv, result)) {
      api.info?.('🕷️ [cultist]：议程 2/3，补一次蛛群滋生检定。')
      runInfestationTest(state, inv?.seat ?? leadSeat(state), api)
    }
  },

  resolveChaosToken(state, inv, token) {
    return wakingNightmareChaosToken(state, inv, token)
  },

  // ---- 调查封锁 / 地点揭示 / 进入 / 离开 ----
  investigationError(state, inv, location) {
    const blocker = (state.enemies || []).find(enemy => enemy.engagedSeat === inv?.seat
      && (entryFlags(codeOf(enemy))?.blocksInvestigationWhileEngaged === true)
      && enemy.location === inv.location)
    if (blocker) return '「可疑的护工」与你交战：你不能调查。'
    return locationRuleFor(codeOf(location))?.investigationError?.(state, location, inv)
  },

  cluesRemoved(state, location, amount, api) {
    if (!location || (amount || 0) <= 0) return
    locationRuleFor(codeOf(location))?.cluesRemoved?.(state, location, amount, api)
    if (entryFlags(codeOf(location))?.infestationTestWhenCluesEmpty && Number(location.clues || 0) === 0) {
      api.info?.(`🕷️ 「${location.name || location.id}」最后的线索被发现：进行一次蛛群滋生检定。`)
      runInfestationTest(state, Number(state.currentSeat) || leadSeat(state), api)
    }
  },

  locationEntered(state, inv, location, api) {
    const previousBySeat = (state.scenarioFlags ||= {}).previousBySeat || {}
    const previous = previousBySeat[inv.seat] || null
    delete previousBySeat[inv.seat]
    const previousLocation = (state.locations || []).find(entry => entry.id === previous) || null
    const rule = locationRuleFor(codeOf(location))
    if (rule?.enterFromNonBasementToBasement || entryFlags(codeOf(location))?.enterFromNonBasementToBasement) {
      const fromBasement = previousLocation ? traitsOf(previousLocation).includes(BASEMENT_TRAIT) : false
      if (previous && !fromBasement) {
        const basements = state.locations.filter(entry => traitsOf(entry).includes(BASEMENT_TRAIT))
        if (basements.length) {
          const answer = api.choice?.({
            kind: 'location', source: RAW.c06074, seat: inv.seat,
            prompt: '梯井：从非地下室地点进入后，移动到一个地下室地点。',
            options: basements.map(entry => ({ id: entry.id, label: entry.name || entry.id })),
          })
          const target = basements.find(entry => entry.id === String(answer)) || basements[0]
          state.scenarioFlags.enteringFromStairwell = true
          api.moveInvestigator?.(inv.seat, target.id)
          state.scenarioFlags.enteringFromStairwell = false
          api.test?.(inv.seat, 'agility', 4, result => {
            if (!result.success) api.damage?.(inv.seat, 2)
          })
        }
      }
    }
    if (state.scenarioFlags.enteringFromStairwell) return
  },

  locationLeft(state, inv, prevLocation, api) {
    const flags = (state.scenarioFlags ||= {})
    const previousBySeat = (flags.previousBySeat ||= {})
    previousBySeat[inv.seat] = prevLocation.id
    const pending = flags.lostWoodsPending
    if (Array.isArray(pending)) {
      flags.lostWoodsPending = pending.filter(entry => !(Number(entry.seat) === Number(inv.seat)))
    }
  },

  // ---- 混乱袋：基袋由战役层安装（B 线），这里不加标记 ----
  tokenMeanings: WAKING_NIGHTMARE_TOKEN_MEANINGS,

  // ---- 结局与战役记录 ----
  resolution(state, key, events, api = {}) {
    const records = recordsFor(state)
    const step = (Number(state.actIndex) || 0) + 1
    const addRandolph = (recordKey) => {
      records[recordKey] = true
      const candidates = activeInvestigators(state).filter(inv => !inv.defeated)
      if (!candidates.length || typeof api.campaignCardChange !== 'function') return
      const answer = api.choose?.({
        kind: 'story', source: 'wakingNightmare-resolution', seat: leadSeat(state),
        prompt: '是否由一位调查员把「伦道夫·卡特（被缚于清醒世界）」加入牌组？（不计入 30 张牌组上限）',
        options: [
          { id: 'skip', label: '不加入' },
          ...candidates.map(inv => ({ id: String(inv.seat), label: `${inv.name} 加入牌组` })),
        ],
      })
      const seat = Number(answer)
      const chosen = candidates.find(inv => inv.seat === seat)
      if (chosen) {
        api.campaignCardChange(state.campaign, chosen.seat, RANDOLPH_CARTER, 'add', '清醒噩梦结局')
        api.addTrauma?.(chosen.seat, 'none', 0)
      }
    }
    const recordSteps = () => {
      const infested = (state.infestedLocations || []).length
      records.stepsOfTheBridge = Number(records.stepsOfTheBridge || 0) + infested
    }
    if (key === 'noResolution') {
      const anyResigned = state.investigators.some(inv => inv.resigned)
      recordSteps()
      if (anyResigned) {
        records.drMaheswaransFateIsUnknown = true
        addRandolph('randolphEscapedTheHospitalOnHisOwn')
      }
      return { award: true, bonus: 0 }
    }
    if (key === 'noResolutionDefeated') {
      recordSteps()
      return { award: true, bonus: 0 }
    }
    if (key === 'resolution1') {
      records.drMaheswaranIsAlive = true
      if (isInterconnected(state)) records.theDreamersGrowWeaker = true
      addRandolph('randolphEscapedTheHospitalWithTheInvestigators')
      return { award: true, bonus: 0 }
    }
    if (key === 'resolution2') {
      records.drMaheswaranIsMissing = true
      api.addTrauma?.(leadSeat(state), 'mental', 1)
      if (isInterconnected(state)) records.theDreamersGrowWeaker = true
      addRandolph('randolphEscapedTheHospitalWithTheInvestigators')
      return { award: true, bonus: 0 }
    }
    if (key === 'resolution3') {
      records.drMaheswaranIsAlive = true
      addRandolph('randolphEscapedTheHospitalWithTheInvestigators')
      return { award: true, bonus: 0 }
    }
    if (key === 'resolution4') {
      records.drMaheswaranIsMissing = true
      api.addTrauma?.(leadSeat(state), 'mental', 1)
      addRandolph('randolphEscapedTheHospitalOnHisOwn')
      return { award: true, bonus: 0 }
    }
    if (key === 'resolution5') {
      state.tokenBags = state.tokenBags || {}
      delete state.tokenBags[INFESTATION_BAG]
      state.infestedLocations = []
      api.info?.('🕷️ 结局 5：滋生袋与所有滋生标记移出游戏。')
      return { award: true, bonus: 0 }
    }
    void step
    void OUTBREAK
    return { award: true, bonus: 0 }
  },
}
