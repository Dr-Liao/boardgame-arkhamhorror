// 疯星乱舞（Dancing Mad · 09591）· 引擎钩子（章节流程 + 交涉潜入/战斗警报 + 阴影敌人 + 空洞）。
//
// 约定（与 TDE/TIC/EotE 章节 behavior 相同）：
//   · 逐卡规则在单卡条目的 enemyRule / assetRule / treacheryRule / encounterResolve 里；
//     behavior 只做分派与本章专属机械（版本切换、隐匿迷你卡、空洞、幕/议程背面、结局记录）。
//   · 内容层（behavior）允许直接读写 state；卡条目禁止，只拿 ctx.api。
//   · 阴影/空洞/密钥/时间统一走 P2 原语：`src/engine/tsk-concealed.js`、`tsk-hollow.js`、
//     `tsk-scarlet-keys.js`、`tsk-map.js`；写入口优先 `api.mechanics.tsk.*`。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  agendaRuleFor, encounterResolveFor, enemyRuleFor, resolveDeclarativeTreacheryTest, treacheryTestFor,
} from '../../../../../src/cards/card-rules.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import {
  concealedAt, concealedMiniCards, distributeConcealed, exposeMiniCard, placeMiniCard, reshuffleConcealed,
} from '../../../../../src/engine/tsk-concealed.js'
import { hollowCard, hollowCards, isHollowed, recallHollow } from '../../../../../src/engine/tsk-hollow.js'
import { mapTime } from '../../../../../src/engine/tsk-map.js'
import { bindKey } from '../../../../../src/engine/tsk-scarlet-keys.js'
import {
  ACT_VARIANTS, AGENDA_HOLLOW_THRESHOLDS, CAFE_LUNA_FACES, CHAPTER_ENTRY_CODES, CHAPTER_ID,
  DECOY_MINI_KIND, DESIDERIO_ENEMY_CODES, DEAL_SET_ASIDE_DECK_CODES, FORCED_TIME_CAP,
  HAVANA_LOCATION_IDS, MIRRORING_BLADE_KEY_ID, MODES, MODE_LABELS, OUTSIDER_ENEMY_CODES,
  DESIDERIO_BEARER_ENEMY_CODE, RAW_CODES, RESOLUTION_TIME, SET_ASIDE_CODES, SET_ASIDE_LOCATION_IDS,
  START_LOCATION, THETA_OFFSET,
  TIME_THRESHOLD, concealedXOf, enemyCodeOfMiniKind, miniKindOf,
} from './definition.js'
import { DANCING_MAD_TOKEN_MEANINGS_BY_DIFFICULTY, dancingMadAfterTest, dancingMadChaosToken, cardNameOf } from './chaos.js'

const codeOf = card => card?.originalCode || card?.code || card
const aliveInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state.numInvestigators) || (state.investigators || []).length || 1
const locationOf = (state, inv) => (state.locations || []).find(item => item.id === inv?.location) || null
const locationById = (state, id) => (state.locations || []).find(item => item.id === id) || null
const recordsOf = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const traitsOf = code => [...(ALL_CARDS[code]?.traits || [])]
const isWeakness = code => ALL_CARDS[code]?.subtype === 'weakness' || ALL_CARDS[code]?.type === 'weakness'
const entryOf = code => registeredEntry(String(code ?? '')) || null
const locationCodeOf = (state, id) => codeOf(state.scenario?.locations?.[id])

// —— 章节状态（只用 scenarioFlags.dancingMad 一层，不新造顶层字段）——
const DEFAULT_FLAGS = Object.freeze({
  version: 1, mode: MODES.deal, stance: 'infiltration', introResolved: false,
  hollowsRemoved: [], parleyedEnemies: [], revealedDesiderio: null, lastEnemyDamage: null,
  cafeLunaFace: RAW_CODES.cafeLunaBastion, hollowForcedChecks: 0, placedLocations: [],
})

export function dancingMadFlags(state) {
  state.scenarioFlags ||= {}
  const current = state.scenarioFlags.dancingMad
  if (!current) {
    state.scenarioFlags.dancingMad = {
      ...DEFAULT_FLAGS, hollowsRemoved: [], parleyedEnemies: [], placedLocations: [],
    }
    return state.scenarioFlags.dancingMad
  }
  for (const [key, value] of Object.entries(DEFAULT_FLAGS)) {
    if (!Object.hasOwn(current, key)) current[key] = Array.isArray(value) ? [...value] : value
  }
  return current
}

const modeOf = state => dancingMadFlags(state).mode || MODES.deal
const stanceOf = state => dancingMadFlags(state).stance || 'infiltration'
const actIndexOf = state => Number(state.actIndex ?? 0)

// —— 原语适配：写入口优先 ctx.api（引擎接线路径），读点直接读引擎模块（钩子没有 api 时也要工作）——
const concealedApiOf = api => api?.mechanics?.tsk?.concealed || null
const hollowApiOf = api => api?.mechanics?.tsk?.hollow || null
const keysApiOf = api => api?.mechanics?.tsk?.keys || null
const mapApiOf = api => api?.mechanics?.tsk?.map || null

function placeMini(state, api, spec) {
  const adapter = concealedApiOf(api)
  return adapter ? adapter.place(spec) : placeMiniCard(state, spec)
}
function distributeMini(state, api, spec) {
  const adapter = concealedApiOf(api)
  return adapter ? adapter.distribute(spec) : distributeConcealed(state, spec)
}
function exposeMini(state, api, id, seat = null) {
  const adapter = concealedApiOf(api)
  if (adapter) return adapter.expose(id, { seat })
  return exposeMiniCard(state, id)
}
function hollowOne(state, api, spec) {
  const adapter = hollowApiOf(api)
  return adapter ? adapter.hollow(spec) : hollowCard(state, spec)
}
function recallOne(state, api, code, options) {
  const adapter = hollowApiOf(api)
  return adapter ? adapter.recall(code, options) : recallHollow(state, code, options)
}

// —— 阴影（In the Shadows）——
// 真身（非诱饵）迷你卡数 = 阴影中敌人的数量；`[skull]` 与幕 1 v.II 的强制都读它。
export function miniCardsInPlay(state) {
  return concealedMiniCards(state)
}
export function enemiesInShadows(state) {
  return concealedMiniCards(state).filter(card => !card.decoy).length
}
export function decoysInPlay(state) {
  return concealedMiniCards(state).filter(card => card.decoy).length
}

// 候选地点：除月下餐厅以外的在场地点（参考实现「除 Café Luna 的地点」）；不足时回退全部。
const shadowCandidateIds = state => {
  const all = (state.locations || []).map(item => item.id)
  const others = all.filter(id => id !== START_LOCATION)
  return others.length ? others : all
}

// 把一组迷你卡「尽可能平均地」分配到候选地点：顺序由原语洗牌决定（不泄露真身）。
function distributeEvenly(state, api, cards, locationIds) {
  if (!cards.length || !locationIds.length) return []
  const placements = locationIds.map(locationId => ({ locationId, count: 0 }))
  cards.forEach((_card, index) => { placements[index % placements.length].count += 1 })
  return distributeMini(state, api, { cards, placements: placements.filter(item => item.count > 0) })
}

/** 隐匿 X 的迷你卡组：真身 1 张 + X 张诱饵（X 按卡面 per_investigator 换算）。 */
export function concealedMiniSet(state, code) {
  const rule = enemyRuleFor(code)?.concealed || concealedXOf(code) || { value: 1, perInvestigator: false }
  const x = Math.max(1, (Number(rule.value) || 1) * (rule.perInvestigator ? investigatorCount(state) : 1))
  const kind = miniKindOf(code)
  if (!kind) return { cards: [], x }
  return {
    cards: [{ kind, code, decoy: false }, ...Array.from({ length: x }, () => ({ kind: DECOY_MINI_KIND, decoy: true }))],
    x,
  }
}

/**
 * 把敌人「隐匿」到场外阴影（不生成实体）：迷你卡平均分配到除月下餐厅外的地点。
 * 幕 2 v.I 的团队反应在此处询问：共同花费 X 线索改为直接交战生成。
 * 导出给测试与其它章节钩子复用（同一份规则只写一次）。
 */
export function concealEnemy(state, api, code, options = {}) {
  const { cards, x } = concealedMiniSet(state, code)
  if (!cards.length) return null
  const objective = state.acts?.[actIndexOf(state)]?.objective
  const canPayInstead = options.allowTeamPayment !== false && objective?.kind === 'noEnemiesInShadows'
  const groupClues = aliveInvestigators(state).reduce((sum, inv) => sum + (inv.clues || 0), 0)
  if (canPayInstead && groupClues >= x && typeof api?.choice === 'function') {
    const answer = api.choice({
      kind: 'effect', source: 'act2v1', seat: options.seat ?? 0,
      prompt: `是否共同花费 ${x} 个线索，改为让「${cardNameOf(code)}」直接与调查员交战生成？`,
      options: [
        { id: 'pay', label: `共同花费 ${x} 个线索（直接交战生成）` },
        { id: 'hide', label: '不支付，照常隐匿' },
      ],
    })
    if (answer === 'pay') {
      payTeamClues(state, x)
      const seat = options.seat ?? 0
      const locationId = options.locationId || state.investigators?.[seat]?.location || START_LOCATION
      const enemy = api?.spawnEngaged?.(code, locationId, seat) || null
      api?.info?.(`🕵️ 团队花费 ${x} 个线索：「${cardNameOf(code)}」直接与调查员交战生成。`)
      return { paid: x, enemy }
    }
  }
  const placed = distributeEvenly(state, api, cards, options.locationIds || shadowCandidateIds(state))
  api?.info?.(`🌫️ 「${cardNameOf(code)}」进入阴影：${placed.length} 张隐匿迷你卡（含 ${x} 张诱饵）正面朝下分配。`)
  return { placed, x }
}

// 团队共同支付线索（按座位顺序扣，同步总线索读点）。
function payTeamClues(state, amount) {
  let left = amount
  for (const inv of state.investigators || []) {
    if (left <= 0) break
    const pay = Math.min(left, inv.clues || 0)
    inv.clues -= pay
    left -= pay
  }
  state.clues = (state.investigators || []).reduce((sum, inv) => sum + (inv.clues || 0), 0)
  return amount - left
}

// —— 交涉潜入 / 战斗警报（同一份状态机）——
// infiltration：敌人藏在阴影里，谈判（Parley）可用；alert：真身暴露，幕 1 v.II 的敌军阶段
// 强制（对月下餐厅的调查员造成 X 点伤害）开始结算。
export function markAlert(state, alert = true) {
  const flags = dancingMadFlags(state)
  flags.stance = alert ? 'alert' : 'infiltration'
  return flags.stance
}

// —— 空洞（Hollow）——
const removedHollowCodes = state => dancingMadFlags(state).hollowsRemoved || []
export function setAsideHollows(state) {
  const removed = new Set(removedHollowCodes(state))
  return hollowCards(state).filter(card => !removed.has(card.code))
}
export const setAsideHollowCount = state => setAsideHollows(state).length

function removeCardFromSeat(state, seat, code) {
  const inv = state.investigators?.[seat]
  if (!inv) return false
  for (const pile of ['discard', 'hand']) {
    const list = inv[pile]
    if (!Array.isArray(list)) continue
    const index = list.lastIndexOf(code)
    if (index >= 0) { list.splice(index, 1); return true }
  }
  return false
}

/** 把投入本次检定的非弱点卡牌变成空洞（[tablet] 标记；卡牌从弃牌堆/手牌移出场外）。 */
function hollowCommittedCards(state, api, result, inv) {
  const committed = Array.isArray(result?.committed) ? result.committed : []
  const hollowed = []
  for (const item of committed) {
    const code = codeOf(item)
    const seat = Number.isInteger(item?.seat) ? item.seat : inv?.seat
    if (!code || seat == null || isWeakness(code)) continue
    if (isHollowed(state, code) || hollowed.includes(code)) continue
    const created = hollowOne(state, api, { code, source: RAW_CODES.scenario, scope: 'investigator', seat })
    if (!created) continue
    removeCardFromSeat(state, seat, code)
    hollowed.push(code)
  }
  if (hollowed.length) {
    api?.info?.(`🕳️ [tablet]：${hollowed.map(cardNameOf).join('、')} 放在一边，作为空洞。`)
  }
  return hollowed
}

/** 空洞回收：洗回牌库 / 手牌 / 弃牌堆（按记录里的座位放回对应区域）。 */
function recallHollowToOwner(state, api, code, to = 'hand') {
  const record = recallOne(state, api, code, { to })
  if (!record) return null
  const owner = record.seat != null ? state.investigators?.[record.seat] : null
  if (owner) {
    if (to === 'hand') owner.hand.push(code)
    else if (to === 'discard') owner.discard.push(code)
    else owner.deck.push(code)
  }
  api?.info?.(`🕳️ 空洞「${cardNameOf(code)}」被回收（${to}）。`)
  return record
}

/**
 * 议程正面的强制：放一边的空洞达到 N × 调查员数时，选择并移除 M × 调查员数张，放 1 毁灭。
 * 空洞区没有「移出游戏但不算抹除」的写入口（见 primitive-requests/09592.json），
 * 这里用章节侧 `hollowsRemoved` 台账记账：被记账的卡不再计入「放一边的空洞」。
 */
function checkHollowForcedDoom(state, api) {
  const agenda = state.agendas?.[state.agendaIndex ?? 0]
  const forced = agenda?.hollowForced || AGENDA_HOLLOW_THRESHOLDS[agenda?.id]
  if (!agenda || !forced) return null
  const total = investigatorCount(state)
  const threshold = forced.perInvestigator * total
  const candidates = setAsideHollows(state)
  if (candidates.length < threshold) return null
  const removeCount = Math.min(candidates.length, forced.remove * total)
  const chosen = candidates.slice(0, removeCount)
  const flags = dancingMadFlags(state)
  for (const card of chosen) if (!flags.hollowsRemoved.includes(card.code)) flags.hollowsRemoved.push(card.code)
  flags.hollowForcedChecks += 1
  api?.info?.(`🕳️ 议程强制：移除 ${chosen.length} 张空洞，在本议程放置 1 个毁灭。`)
  // 放毁灭的唯一入口是 api.addDoom（引擎会自己检查推进）；没有 api 时按同一口径补。
  if (typeof api?.addDoom === 'function') {
    api.addDoom(1)
  } else {
    state.doom = (state.doom || 0) + 1
    if (state.doom >= (agenda.doomThreshold ?? Infinity)) api?.advanceAgenda?.()
  }
  return chosen.map(card => card.code)
}

// —— 阴影敌人的正面行为（德西）——
const isDesiderioCode = code => DESIDERIO_ENEMY_CODES.includes(String(code))
const inAct12 = state => actIndexOf(state) <= 1

// 09606a/09607a：幕 1–2 期间受到伤害时改为自动躲避（enemyRule.autoEvadeInsteadOfDamageActs）。
function autoEvadeInsteadOfDamage(state, enemy, api) {
  if (!inAct12(state)) return false
  const acts = enemyRuleFor(codeOf(enemy))?.autoEvadeInsteadOfDamageActs
  if (!Array.isArray(acts) || !acts.includes(actIndexOf(state) + 1)) return false
  enemy.exhausted = true
  if (enemy.engagedSeat != null) enemy.engagedSeat = null
  api?.info?.(`🕵️ 「${cardNameOf(codeOf(enemy))}」受到伤害时改为自动躲避（幕 1–2）。`)
  return true
}

// —— 场景布置 ——
const placeCafeLunaFace = (state, faceCode) => {
  const face = faceCode === RAW_CODES.cafeLunaHaunt ? CAFE_LUNA_FACES.haunt : CAFE_LUNA_FACES.bastion
  state.locationVariants ||= {}
  state.locationVariants.cafeLuna = { ...(state.locationVariants.cafeLuna || {}), ...face }
  dancingMadFlags(state).cafeLunaFace = face.code
  return face.code
}

export const scenarioApproximations = Object.freeze([
  '卡面没有独立的「模式卡」：本实现把「与德西达成交易（v.I）/ 遭伏击（v.II）」落成 scenarioFlags.dancingMad.mode，'
  + '把「交涉潜入 / 战斗警报」落成同一处的 stance；揭露真身时切到 alert，谈判成功时切回 infiltration。'
  + '两处状态只驱动「幕 1 v.II 敌军阶段强制伤害」与日志/面板，卡面文字没有为它们另印规则。',
  '两张德西（09606a / 09607a）印刷文字完全相同、只是反面不同（遭遇牌背 / 剧情资产 09607b）：'
  + '规则实现一次（章节 behavior 按 enemyRule 分派），两个条目只声明同一份数据，没有按卡号写分支。',
  '隐匿迷你卡分配固定为「真身 1 张 + X 张诱饵，平均分配给除月下餐厅外的在场地点」，位置一律为地点正面'
  + '（position=null）；参考实现的阴影左/中/右三位置只在阴影地点关卡使用。',
  '德西的「受到伤害时改为自动躲避」在 enemyDamageAmount 读点实现（伤害改为 0 + 横置 + 解除交战）；'
  + '官方做成替换效果，引擎没有「伤害替换」原语，因此日志写「改为自动躲避」。',
  '德西的「躲避成功且超过难度 2 点、另有他时那张对他造成 2 点伤害」在 afterEvade 直接写 damageTaken'
  + '（绕过上面那条替换效果）；否则两条能力互相抵消、卡面反应永远不产生结果。',
  '议程正面的「移除 N 张空洞」没有空洞区移除原语：以章节台账 hollowsRemoved 记账，被记账的卡不再计入'
  + '「放一边的空洞」；议程 3 背面只把每位调查员经验值最高的那张写进存在抹除名单，其余记账卡不再参与本关结算。',
  '「查看德西的另一面」以记录 + 日志表达（不替换在场实体）：记录 campaign.records.desiderioOtherSideSeen，'
  + '日志给出另一面的卡号与名称，避免在战斗中翻面破坏实体 id。',
  '「记 N 时间」没有时间累加原语（时间只能由旅行增加）：章节直接写 campaign.tsk.map.time 并夹在 35 以内。',
  '地点能力（大剧院/广场酒店/马赛奥大道/热带花园）在 behavior.actions 里提供；月下餐厅的补线索与隐藏值修正'
  + '分别接 cluesRemoved / locationShroudModifier 读点。',
])

export const scenarioGaps = Object.freeze([
  '空洞区缺少「移出游戏但不算存在抹除」的写入口（议程正面强制）。',
  '缺少「已离开空洞区之后才写存在抹除名单」的入口（议程 3 背面）。',
  '缺少战役时间累加原语（结局的「记 N 时间」）。',
])

export const implementedEncounterCodes = Object.freeze([...CHAPTER_ENTRY_CODES])

export const behavior = {
  id: CHAPTER_ID,
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps,
  tokenMeanings: DANCING_MAD_TOKEN_MEANINGS_BY_DIFFICULTY,
  resolutionIds: ['noResolution', 'resolution1', 'resolution2'],

  // 起点（引擎 placeLocation 用）。
  startLocation() {
    return START_LOCATION
  },

  // ---- 序章：按战役时间选布置版本（参考 PreScenarioSetup）----
  preScenarioSetup(state, events, api) {
    const flags = dancingMadFlags(state)
    if (flags.introResolved) return flags.mode
    flags.introResolved = true
    const time = readTime(state, api)
    const mode = time >= TIME_THRESHOLD ? MODES.ambush : MODES.deal
    flags.mode = mode
    flags.version = mode === MODES.ambush ? 2 : 1
    flags.stance = mode === MODES.ambush ? 'alert' : 'infiltration'
    // 幕牌按版本切换：state.acts 是运行期数组，直接换成对应套（幕 3 共用）。
    state.acts = ACT_VARIANTS[mode].map(act => structuredClone(act))
    const records = recordsOf(state)
    if (mode === MODES.deal) records.theCellMadeADealWithDesi = true
    else records.theCellHasBeenAmbushed = true
    api?.info?.(mode === MODES.deal
      ? `🌴 疯星乱舞：已流逝 ${time} 时间 < ${TIME_THRESHOLD} —— 特别小组${MODE_LABELS.deal}。`
      : `🌴 疯星乱舞：已流逝 ${time} 时间 ≥ ${TIME_THRESHOLD} —— ${MODE_LABELS.ambush}。`)
    return mode
  },

  // ---- 布置：v.I 六处地点 + 德西剧情资产；v.II 只有月下餐厅（结社据点面）----
  setupLocations(state, events, helper = {}) {
    const flags = dancingMadFlags(state)
    if (!flags.introResolved) behavior.preScenarioSetup(state, events, helper.api)
    const zones = (state.scenarioZones ||= {})
    const mode = flags.mode
    placeCafeLunaFace(state, mode === MODES.ambush ? RAW_CODES.cafeLunaHaunt : RAW_CODES.cafeLunaBastion)
    const placed = mode === MODES.ambush ? [START_LOCATION] : [...HAVANA_LOCATION_IDS]
    zones.setAside = [
      ...(mode === MODES.ambush ? SET_ASIDE_LOCATION_IDS.map(id => locationCodeOf(state, id) || id) : []),
      ...SET_ASIDE_CODES,
    ]
    zones.removed = []
    zones.victory = zones.victory || []
    // v.I 的地点全部正面朝上：布置结束后按正常揭示流程翻开（引擎读 scenarioFlags.pendingSetupReveals）。
    flags.pendingSetupReveals = placed.filter(id => id !== START_LOCATION)
    flags.placedLocations = [...placed]
    helper.info?.(state, events, mode === MODES.ambush
      ? '🌴 布置（v.II）：月下餐厅以结社据点面入场；其余地点、两张德西与域外敌人放在一边。'
      : '🌴 布置（v.I）：六处哈瓦那地点全部入场，月下餐厅以追忆堡垒面入场；德西剧情资产由一位调查员控制。')
    return placed
  },

  setupEnemies() {},

  // ---- 布置后：遭遇牌库按版本裁剪、德西剧情资产分配、v.II 的阴影敌人 ----
  afterDeckSetup(state, events, helper = {}) {
    const api = helper.api
    const flags = dancingMadFlags(state)
    const zones = (state.scenarioZones ||= {})
    zones.setAside ||= []
    if (flags.mode === MODES.deal) {
      // v.I：扫荡团伙与猩红阴谋整组放一边（幕 1 v.I 背面才洗回牌库）。
      const kept = []
      for (const code of state.encounterDeck || []) {
        if (DEAL_SET_ASIDE_DECK_CODES.includes(code)) zones.setAside.push(code)
        else kept.push(code)
      }
      state.encounterDeck = kept
      const seat = chooseDesiderioController(state, api)
      const asset = createDesiderioAsset(state, seat)
      api?.info?.(`🎭 ${state.investigators?.[seat]?.name || '调查员'} 控制「德西德柔·戴佳多·欧瓦瑞兹」剧情资产。`)
      return asset
    }
    // v.II：两张德西与 4 张域外敌人放一边；阴影敌人随后生成。
    for (const code of SET_ASIDE_CODES) if (!zones.setAside.includes(code)) zones.setAside.push(code)
    flags.stance = 'alert'
    const created = behavior.spawnEnemiesInShadows(state, events, api)
    api?.info?.('🌫️ 布置（v.II）：德西与同志会成员潜伏在哈瓦那的阴影中。')
    return created
  },

  /**
   * v.II 的阴影敌人：队长抽取德西（结算隐匿），其余调查员按玩家顺序从遭遇牌库弃牌直到弃出
   * 一张不同的 [[结社]] 敌人并抽取（参考 setup.theShadows）。
   */
  spawnEnemiesInShadows(state, events, api) {
    const flags = dancingMadFlags(state)
    const created = []
    const alive = aliveInvestigators(state)
    const lead = alive[0]?.seat ?? 0
    concealEnemy(state, api, RAW_CODES.desiderioEncounter, { seat: lead, allowTeamPayment: false })
    const drawn = []
    for (const inv of alive) {
      if (inv.seat === lead) continue
      const code = api?.discardUntilEnemy?.(inv.seat, (_def, candidate) => traitsOf(candidate).includes('Coterie')
        && !DESIDERIO_ENEMY_CODES.includes(candidate) && !drawn.includes(candidate))
      if (!code) continue
      drawn.push(code)
      concealEnemy(state, api, code, { seat: inv.seat, allowTeamPayment: false })
      created.push(code)
    }
    flags.stance = 'alert'
    return created
  },

  // ---- 地点入场记账（引擎 locationPlaced 读点）----
  locationPlaced(state, location) {
    const flags = dancingMadFlags(state)
    flags.placedLocations ||= []
    if (location?.id && !flags.placedLocations.includes(location.id)) flags.placedLocations.push(location.id)
  },

  // ---- 地点规则（本章不给地点建条目，读点都在 behavior）----
  // 月下餐厅（追忆堡垒面）：场上每个 [[域外]] 敌人隐藏值 -1。
  locationShroudModifier(state, location) {
    if (location?.id !== START_LOCATION) return 0
    if (codeOf(location) !== RAW_CODES.cafeLunaBastion) return 0
    const outsiders = (state.enemies || []).filter(enemy => !enemy.defeated
      && traitsOf(codeOf(enemy)).includes('Outsider')).length
    return outsiders ? -outsiders : 0
  },

  // 月下餐厅（追忆堡垒面）：没有线索时补到每人 1 个（cluesRemoved 读点）。
  cluesRemoved(state, location, amount, api) {
    if (location?.id !== START_LOCATION) return null
    return refillCafeLuna(state, api)
  },

  // ---- 行动：撤退 / 谈判 / 线索推进 / 地点能力 ----
  actions(state, inv) {
    if (!inv || inv.defeated || inv.resigned) return []
    const moves = []
    const actIndex = actIndexOf(state)
    const mode = modeOf(state)
    // 幕 1–2 正面印有「[action]：撤退」。
    if (actIndex <= 1) {
      moves.push({
        action: 'scenarioAction', rule: 'resignDancingMad', actions: 1,
        label: actIndex === 1 && mode === MODES.ambush
          ? '🏳️ 撤退：「我们不是有过交易吗？！」'
          : '🏳️ 撤退：「交易结束了！」',
      })
    }
    // 幕 2 v.II：谈判（把等于剩余生命的线索放到[[结社]]敌人身上，移除其毁灭并自动躲避）。
    if (actIndex === 1 && mode === MODES.ambush) {
      const here = (state.enemies || []).filter(enemy => !enemy.defeated && enemy.location === inv.location
        && traitsOf(codeOf(enemy)).includes('Coterie'))
      const groupClues = aliveInvestigators(state).filter(other => other.location === inv.location)
        .reduce((sum, other) => sum + (other.clues || 0), 0)
      for (const enemy of here) {
        const cost = Math.max(0, remainingHealth(enemy))
        moves.push({
          action: 'scenarioAction', rule: 'parleyCoterie', enemyId: enemy.id, actions: 1,
          reason: groupClues < cost ? `本地点线索不足（需要 ${cost}）` : null,
          label: `🤝 谈判：共同把 ${cost} 个线索放到「${enemy.name}」上（移除其毁灭并自动躲避）`,
        })
      }
    }
    // 幕 2 v.I：阴影中没有敌人时，可以共同支付线索推进。
    const objective = state.acts?.[actIndex]?.objective
    if (objective?.kind === 'noEnemiesInShadows') {
      const cost = (objective.perInvestigator || 1) * investigatorCount(state)
      const groupClues = aliveInvestigators(state).reduce((sum, other) => sum + (other.clues || 0), 0)
      const noShadows = enemiesInShadows(state) === 0
      moves.push({
        action: 'scenarioAction', rule: 'advanceWithClues', actions: 0, fast: true,
        reason: !noShadows ? '阴影中仍有敌人' : (groupClues < cost ? `需要 ${cost} 个线索（当前 ${groupClues}）` : null),
        label: `📜 共同支付 ${cost} 个线索推进场景`,
      })
    }
    // 幕 3：德西失去隐匿与猎手、获得冷漠与「谈判：查看另一面」。
    if (actIndex >= 2) {
      const knowsPast = recordsOf(state).theCellKnowsOfDesisPast === true
      for (const enemy of (state.enemies || []).filter(item => !item.defeated
        && isDesiderioCode(codeOf(item)) && item.location === inv.location)) {
        moves.push({
          action: 'scenarioAction', rule: 'parleyDesiderio', enemyId: enemy.id, actions: 1,
          reason: knowsPast ? null : '剧本日志还没有记录「特别小组知道了德西的过往」',
          label: `🤝 谈判：查看「${enemy.name}」的另一面`,
        })
      }
    }
    // 地点能力。
    const here = locationCodeOf(state, inv.location)
    if (here === RAW_CODES.granTeatroDeLaHabana) {
      moves.push({
        action: 'scenarioAction', rule: 'granTeatroShroud', actions: 0, fast: true,
        reason: (inv.resources || 0) < 2 ? `需要 2 资源（当前 ${inv.resources || 0}）`
          : (inv.granTeatroRound === state.round ? '本回合已经使用过' : null),
        label: '🎭 花费 2 资源：本回合大剧院隐藏值 -2',
      })
    }
    if (here === RAW_CODES.plazaHotel) {
      moves.push({
        action: 'scenarioAction', rule: 'plazaHotelLook', actions: 0, fast: true,
        reason: (dancingMadFlags(state).plazaHotelRound || 0) === state.round ? '团队本回合已经使用过' : null,
        label: '🏨 受到 1 点恐惧：查看月下餐厅或连接地点一张隐匿迷你卡的已揭示面',
      })
    }
    if (here === RAW_CODES.elMalecon) {
      moves.push({
        action: 'scenarioAction', rule: 'elMaleconExpose', actions: 0, fast: true,
        reason: (dancingMadFlags(state).elMaleconRound || 0) === state.round ? '团队本回合已经使用过'
          : (concealedAt(state, inv.location).length ? null : '本地没有隐匿迷你卡'),
        label: '🌊 揭露本地另一张隐匿迷你卡（团队每轮一次）',
      })
    }
    if (here === RAW_CODES.jardinesDeLaTropical) {
      moves.push({
        action: 'scenarioAction', rule: 'jardinesRecall', actions: 0, fast: true,
        reason: setAsideHollowCount(state) ? null : '没有放一边的空洞',
        label: '🌿 选择一张放一边的空洞，其所有者将其抽取',
      })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (!move || !inv) return false
    const flags = dancingMadFlags(state)
    if (move.rule === 'resignDancingMad') {
      inv.resigned = true
      api?.resign?.(inv.seat)
      api?.info?.(`🏳️ ${inv.name} 撤退，离开哈瓦那。`)
      return true
    }
    if (move.rule === 'advanceWithClues') {
      const objective = state.acts?.[actIndexOf(state)]?.objective
      const cost = (objective?.perInvestigator || 1) * investigatorCount(state)
      if (payTeamClues(state, cost) < cost) return false
      api?.info?.(`📜 共同支付 ${cost} 个线索推进场景。`)
      api?.advanceAct?.()
      return true
    }
    if (move.rule === 'parleyCoterie') {
      const enemy = (state.enemies || []).find(item => String(item.id) === String(move.enemyId))
      if (!enemy) return false
      const cost = Math.max(0, remainingHealth(enemy))
      const atLocation = aliveInvestigators(state).filter(other => other.location === inv.location)
      const available = atLocation.reduce((sum, other) => sum + (other.clues || 0), 0)
      if (available < cost) return false
      payGroupCluesLocally(state, atLocation, cost)
      enemy.clues = (enemy.clues || 0) + cost
      enemy.doom = 0
      enemy.exhausted = true
      enemy.engagedSeat = null
      flags.parleyedEnemies.push(String(enemy.id))
      markAlert(state, false)
      api?.info?.(`🤝 谈判：共同把 ${cost} 个线索放到「${enemy.name}」上，移除其毁灭并自动躲避 —— 回到交涉潜入。`)
      return true
    }
    if (move.rule === 'parleyDesiderio') {
      const enemy = (state.enemies || []).find(item => String(item.id) === String(move.enemyId))
      if (!enemy) return false
      if (recordsOf(state).theCellKnowsOfDesisPast !== true) return false
      const other = codeOf(enemy) === RAW_CODES.desiderioEncounter
        ? RAW_CODES.desiderioLinkedEnemy : RAW_CODES.desiderioEncounter
      flags.revealedDesiderio = { code: codeOf(enemy), seenRound: state.round }
      flags.desiderioOtherSideSeen = true
      recordsOf(state).desiderioOtherSideSeen = other
      api?.info?.(`🎭 谈判：查看「${cardNameOf(codeOf(enemy))}」的另一面 —— ${other}`
        + `（${cardNameOf(other)}${other === RAW_CODES.desiderioLinkedEnemy ? ' / 剧情资产 09607b' : ''}）。`)
      return true
    }
    if (move.rule === 'granTeatroShroud') {
      if ((inv.resources || 0) < 2 || inv.granTeatroRound === state.round) return false
      inv.resources -= 2
      inv.granTeatroRound = state.round
      const location = locationById(state, inv.location)
      if (location) location.shroudMod = (location.shroudMod || 0) - 2
      api?.info?.('🎭 花费 2 资源：大剧院隐藏值 -2（直到你的回合结束）。')
      return true
    }
    if (move.rule === 'plazaHotelLook') {
      if ((flags.plazaHotelRound || 0) === state.round) return false
      inv.horror = (inv.horror || 0) + 1
      flags.plazaHotelRound = state.round
      const here = locationById(state, inv.location)
      const candidateIds = [inv.location, ...((here?.connections) || [])]
      const candidates = candidateIds.flatMap(id => concealedAt(state, id))
      for (const card of candidates) card.known = true
      api?.info?.(`🏨 受到 1 点恐惧：查看 ${candidates.length} 张隐匿迷你卡的已揭示面（不揭露）。`)
      return true
    }
    if (move.rule === 'elMaleconExpose') {
      if ((flags.elMaleconRound || 0) === state.round) return false
      const target = concealedAt(state, inv.location)[0]
      if (!target) return false
      flags.elMaleconRound = state.round
      return Boolean(behavior.exposeMiniCard(state, inv, target.id, api))
    }
    if (move.rule === 'jardinesRecall') {
      const target = setAsideHollows(state).find(card => card.seat === inv.seat) || setAsideHollows(state)[0]
      if (!target) return false
      return Boolean(recallHollowToOwner(state, api, target.code, 'hand'))
    }
    return false
  },

  /** 揭露一张隐匿迷你卡：诱饵移除；真身按「隐匿 X」入场并切到战斗警报。 */
  exposeMiniCard(state, inv, miniCardId, api) {
    const card = concealedAt(state, inv.location).find(item => item.id === miniCardId)
    if (!card) return null
    const locationId = card.locationId
    const result = exposeMini(state, api, miniCardId, inv?.seat ?? null)
    if (!result) return null
    const flags = dancingMadFlags(state)
    if (result.decoy) {
      flags.lastExposed = { kind: 'decoy', locationId, round: state.round, seat: inv.seat }
      api?.info?.(`🃏 ${inv.name} 揭露了一张诱饵：弃掉它。`)
      return { decoy: true, locationId }
    }
    const code = enemyCodeOfMiniKind(result.kind)
    flags.lastExposed = { kind: result.kind, code, locationId, round: state.round, seat: inv.seat }
    markAlert(state, true)
    if (!code) return { decoy: false, kind: result.kind, locationId }
    const sameSeat = inv.location === locationId
    const enemy = sameSeat
      ? api?.spawnEngaged?.(code, locationId, inv.seat)
      : api?.spawn?.(code, locationId)
    api?.info?.(`🕵️ ${inv.name} 揭露了「${cardNameOf(code)}」：在「${locationName(state, locationId)}」入场（战斗警报）。`)
    return { decoy: false, kind: result.kind, code, locationId, enemy: enemy || null }
  },

  // ---- 调查相关地点能力（热带花园 / 海景游艇俱乐部）----
  investigateResult(state, inv, location, result, api) {
    if (!location || !result) return undefined
    if (codeOf(location) !== RAW_CODES.miramarYachtClub) return undefined
    if (!result.success) return undefined
    const cards = concealedAt(state, location.id).slice(0, 1 + Math.floor((result.successBy || 0) / 2))
    for (const card of cards) card.known = true
    api?.info?.(`⛵ 海景游艇俱乐部：查看 ${cards.length} 张隐匿迷你卡的已揭示面（不发现线索）。`)
    return false
  },

  afterInvestigate(state, inv, location, result, api) {
    if (!location || !result) return null
    if (codeOf(location) !== RAW_CODES.jardinesDeLaTropical) return null
    if (result.success && (result.successBy || 0) >= 3) {
      const target = setAsideHollows(state)[0]
      if (!target) return null
      recallHollowToOwner(state, api, target.code, 'hand')
      api?.info?.('🌿 热带花园：成功调查超过 3 点，一位调查员抽回一张空洞卡。')
      return { recalled: target.code }
    }
    if (!result.success && (result.failedBy || 0) >= 3) {
      const hand = (inv.hand || []).filter(card => !isWeakness(card))
      const code = hand[hand.length - 1]
      if (!code || isHollowed(state, code)) return null
      const created = hollowOne(state, api, { code, source: RAW_CODES.jardinesDeLaTropical, scope: 'investigator', seat: inv.seat })
      if (created) removeCardFromSeat(state, inv.seat, code)
      api?.info?.('🌿 热带花园：失败超过 3 点，将一张手牌放在一边作为空洞。')
      return { hollowed: code }
    }
    return null
  },

  // ---- 敌人数值修正 ----
  enemyStatModifier(state, enemy, stat) {
    const rule = enemyRuleFor(codeOf(enemy))
    if (!rule) return 0
    if (stat === 'health' && rule.healthPerInvestigatorBonus) {
      return Number(rule.healthPerInvestigatorBonus) * investigatorCount(state)
    }
    return 0
  },

  // 09607b 剧情资产：[[怪物]] 敌人的攻击对控制者的伤害 -1，并对该敌人造成 1 点伤害（横置他）。
  enemyAttackModifier(state, enemy) {
    if (!traitsOf(codeOf(enemy)).includes('Monster')) return null
    for (const inv of state.investigators || []) {
      const asset = (inv.assets || []).find(item => codeOf(item) === RAW_CODES.desiderioAsset && !item.exhausted)
      if (!asset) continue
      const rule = entryOf(RAW_CODES.desiderioAsset)?.assetRule || {}
      if (!rule.monsterAttackDamageReduction) continue
      asset.exhausted = true
      enemy.damageTaken = (enemy.damageTaken || 0) + (rule.monsterAttackRetaliate || 0)
      state.scenarioFlags.dancingMad.assetReactionUsed = { round: state.round, enemyId: String(enemy.id) }
      return { damage: -Number(rule.monsterAttackDamageReduction || 0) }
    }
    return null
  },

  // ---- 敌人受伤/躲避 ----
  enemyDamageAmount(state, enemy, total, api) {
    const code = codeOf(enemy)
    // 幕 1 v.II 的反应要读「这次受到多少伤害」：所有敌人都记下本次待结算伤害。
    dancingMadFlags(state).lastEnemyDamage = { enemyId: String(enemy.id), code, amount: total }
    if (!isDesiderioCode(code)) return undefined
    if (autoEvadeInsteadOfDamage(state, enemy, api)) {
      dancingMadFlags(state).lastDesiderioEvade = { enemyId: String(enemy.id), round: state.round }
      dancingMadFlags(state).lastEnemyDamage = null
      return 0
    }
    return undefined
  },

  enemyDamaged(state, enemy, api) {
    const flags = dancingMadFlags(state)
    const pending = flags.lastEnemyDamage
    flags.lastEnemyDamage = null
    if (modeOf(state) !== MODES.ambush || actIndexOf(state) !== 0) return null
    if (!pending || pending.enemyId !== String(enemy.id)) return null
    if (!traitsOf(codeOf(enemy)).includes('Coterie')) return null
    const clues = Math.floor((Number(pending.amount) || 0) / 2)
    const cafe = locationById(state, START_LOCATION)
    if (!cafe || clues <= 0) return null
    cafe.clues = (cafe.clues || 0) + clues
    api?.info?.(`🔎 幕 1 v.II：[[结社]] 敌人受到 ${pending.amount} 点伤害，在月下餐厅发现 ${clues} 个线索。`)
    return clues
  },

  enemyDefeated(state, enemy, api) {
    const code = codeOf(enemy)
    if (!isDesiderioCode(code)) return false
    const flags = dancingMadFlags(state)
    flags.desiderioDefeated = true
    flags.defeatedDesiderio = code
    api?.info?.(`🎭 「${cardNameOf(code)}」被击败（幕 3 目标达成；不要查看它的另一面）。`)
    return false
  },

  afterEvade(state, inv, enemy, result, api) {
    const rule = enemyRuleFor(codeOf(enemy))
    if (!rule?.otherCopyEvadeDamage || !result?.success) return null
    const successBy = Number(result.successBy ?? (Number(result.value || 0) - Number(result.difficulty || 0)))
    if (!(successBy >= 2)) return null
    const other = (state.enemies || []).find(item => item !== enemy && !item.defeated
      && isDesiderioCode(codeOf(item)) && item.location === inv?.location)
    if (!other) return null
    const amount = Number(rule.otherCopyEvadeDamage)
    other.damageTaken = (other.damageTaken || 0) + amount
    api?.info?.(`🕵️ 另一张「${cardNameOf(codeOf(other))}」对「${cardNameOf(codeOf(enemy))}」造成 ${amount} 点伤害。`)
    return amount
  },

  // ---- 阶段钩子 ----
  phaseBegan(state, phase, api) {
    dancingMadFlags(state)
    checkHollowForcedDoom(state, api)
    if (phase === 'mythos' || phase === 'investigation') refillCafeLuna(state, api)
    return null
  },

  roundEnded(state, api) {
    const flags = dancingMadFlags(state)
    checkHollowForcedDoom(state, api)
    // 轮末：未揭露的迷你卡在原地重新混洗（不增删、不跨出当前地点集合）。
    reshuffleConcealed(state)
    flags.round = state.round
    return null
  },

  // 幕 1 v.II 正面强制：敌军阶段结束时，对月下餐厅的调查员造成 X 点伤害（X = 阴影中敌人数）。
  enemyPhaseEnd(state, api) {
    if (modeOf(state) !== MODES.ambush || actIndexOf(state) !== 0) return null
    if (stanceOf(state) !== 'alert') return null
    const x = enemiesInShadows(state)
    if (x <= 0) return null
    const targets = aliveInvestigators(state).filter(inv => inv.location === START_LOCATION)
    if (!targets.length) return null
    let remaining = x
    for (const inv of targets) {
      if (remaining <= 0) break
      inv.damage = (inv.damage || 0) + 1
      remaining -= 1
    }
    api?.info?.(`🌫️ 敌军阶段结束：阴影中有 ${x} 个敌人，对月下餐厅的调查员造成 ${x - remaining} 点伤害。`)
    return { x, dealt: x - remaining }
  },

  // ---- 幕 / 议程 ----
  actReveal(state, act, api) {
    const code = codeOf(act)
    const entryRule = entryOf(code)?.actRule
    if (typeof entryRule?.onReveal === 'function') return entryRule.onReveal(state, act, api) === true
    const handler = ACT_BACK_HANDLERS[code]
    if (!handler) return false
    handler(state, api)
    return true
  },

  agendaReveal(state, agenda, api) {
    const code = codeOf(agenda)
    const rule = agendaRuleFor(code)
    if (typeof rule?.onReveal === 'function') return rule.onReveal(state, agenda, api) === true
    if (agenda?.backAction === 'chooseConcealedOrHollow') {
      leadChoosesConcealedOrHollow(state, agenda, api)
      return true
    }
    if (agenda?.backAction === 'erasure') {
      erasureResolution(state, api)
      return true
    }
    return false
  },

  agendaForced(state, when, api) {
    // 议程正面的空洞强制：任何窗口都检查（参考 restricted a 1 … forced AnyWindow）。
    return checkHollowForcedDoom(state, api) != null
  },

  // ---- 目标检查（幕 2 v.II / 幕 3）----
  checkObjectives(state, api) {
    const act = state.acts?.[actIndexOf(state)]
    const objective = act?.objective
    if (!objective || objective.type !== 'campaignRule') return false
    if (objective.kind === 'cluesOnCoterieEnemies') {
      const required = (objective.perInvestigator || 4) * investigatorCount(state)
      const total = (state.enemies || []).filter(enemy => !enemy.defeated)
        .reduce((sum, enemy) => sum + (enemy.clues || 0), 0)
      if (total < required) return false
      api?.info?.(`🎯 敌人身上已有 ${total} 个线索（需要 ${required}）：推进幕。`)
      api?.advanceAct?.()
      return true
    }
    if (objective.kind === 'desiderioDefeated') {
      if (dancingMadFlags(state).desiderioDefeated !== true) return false
      api?.advanceAct?.()
      return true
    }
    return false
  },

  // ---- 遭遇卡结算（条目 encounterResolve / 声明式检定）----
  resolveEncounter(state, inv, card, api) {
    const code = codeOf(card)
    const entryResolve = encounterResolveFor(code)
    if (entryResolve) return entryResolve(state, inv, card, api, { location: locationOf(state, inv) })
    const declarative = treacheryTestFor(code)
    if (declarative) return resolveDeclarativeTreacheryTest(state, inv, card, api, declarative)
    return false
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token) {
    return dancingMadChaosToken(state, inv, token, { enemiesInShadows: () => enemiesInShadows(state) })
  },

  afterTest(state, inv, result, api) {
    const riders = dancingMadAfterTest(state, inv, result) || []
    for (const rider of riders) {
      if (rider === 'decoyOnFail') makeDecoyAt(state, inv, api)
      else if (rider === 'hollowCommitted') hollowCommittedCards(state, api, result, inv)
      else if (rider === 'elderThingConcealed') elderThingConcealedChoice(state, inv, api)
    }
    return riders
  },

  // ---- 结局 ----
  resolution(state, key, events, api = {}) {
    const flags = dancingMadFlags(state)
    const records = recordsOf(state)
    const time = RESOLUTION_TIME[key] ?? 1
    const campaign = (state.campaign ||= {})
    if (campaign.tsk?.map) {
      // 缺失原语：时间只能由旅行累加，结局的「记 N 时间」直接写战役时间轴（见 scenarioGaps）。
      campaign.tsk.map.time = Math.min(FORCED_TIME_CAP, Number(campaign.tsk.map.time || 0) + time)
      api.info?.(`⏱️ 记 ${time} 时间（当前 ${campaign.tsk.map.time}）。`)
    } else {
      records.time = Number(records.time || 0) + time
      api.info?.(`⏱️ 记 ${time} 时间（剧本日志 ${records.time}）。`)
    }
    if (key === 'resolution1') {
      records.desiIsInYourDebt = true
      records.youKnowThePassphrase = true
      const current = Number(campaign.tsk?.map?.time ?? records.time ?? 0)
      const theta = Math.min(FORCED_TIME_CAP, current + THETA_OFFSET)
      campaign.tsk ||= {}
      campaign.tsk.statusReports ||= { version: 1, triggered: [], pending: [], theta: null, psi: null }
      campaign.tsk.statusReports.theta = theta
      // 2026-11-13 P1-17：θ 是**战役记录**时间点（幕间 52 安全屋判定读 records.thetaTime）；
      // 此前只写 statusReports.theta，records.thetaTime 恒为 0 → 条件恒真，θ 之前就拿到奖励。
      records.thetaTime = theta
      flags.thetaTime = theta
      api.info?.(`📜 剧本日志：德西欠你一笔；你知道了口令（「黑鸟孤鸫」）；时间轴第 ${theta} 格写 Θ。`)
    } else {
      records.theCellDidntDiscoverTheTruthInHavana = true
      records.youHaventSeenTheLastOfDesiderioDelgadoAlvarez = true
      bearMirroringBlade(state, api)
      api.info?.('📜 剧本日志：特别小组没有发现哈瓦那的真相；你和德西之间恩怨未了。')
    }
    flags.resolution = key
    api.info?.(`🎬 疯星乱舞结算：${key}。`)
    return key
  },

  // 结局分派：有调查员撤退或德西被击败 → 结局 1；否则结局 2。
  finalResolution(state) {
    const resigned = (state.investigators || []).some(inv => inv.resigned)
    const defeated = dancingMadFlags(state).desiderioDefeated === true
    return resigned || defeated ? 'resolution1' : 'resolution2'
  },
}

// ---------------------------------------------------------------------------
// 幕背面实现（参考实现 FalseStepV1/V2、FalseColorsV1/V2、FalseLight 的 AdvanceAct 分支）
// ---------------------------------------------------------------------------
export const ACT_BACK_HANDLERS = Object.freeze({
  // 幕 1 v.I 背面：德西剧情资产放一边 → 队长抽德西敌人（隐匿），其他调查员各抽一张放一边的[[结社]]敌人；
  // 把遭遇弃牌堆与剩下的扫荡团伙/猩红阴谋洗回遭遇牌库。
  [RAW_CODES.act1v1](state, api) {
    const zones = (state.scenarioZones ||= {})
    zones.setAside ||= []
    for (const inv of state.investigators || []) {
      const index = (inv.assets || []).findIndex(asset => codeOf(asset) === RAW_CODES.desiderioAsset)
      if (index >= 0) {
        inv.assets.splice(index, 1)
        if (!zones.setAside.includes(RAW_CODES.desiderioAsset)) zones.setAside.push(RAW_CODES.desiderioAsset)
      }
    }
    api?.info?.('🎭 德西剧情资产放在一边（移除其上的所有标记与附属）。')
    const alive = aliveInvestigators(state)
    const lead = alive[0]?.seat ?? 0
    concealEnemy(state, api, RAW_CODES.desiderioEncounter, { seat: lead, allowTeamPayment: false })
    const pool = (zones.setAside || []).filter(code => traitsOf(code).includes('Coterie')
      && !DESIDERIO_ENEMY_CODES.includes(code))
    const drawn = []
    for (const inv of alive) {
      if (inv.seat === lead) continue
      const code = pool.find(candidate => !drawn.includes(candidate))
      if (!code) break
      drawn.push(code)
      zones.setAside = zones.setAside.filter(item => item !== code)
      concealEnemy(state, api, code, { seat: inv.seat, allowTeamPayment: false })
    }
    const back = [...(state.encounterDiscard || [])]
    state.encounterDiscard = []
    const remaining = [...DEAL_SET_ASIDE_DECK_CODES]
    for (const code of remaining) zones.setAside = zones.setAside.filter(item => item !== code)
    api?.shuffleIntoEncounterDeck?.([...back, ...remaining])
    markAlert(state, true)
    api?.info?.(`🔥 幕 1 v.I 背面：遭遇弃牌堆与 ${remaining.length} 张扫荡团伙/猩红阴谋卡洗回遭遇牌库；德西与同志会成员进入阴影。`)
  },

  // 幕 1 v.II 背面：域外敌人洗回牌库；德西回阴影；放一边的哈瓦那地点入场；迷你卡重新平均分配。
  [RAW_CODES.act1v2](state, api) {
    const zones = (state.scenarioZones ||= {})
    zones.setAside ||= []
    const outsiders = OUTSIDER_ENEMY_CODES
      .flatMap(code => Array(ALL_CARDS[code]?.quantity || 1).fill(code))
      .filter(code => zones.setAside.includes(code))
    for (const code of outsiders) zones.setAside = zones.setAside.filter(item => item !== code)
    api?.shuffleIntoEncounterDeck?.(outsiders)
    const inPlay = (state.enemies || []).find(enemy => codeOf(enemy) === RAW_CODES.desiderioEncounter)
    if (inPlay) state.enemies = state.enemies.filter(enemy => enemy !== inPlay)
    concealEnemy(state, api, RAW_CODES.desiderioEncounter, { allowTeamPayment: false })
    const placed = []
    for (const id of SET_ASIDE_LOCATION_IDS) {
      const code = locationCodeOf(state, id)
      if (code && (zones.setAside || []).includes(code)) zones.setAside = zones.setAside.filter(item => item !== code)
      api?.place?.(id)
      placed.push(id)
    }
    redistributeMiniCards(state, api)
    api?.info?.(`🌫️ 幕 1 v.II 背面：${placed.length} 处哈瓦那地点入场，迷你卡重新分配，德西回到阴影。`)
  },

  // 幕 2 v.I 背面：重整德西、清空标记与附属，把放一边的剧情资产翻成敌人面并在同一地点生成、混洗。
  [RAW_CODES.act2v1](state, api) {
    spawnSecondDesiderio(state, api)
  },

  // 幕 2 v.II 背面：先展示所有迷你卡（真身入场），再生成第二张德西并清空敌人线索
  // （每点线索治愈 1 点伤害）。
  [RAW_CODES.act2v2](state, api) {
    revealAllMiniCards(state, api)
    spawnSecondDesiderio(state, api)
    for (const enemy of state.enemies || []) {
      if (enemy.defeated) continue
      const clues = enemy.clues || 0
      if (!clues) continue
      enemy.clues = 0
      enemy.damageTaken = Math.max(0, (enemy.damageTaken || 0) - clues)
    }
    api?.info?.('🎭 幕 2 v.II 背面：揭示每张迷你卡；移除敌人身上的线索并按其数量治愈伤害。')
  },

  // 幕 3 背面：结局 1（把在场的那张德西收在安全处，供后续战役查看）。
  [RAW_CODES.act3](state, api) {
    const flags = dancingMadFlags(state)
    const inPlay = (state.enemies || []).find(enemy => isDesiderioCode(codeOf(enemy)) && !enemy.defeated)
      || (state.enemies || []).find(enemy => isDesiderioCode(codeOf(enemy)))
    flags.desiderioVersion = inPlay ? codeOf(inPlay) : null
    flags.desiderioStored = true
    api?.info?.('📦 幕 3 背面：把在场的那张德西收在安全处，本战役剩余时间不再查看其另一面。')
    api?.finish?.('resolution1')
  },
})

// ---------------------------------------------------------------------------
// 章节内部工具
// ---------------------------------------------------------------------------

function readTime(state, api) {
  const fromApi = mapApiOf(api)?.time?.()
  if (Number.isSafeInteger(fromApi)) return fromApi
  return mapTime(state)
}

function locationName(state, id) {
  return locationById(state, id)?.name || id
}

function remainingHealth(enemy) {
  const health = Number(enemy?.health ?? ALL_CARDS[codeOf(enemy)]?.health ?? 0)
  return Math.max(0, health - (enemy?.damageTaken || 0))
}

function payGroupCluesLocally(state, investigators, amount) {
  let left = amount
  for (const inv of investigators) {
    if (left <= 0) break
    const pay = Math.min(left, inv.clues || 0)
    inv.clues -= pay
    left -= pay
  }
  state.clues = (state.investigators || []).reduce((sum, inv) => sum + (inv.clues || 0), 0)
  return amount - left
}

function chooseDesiderioController(state, api) {
  const alive = aliveInvestigators(state)
  const lead = alive[0]?.seat ?? 0
  if (alive.length <= 1 || typeof api?.choice !== 'function') return lead
  const answer = api.choice({
    kind: 'story', source: RAW_CODES.desiderioAsset, seat: lead,
    prompt: '选择一位调查员控制「德西德柔·戴佳多·欧瓦瑞兹」剧情资产。',
    options: alive.map(inv => ({ id: String(inv.seat), label: inv.name || `调查员 ${inv.seat + 1}` })),
  })
  const seat = Number(answer)
  return alive.some(inv => inv.seat === seat) ? seat : lead
}

function createDesiderioAsset(state, seat) {
  const inv = state.investigators?.[seat]
  if (!inv) return null
  inv.assets ||= []
  const entry = entryOf(RAW_CODES.desiderioAsset) || {}
  const card = ALL_CARDS[RAW_CODES.desiderioAsset] || {}
  const asset = {
    id: `storyasset-${RAW_CODES.desiderioAsset}-${seat}`,
    code: RAW_CODES.desiderioAsset, originalCode: RAW_CODES.desiderioAsset,
    name: card.nameZh || card.name, controllerSeat: seat,
    exhausted: false, damage: 0, horror: 0,
    health: card.health ?? 4, sanity: card.sanity ?? null,
    traits: traitsOf(RAW_CODES.desiderioAsset),
    slots: [...(entry.slots || card.slots || [])],
  }
  inv.assets.push(asset)
  return asset
}

function bearMirroringBlade(state, api) {
  const records = recordsOf(state)
  try {
    const keys = keysApiOf(api)
    if (keys) keys.bind(MIRRORING_BLADE_KEY_ID, { type: 'enemy', enemyId: DESIDERIO_BEARER_ENEMY_CODE })
    else bindKey(state, MIRRORING_BLADE_KEY_ID, { type: 'enemy', enemyId: DESIDERIO_BEARER_ENEMY_CODE })
    api?.info?.('🗝️ 镜刃（09768）记在「德西德柔·戴佳多·欧瓦瑞兹（红字账）」名下。')
    return true
  } catch (error) {
    // 密钥容器未初始化或该敌尚未在场时，先记战役记录（战役 setup 初始化密钥后按记录补绑）。
    records.mirroringBladeBearer = DESIDERIO_BEARER_ENEMY_CODE
    api?.info?.(`🗝️ 镜刃归属先记账（${error.message}），战役记录 mirroringBladeBearer = ${DESIDERIO_BEARER_ENEMY_CODE}。`)
    return false
  }
}

function refillCafeLuna(state, api) {
  const cafe = locationById(state, START_LOCATION)
  if (!cafe) return null
  if ((cafe.clues || 0) > 0) return null
  const target = investigatorCount(state)
  cafe.clues = target
  cafe.maxClues = Math.max(cafe.maxClues || 0, target)
  api?.info?.(`☕ 月下餐厅没有线索：补充到 ${target} 个（每人 1 个）。`)
  return target
}

// [cultist] 失败：在所在地点放一张诱饵并翻面，然后混洗本地点每张迷你卡。
function makeDecoyAt(state, inv, api) {
  const locationId = inv?.location
  if (!locationId) return null
  placeMini(state, api, { kind: DECOY_MINI_KIND, decoy: true, locationId })
  reshuffleConcealed(state)
  api?.info?.(`🃏 [cultist]：在「${locationName(state, locationId)}」放置一张诱饵并翻面，混洗该地点的迷你卡。`)
  return locationId
}

// [elderthing]：本地有隐匿迷你卡时，受到 1/2 点伤害，或把标记修正视为 -3/-5。
function elderThingConcealedChoice(state, inv, api) {
  const here = concealedAt(state, inv.location)
  if (!here.length) return null
  const hard = ['hard', 'expert'].includes(String(state.difficulty || 'standard'))
  const damage = hard ? 2 : 1
  const alternative = hard ? 5 : 3
  const answer = typeof api?.choice === 'function'
    ? api.choice({
      kind: 'effect', source: RAW_CODES.scenario, seat: inv.seat,
      prompt: `[elderthing]：受到 ${damage} 点伤害，或将本标记的修正值视为 -${alternative}？`,
      options: [{ id: 'damage', label: `受到 ${damage} 点伤害` }, { id: 'modifier', label: `视为 -${alternative}` }],
    })
    : 'damage'
  if (answer === 'modifier') {
    dancingMadFlags(state).elderThingModifier = { seat: inv.seat, value: -alternative, round: state.round }
    api?.info?.(`🌀 [elderthing]：本次检定的修正值视为 -${alternative}。`)
    return { modifier: -alternative }
  }
  inv.damage = (inv.damage || 0) + damage
  api?.info?.(`🌀 [elderthing]：${inv.name} 受到 ${damage} 点伤害。`)
  return { damage }
}

// 议程 1/2 背面：队长二选一 —— 搜索遭遇牌库/弃牌堆抽一个隐匿敌人，或揭示每位调查员牌库顶并处理空洞。
function leadChoosesConcealedOrHollow(state, agenda, api) {
  const lead = aliveInvestigators(state)[0]?.seat ?? 0
  const answer = typeof api?.choice === 'function'
    ? api.choice({
      kind: 'story', source: codeOf(agenda), seat: lead,
      prompt: '调查员队长必须决定（选择一项）：',
      options: [
        { id: 'concealed', label: '查找遭遇牌库和弃牌堆，找出一个带隐匿关键词的敌人并抽取' },
        { id: 'hollow', label: '揭示每位调查员牌库顶的卡牌：弱点抽取，其它作为空洞' },
      ],
    })
    : 'hollow'
  if (answer === 'concealed') {
    const pool = [...(state.encounterDeck || []), ...(state.encounterDiscard || [])]
    const code = pool.find(candidate => /Concealed \d/.test(String(ALL_CARDS[candidate]?.text || '')))
    if (!code) {
      api?.info?.('🔍 遭遇牌库与弃牌堆里没有带隐匿关键词的敌人。')
      return null
    }
    api?.takeEncounterCard?.(code)
    concealEnemy(state, api, code, { seat: lead, allowTeamPayment: false })
    api?.info?.(`🔍 议程背面：抽取「${cardNameOf(code)}」并结算其隐匿关键词。`)
    return code
  }
  const hollowed = []
  for (const inv of aliveInvestigators(state)) {
    const top = (inv.deck || []).pop()
    if (!top) continue
    if (isWeakness(top)) {
      inv.hand.push(top)
      api?.info?.(`🔍 ${inv.name} 揭示牌库顶的弱点并将其抽取。`)
      continue
    }
    if (isHollowed(state, top)) continue
    const created = hollowOne(state, api, { code: top, source: codeOf(agenda), scope: 'investigator', seat: inv.seat })
    if (created) hollowed.push(top)
  }
  api?.info?.(`🕳️ 议程背面：${hollowed.length} 张牌库顶的卡牌放在一边，作为空洞。`)
  return hollowed
}

// 议程 3 背面（抹除）：收齐本关所有空洞，每位调查员把经验值最高的一张放逐并记入存在抹除。
function erasureResolution(state, api) {
  const flags = dancingMadFlags(state)
  const all = hollowCards(state)
  const byOwner = new Map()
  for (const card of all) {
    const key = card.scope === 'investigator' ? card.seat : -1
    const list = byOwner.get(key) || []
    list.push(card)
    byOwner.set(key, list)
  }
  const xpOf = code => Number(ALL_CARDS[code]?.xp ?? ALL_CARDS[code]?.level ?? 0)
  const erased = []
  for (const [, cards] of byOwner) {
    const highest = [...cards].sort((left, right) => xpOf(right.code) - xpOf(left.code))[0]
    if (highest) erased.push(highest)
  }
  const codes = erased.map(card => card.code)
  if (codes.length) {
    try {
      const adapter = hollowApiOf(api)
      if (adapter) adapter.erase(codes)
      else for (const code of codes) recallHollow(state, code, { to: 'discard' })
    } catch (error) {
      api?.info?.(`🕳️ 存在抹除登记跳过：${error.message}`)
    }
    const records = recordsOf(state)
    const names = codes.map(code => cardNameOf(code))
    // `erasedFromExistence` 是印刷复选框（布尔），被放逐的卡名记在 erasedCards（字符串数组）。
    records.erasedFromExistence = true
    records.erasedCards = [...new Set([...(records.erasedCards || []), ...names])]
    api?.info?.(`🕳️ 存在抹除：${names.join('、')} 被放逐（本战役剩余时间不可加入牌库）。`)
  }
  // 其余空洞「移出游戏」：记账到章节台账（结局后不再影响局面）。
  for (const card of all) {
    if (!codes.includes(card.code) && !flags.hollowsRemoved.includes(card.code)) flags.hollowsRemoved.push(card.code)
  }
  flags.erasedCodes = codes
  api?.finish?.('resolution2')
  return codes
}

// 第二张德西：重整并清空第一张，把剧情资产面翻成敌人面，在同一地点生成并随机化。
function spawnSecondDesiderio(state, api) {
  const first = (state.enemies || []).find(enemy => isDesiderioCode(codeOf(enemy)))
  const locationId = first?.location || aliveInvestigators(state)[0]?.location || START_LOCATION
  if (first) {
    first.exhausted = false
    first.doom = 0
    first.damageTaken = 0
    first.attachments = []
  }
  const secondCode = codeOf(first) === RAW_CODES.desiderioEncounter
    ? RAW_CODES.desiderioLinkedEnemy : RAW_CODES.desiderioEncounter
  const second = api?.spawn?.(secondCode, locationId) || null
  const flags = dancingMadFlags(state)
  flags.secondDesiderioSpawned = true
  if (first) {
    // 两张在同一地点：把两个印刷面按稳定顺序重排，让玩家无法分辨哪张是哪张（实体 id 不变）。
    const codes = [codeOf(first), secondCode].sort()
    first.code = codes[0]
    first.originalCode = codes[0]
    if (second) {
      second.code = codes[1]
      second.originalCode = codes[1]
    }
  }
  api?.info?.(`🎭 第二张德西在「${locationName(state, locationId)}」生成；两张的印刷面混洗后不再可分辨。`)
  return second
}

function revealAllMiniCards(state, api) {
  const cards = concealedMiniCards(state)
  for (const card of [...cards]) {
    const result = exposeMini(state, api, card.id)
    if (!result || result.decoy) continue
    const code = enemyCodeOfMiniKind(result.kind)
    if (code) api?.spawn?.(code, card.locationId)
  }
  api?.info?.(`🌫️ 揭示场上每张隐匿迷你卡：${cards.length} 张翻面，真身在原地点入场。`)
  return cards.length
}

function redistributeMiniCards(state, api) {
  const cards = concealedMiniCards(state)
  if (!cards.length) return []
  const specs = cards.map(card => ({ kind: card.kind, decoy: card.decoy }))
  for (const card of cards) exposeMini(state, api, card.id)
  return distributeEvenly(state, api, specs, shadowCandidateIds(state))
}

export { RAW_CODES, START_LOCATION, SET_ASIDE_LOCATION_IDS, HAVANA_LOCATION_IDS }
export const enemyCodes = () => [...DESIDERIO_ENEMY_CODES]
