// 建局（createGameState / 调查员准备 / 关卡布置 / 混乱袋）从 engine.js 拆出的模块
// （Phase 6 · 6d-18）。
//
// 「一局怎么开始」的全部步骤：选调查员、建牌组、发起手、准备关卡地点与敌人、
// 布置遭遇牌库与混乱袋、进入第一关。这是 engine.js 里最长的一段准备逻辑，
// 拆出来后主文件只剩「运行时」：动作、检定、阶段、API。
//
// 依赖注入同前；被外部 import 的三个名字（createGameState / refreshStateResources /
// unknownCardCodes）在 engine.js 里用函数声明再导出，调用点不变。

import { normalizeScenarioHaunted } from './haunted.js'
import { enterOpeningHandCards } from './tarot-slot.js'
import {
  isStoryInvestigator, normalizeStoryInvestigatorConfig, prepareStoryInvestigator,
  restoreStoryInvestigators, selectStoryInvestigators, storyInvestigatorSetupCards,
} from './story-investigators.js'
import { requestChoice } from './resolution.js'
import { investigatorRule } from '../cards/card-rules.js'
import { contentRegistry } from '../../content/registered.js'
import {
  CARD_POOL_SCOPE_LABELS, allowsCard, cardPoolContext, normalizeCardPoolScope,
} from '../deck/card-pool.js'

export function createSetup(deps) {
  const {
    ALL_INVESTIGATORS,
    CARD_CODE,
    CHAOS_BAGS,
    CLASS_COLOR,
    CLASS_EMOJI,
    CLASS_NAMES,
    DERIVED_STATE_KEYS,
    EFFECTS,
    META,
    returnAllBonded,
    PLAYABLE_INVESTIGATORS,
    RULES_VERSION,
    SCENARIOS,
    SKILL_NAMES,
    STATE_SCHEMA_VERSION,
    TOKEN_LABEL,
    allCardDefs,
    basicWeaknessPool,
    buildDeck,
    buildDeckFromList,
    campaignFor,
    campaignManifestFor,
    campaignState,
    canSelectInvestigator,
    cardDef,
    cardName,
    consumeStartingAdjustments,
    corePlayerPool,
    descriptorOfKind,
    embeddedCardDefs,
    executeCommand,
    executeDescriptor,
    expeditionLeaderSeat,
    expireEffects,
    extraActionBonus,
    firstAliveSeat,
    hashSeed,
    inHub,
    info,
    hunchDeck,
    initialHubScenarioMoves,
    initializeChaosBag,
    introduction,
    isWeaknessCode,
    legalMoves,
    locName,
    // 地点特性原语（location-traits.js）：布置完地点后让当前幕声明的特性连接规则生效。
    locationTraits,
    newPlayerAssetInstance,
    openAbilityWindow,
    placeLocation,
    randomUUID,
    randomValue,
    registerCampaignInvestigator,
    registerCampaignScenarios,
    registeredEntry,
    relicOfAges,
    removeCardByCode,
    resolveAgendaDoomThresholds,
    resolveTransaction,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    spawnEnemy,
    tokenLabel,
  } = deps

function makeInvestigator(invDef, seat) {
  return {
    seat,
    code: invDef.code,
    name: invDef.nameZh || invDef.name,
    nameEn: invDef.name,
    klass: invDef.klass,
    willpower: invDef.willpower, intellect: invDef.intellect,
    combat: invDef.combat, agility: invDef.agility,
    baseHealth: invDef.health, baseSanity: invDef.sanity,
    health: invDef.health, sanity: invDef.sanity,
    maxHealth: invDef.health, maxSanity: invDef.sanity,
    damage: 0, horror: 0,
    resources: 5,
    clues: 0,
    actionsLeft: 3,
    hand: [], deck: [], discard: [], hiddenCards: [],
    assets: [],           // [{ id, code, exhausted, uses? }]
    threat: [],           // 威胁区域：持续型弱点/诡计 [{ id, code, ... }]
    // 第 124 轮：初始地点留空，由 prepareInvestigator / 剧本 setup 写入真实起点。
    // 这一步会改变初始状态指纹，13 局 replay 基线已同步重录（只有第 0 步变化）。
    location: null,
    engaged: [],          // enemy ids
    defeated: false,
    resigned: false,
    defeatCause: null,    // 'damage' | 'horror'
    testBonus: 0,
    phaseStatBonus: null,
    skillSubstitute: null,
    onTheLam: false,
    fearExtraPaid: false,
    usedReactions: {},
    autoBuilt: true,
    deckName: '自动构筑 · ' + (CLASS_NAMES[invDef.klass] || invDef.klass) + ' ' + (CLASS_EMOJI[invDef.klass] || ''),
  }
}

function drawOpeningHand(state, inv) {
  const weaknesses = []
  // Phase 5（5a-33）：起手张数由调查员能力数据声明（默认 5）。
  // 第 5 步 P7：在场永久卡的条目级修正（05276 苦心钻研）在这里叠加；读点只有这一处。
  const target = (investigatorRule(inv.code)?.openingHandSize || 5)
    + (inv.assets || []).reduce((sum, asset) => sum + (registeredEntry(asset.code)?.openingHandBonus || 0), 0)
  while (inv.hand.length < target && inv.deck.length) {
    const code = inv.deck.pop()
    if (isWeaknessCode(code)) {
      // 2026-10-25：05042「高塔·XVI」这类「必须留在起始手牌」的弱点由条目级字段声明，
      // 不再洗回牌库（其余弱点仍按规则洗回）。
      if (registeredEntry(code)?.staysInOpeningHand) inv.hand.push(code)
      else weaknesses.push(code)
    } else inv.hand.push(code)
  }
  inv.deck = shuffle([...inv.deck, ...weaknesses], () => randomValue(state))
}

// 为调查员构筑牌库：人类座位若设置了自定义卡组（settings.playerDeck）则用自定义清单，
// 校验失败拒绝开局；其余座位（AI）始终使用相同许可池自动构筑。

function buildInvestigatorsDeck(state, inv, def, events) {
  const opts = {
    seat: inv.seat,
    seed: Math.floor(randomValue(state) * 4294967296),
    playerPool: corePlayerPool(state),
    basicWeaknessPool: basicWeaknessPool(state),
  }
  if (inv.seat === 0 && state.customPlayerDeck) {
    const built = buildDeckFromList(def, state.customPlayerDeck, opts)
    if (built.errors && built.errors.length) {
      throw new Error(`自定义卡组无效：${built.errors.join('；')}`)
    }
    info(state, events, `🃏 ${inv.name} 使用自定义卡组（${built.playerCards.length} 张玩家卡）。`)
    return built
  }
  return buildDeck(def, opts)
}

// 故事调查员的「固定属性」：职业与四项技能按卡面印刷值写入（生命/理智已在上方按新卡号写入）。
// 没有这一步，序章会沿用开局时原本调查员的技能与职业（例如普雷斯顿 05003 的 1/1/1/1），
// 序章里的检定、UI 人物面板与 AI 决策都会按错误数值结算。
function applyStoryInvestigatorStats(inv, def) {
  if (!def) return
  inv.nameEn = def.name
  inv.klass = def.klass
  inv.willpower = def.willpower
  inv.intellect = def.intellect
  inv.combat = def.combat
  inv.agility = def.agility
}

// 只在新关卡开局调用：清掉「一关之内」的调查员临时记账（与 beneath/attachments 同类跨关残留）。
// 新关卡从 round=1、新的 game 作用域重新计数，残留的「每场游戏/每轮/每阶段一次」标记会与
// 新关卡的序号重名而被误判成「已经用过」；没花掉的临时代价/加成也会直接作用到新关卡第一张牌。
// 刻意不清：牌面属性、战役身份（campaignId/storyInvestigator/noDeck/role）与牌组信息。
const TRANSIENT_INVESTIGATOR_FIELDS = Object.freeze([
  // 「每场游戏一次 / 每阶段 / 每轮一次」的能力记账
  'gameFlags', 'usedAbilities', 'weaknessCounters', 'phaseStatBonuses',
  // 没在上一关用掉的开局/下一张牌代价减免与升级
  'playDiscount', 'lolaDiscount', 'itemDiscountAtLocation',
  'playUpgrades05111', 'playUpgrades05234', 'playUpgrades05277',
  // 临时属性/检定标记与关内剧情记账
  'statOverrides', 'enemyPassiveTraits', 'nextTestNoTokens',
  'shuffleWeaknessAfterResolution', 'turnEnded',
  // 按轮/按回合记账、但字段名不带 Round/Turn 后缀的散标记（读点都带轮次比较，
  // 新关卡 round=1 会与上一关第 1 轮撞号）：
  'fieldwork', 'infighting', 'narrowEscape', 'jakeFree', 'ritaEvadeUses',
  'pendingActionLoss', 'hiddenMoves', 'spellOnlyActions',
])

function clearInvestigatorTransients(campaignState, inv) {
  for (const key of TRANSIENT_INVESTIGATOR_FIELDS) if (inv[key] !== undefined) delete inv[key]
  // 战役专属的调查员临时记账（打出折扣/押注/演出奖励行动/禁重整回合……）由战役状态切片负责，
  // 字段名只允许出现在 src/cards/campaign-state.js（Phase 6 门禁）。
  campaignState.clearScenarioTransients(inv)
  // 轮次/回合作用域的散标记（*Round / *Turn / *ThisTurn / *Used）：round 在新关卡从 1 重数，
  // 上一关第 1 轮留下的值会与新关卡第 1 轮相等而误判（例如丽塔的每轮躲避次数、05016 的
  // 本轮「躲避改为伤害」、调查员的「下个回合额外行动」）。内容层今后新增的同名标记也一并覆盖。
  for (const key of Object.keys(inv)) {
    if (/(?:Round|Turn|ThisTurn|Used)$/.test(key)) delete inv[key]
  }
}

// 只在新关卡开局调用：清掉上一关遗留的、不属于任何一张卡的全局场面/记账。
// 牌本身仍在战役牌组记录里（prepareInvestigator 会按记录重建牌组），地点/遭遇牌堆也会重新
// 布置；不清掉这些「关内临时区」会与新一关叠成两份，或被本关的效果误读。
function clearScenarioSceneLeftovers(state) {
  // 玩家卡附属在地点上（「捷径」「埋伏」等）：旧附属会让新关卡同名地点直接可点/可移动。
  if (state.playerLocationAttachments?.length) state.playerLocationAttachments = []
  // 「放到一边」「移出游戏」：关内临时区；旧卡会被区域检索找到，也会残留在移出区（牌组重建后
  // 同一张卡同时存在于牌库与移出区）。
  if (state.setAside?.length) state.setAside = []
  if (state.removedFromGame?.length) state.removedFromGame = []
  // 备用地点牌堆（alt-decks.js）：逐关重建。
  if (state.extraLocationDecks) state.extraLocationDecks = {}
  // 闹鬼地点的临时授权/本次投入记费。
  if (state.hauntedGrants?.length) state.hauntedGrants = []
  if (state.hauntedCommitCost) delete state.hauntedCommitCost
  // 幕旁提醒条与议程翻面展示状态。
  if (state.actReminders?.length) state.actReminders = []
  if (state.agendaFace) delete state.agendaFace
  // 本回合/本阶段锁与排队中的「下一次行动期间生效」效果。
  if (state.agendaDoomLock) delete state.agendaDoomLock
  if (state.pendingActionEffects?.length) delete state.pendingActionEffects
  // 上一关最后一次失败检定的重试上下文（「学无止境」等会直接重试它）。
  if (state.lastFailedTest) delete state.lastFailedTest
  // 内容层的关卡临时键（部分战役把自己的关卡记账写在这里）：只在该关有效。
  if (state.scenarioKeys) delete state.scenarioKeys
  // 上限记账（limits.js）：perCampaign 的键（...|campaign）要跨关保留；其余键里带着
  // round/phase/game，新的 round=1 会与上一关第 1 轮同号键重名，误判「已经用过」。
  if (state.abilityLimits) {
    const kept = Object.fromEntries(Object.entries(state.abilityLimits).filter(([key]) => key.endsWith('|campaign')))
    if (Object.keys(kept).length) state.abilityLimits = kept
    else delete state.abilityLimits
  }
}

function prepareInvestigator(state, inv, events, startLocation) {
  const def = ALL_INVESTIGATORS[inv.code]
  // 先清上一关的临时记账，再按本关重设规范字段：这样像 tomeActionUsed 这种「开局显式
  // 重置为 false」的字段不会在清理阶段被删掉（否则状态形状会随加载路径抖动）。
  clearInvestigatorTransients(campaignState, inv)
  // 第 2 步 P2.6：无牌组故事调查员——不登记战役身份、不建牌库、不受创伤。
  const story = isStoryInvestigator(state, inv)
  let record = story ? null : state.campaign.investigators[inv.seat]
  let deck = []
  if (!story) {
    if (!record) {
      const built = buildInvestigatorsDeck(state, inv, def, events)
      record = registerCampaignInvestigator(state.campaign, inv, built.deck)
      deck = built.deck
    } else {
      if (record.code !== inv.code || record.status !== 'active') throw new Error('调查员战役身份不可进入剧本')
      deck = shuffle(record.deck, () => randomValue(state))
    }
  }
  const trauma = story ? { physical: 0, mental: 0 } : state.campaign.trauma[inv.seat]
  if (record) inv.campaignId = record.id
  inv.baseHealth = def.health
  inv.baseSanity = def.sanity
  inv.maxHealth = def.health
  inv.maxSanity = def.sanity
  inv.health = def.health
  inv.sanity = def.sanity
  inv.damage = trauma.physical
  inv.horror = trauma.mental
  inv.resources = 5
  inv.clues = 0
  // 这里只放基础行动点；额外行动要等下面清掉上一关的资产、重新摆好本关开局阵容后再算。
  // 否则上一关场上的「里奥·德·卢卡」会把 +1 行动带进新关卡，再打出第二张就变成 +2。
  inv.actionsLeft = 3
  inv.exploreOnlyActions = 0
  inv.tomeActionUsed = false
  inv.hand = []
  inv.deck = deck
  inv.discard = []
  inv.hiddenCards = []
  inv.assets = []
  inv.threat = []
  inv.engaged = []
  // 压在调查员底下的牌（黛安娜·史丹利 05004 / 赛菲娜 05002）与附属在调查员身上的牌是上一关的
  // 场面状态；牌本身仍在战役牌组记录里（本关会按记录重建牌组），若不清空，同一张卡会同时留在
  // 「下方」或附属区和牌库里——玩家可见的症状就是「平白多出几张底下的牌」。
  // 只在确有残留时才置空：旧局/重放里这两个字段本来就缺省，别凭空改变状态形状（指纹）。
  // 回归用例见 tests/scenario-reset.test.mjs。
  if (inv.beneath?.length) inv.beneath = []
  if (inv.attachments?.length) inv.attachments = []
  inv.defeated = false
  inv.resigned = false
  inv.defeatCause = null
  inv.testBonus = 0
  inv.phaseStatBonus = null
  inv.skillSubstitute = null
  inv.onTheLam = false
  inv.fearExtraPaid = false
  inv.usedReactions = {}
  inv.location = startLocation
  inv.handSlotsPenalty = state.locations.find(location => location.id === startLocation)?.handSlotsPenalty || 0
  if (story) {
    // 无牌组故事调查员：职业/技能用卡面印刷的固定属性，deck/hand/discard 清空，
    // 专属设置卡直接入场（不占 30 张）。
    applyStoryInvestigatorStats(inv, def)
    const { setupCards } = prepareStoryInvestigator(inv, { setupCards: storyInvestigatorSetupCards(state, inv.code) })
    for (const code of setupCards) inv.assets.push(newPlayerAssetInstance(state, inv, code))
    inv.actionsLeft = 3 + extraActionBonus(inv)
    info(state, events, `📜 ${inv.name} 是故事调查员：没有牌组，起始手牌为 0。`)
    return
  }
  const startsWith = investigatorRule(inv.code)?.startsWith
  for (const code of startsWith == null ? [] : Array.isArray(startsWith) ? startsWith : [startsWith]) {
    if (removeCardByCode(inv.deck, code)) inv.assets.push(newPlayerAssetInstance(state, inv, code))
  }
  // 第 5 步 P6：直觉牌库（乔·戴蒙德）——必须在发起手之前把 11 张洞察事件从牌库里分出来。
  hunchDeck.prepare(state, inv, events)
  for (const code of inv.deck.filter(code => cardDef(code)?.permanent)) {
    removeCardByCode(inv.deck, code)
    const card = newPlayerAssetInstance(state, inv, code)
    if (cardDef(code)?.type === 'treachery') inv.threat.push(card)
    else inv.assets.push(card)
    // Phase 6（6e-15）：起始资源修正从条目级字段读（旧 DSL 条目回落）。
    inv.resources = Math.max(0, inv.resources + (registeredEntry(code)?.startingResources ?? 0))
    // Phase 5（5c-39）：「原定计划」这类开局效果改成描述子（kind: 'setup'）；
    // 旧的数据体 setup 仍是回退路径，保证未迁移的卡不受影响。
    const setupDescriptor = descriptorOfKind(code, 'setup')
    if (setupDescriptor?.resolve) {
      executeDescriptor(state, { inv, source: card, descriptor: setupDescriptor, events, silent: true })
    } else {
      const setup = null
    }
  }
  // 开局就带在身上的支援（签名卡 / 永久卡）也计入额外行动；上一关的资产已在上面清空，
  // 因此这里只会读到本关真实在场的卡。
  inv.actionsLeft = 3 + extraActionBonus(inv)
  drawOpeningHand(state, inv)
  // 第 5 步 P6：「每场游戏开始时，你的起始手牌中额外有一张 X」（黛安娜·史丹利的黑暗洞察）。
  const extraOpening = investigatorRule(inv.code)?.openingHandExtra
  for (const code of extraOpening == null ? [] : Array.isArray(extraOpening) ? extraOpening : [extraOpening]) {
    if (removeCardByCode(inv.deck, code)) {
      inv.hand.push(code)
      info(state, events, `🖐️ ${inv.name} 的起始手牌额外获得「${cardName(code)}」。`)
    }
  }
  // 第 2 步 P2.9：起始手牌里的塔罗可以直接放置入场（不付费用，条目声明）。
  enterOpeningHandCards(state, inv, {
    lookup: code => registeredEntry(code),
    createAsset: (target, owner, code) => newPlayerAssetInstance(target, owner, code),
    info,
    events,
  })
  // 幕间留下的下一场修正（原卡：配给不足 → 起始资源 -3，水壶 → 起始线索 +1）。
  consumeStartingAdjustments(state, inv, events)
  if ((trauma.physical || 0) > 0 || (trauma.mental || 0) > 0) {
    info(state, events, `${inv.name} 因创伤以 ${inv.damage} 点伤害、${inv.horror} 点恐惧开始本关；生命与理智上限不变。`)
  }
}

function refreshStateResources(state) {
  const campaignId = state.campaign?.id
  if (!campaignId || !contentRegistry.getCampaign(campaignId)) throw new Error(`存档所属战役 ${campaignId || '(缺失)'} 已不可用`)
  registerCampaignScenarios(campaignId)
  if (state.scenario?.id && !SCENARIOS[state.scenario.id]) throw new Error(`存档所在关卡 ${state.scenario.id} 已不可用`)
  state.resourceVersion = META.resourceVersion
  state.cards = inHub(state) ? allCardDefs({ runtimeOnly: true, campaignId })
    : embeddedCardDefs(state, campaignId)
  state.investigatorDefs = Object.fromEntries(PLAYABLE_INVESTIGATORS.map(code => [code, ALL_INVESTIGATORS[code]]))
  state.classNames = CLASS_NAMES
  state.classColors = CLASS_COLOR
  state.skillNames = SKILL_NAMES
  state.tokenLabels = TOKEN_LABEL
  return state
}

// 内嵌资源与派生字段不参与卡号核对；其余位置出现的卡号必须能在当前资源中解析。

function unknownCardCodes(state) {
  if (state.campaign?.id) registerCampaignScenarios(state.campaign.id)
  const missing = new Set()
  const check = value => { if (typeof value === 'string' && CARD_CODE.test(value) && !cardDef(value)) missing.add(value) }
  const walk = (value, depth) => {
    if (!value || typeof value !== 'object' || depth > 64) return
    if (Array.isArray(value)) { for (const item of value) typeof item === 'object' ? walk(item, depth + 1) : check(item); return }
    for (const [key, item] of Object.entries(value)) {
      if (depth === 0 && DERIVED_STATE_KEYS.has(key)) continue
      if (typeof item === 'object') walk(item, depth + 1)
      else if (key === 'code' || key === 'originalCode') check(item)
    }
  }
  walk(state, 0)
  return [...missing].sort()
}

function createGameState(settings, players) {
  const manifest = contentRegistry.assertLaunchable(settings.campaignId || contentRegistry.listCampaigns()[0].id)
  const CAMPAIGN = { ...manifest, scenarioOrder: manifest.scenarioIds }
  registerCampaignScenarios(manifest.id)
  const rulesMode = settings.rulesMode || 'simplified'
  if (!['simplified', 'strict'].includes(rulesMode)) throw new Error('未知识别的规则模式')
  if (settings.playerDeck != null && !Array.isArray(settings.playerDeck)) throw new Error('自定义卡组必须是卡号数组')
  // 游戏高级设置（开局固定、随存档保留）：
  //   cardPoolScope  全部 / 渐进式（只允许当前循环及更早循环的卡牌）
  //   allowRollback  是否允许从关卡检查点回档
  const cardPoolScope = normalizeCardPoolScope(settings.cardPoolScope)
  const allowRollback = !(settings.allowRollback === false || settings.allowRollback === 'off')
  const poolContext = cardPoolContext({ scope: cardPoolScope, campaignId: manifest.id })
  // New games get independent randomness; explicit seeds remain reproducible.
  // The seed and evolving rngState are persisted with the game for resuming.
  const seed = String(settings.seed ?? randomUUID())
  const randomState = { rngState: hashSeed(seed) >>> 0 }
  // 渐进式会同时收窄可选调查员；全部模式保持原来的候选表与随机流。
  const invCodes = PLAYABLE_INVESTIGATORS.filter(code => allowsCard(code, poolContext))
  const rng = () => randomValue(randomState)
  // 调查员候选顺序只影响 AI 选人；用独立随机流，避免新增调查员改变主随机流
  // （否则旧种子对局的牌序、遭遇与混乱标记会随卡池扩张而漂移）。
  const orderState = { rngState: hashSeed(`${seed}:investigator-order`) >>> 0 }
  const order = shuffle(invCodes, () => randomValue(orderState))

  let humanPick = settings.playerInvestigator
  if (!humanPick || humanPick === 'auto' || humanPick === '__random__') humanPick = order[0]
  if (!canSelectInvestigator(humanPick) || !Object.hasOwn(ALL_INVESTIGATORS, humanPick)) {
    throw new Error(`调查员未开放：${humanPick}`)
  }
  if (!allowsCard(humanPick, poolContext)) {
    throw new Error(`调查员超出当前卡牌范围（${CARD_POOL_SCOPE_LABELS[cardPoolScope]}）：${humanPick}`)
  }

  // 重放（src/engine/replay.js）需要按座位复现建局结果。AI 席位的调查员由 persona
  // 与独立随机流决定，而 persona 不进 state，所以允许显式给出逐座位卡号；
  // 只用于重放/测试，正常开局不传这个字段。
  const seatInvestigators = settings.seatInvestigators
  if (seatInvestigators != null) {
    if (!Array.isArray(seatInvestigators) || seatInvestigators.length !== players.length) {
      throw new Error('座位调查员必须是与席位数一致的卡号数组')
    }
    if (new Set(seatInvestigators).size !== seatInvestigators.length) throw new Error('座位调查员不能重复')
    seatInvestigators.forEach((code, index) => {
      if (!Object.hasOwn(ALL_INVESTIGATORS, code) || !canSelectInvestigator(code)) throw new Error(`调查员未开放：${code}`)
      if (!allowsCard(code, poolContext)) throw new Error(`调查员超出当前卡牌范围（${CARD_POOL_SCOPE_LABELS[cardPoolScope]}）：${code}`)
      if (players[index].seat === 0 && code !== humanPick) throw new Error('座位调查员与主角调查员不一致')
    })
  }

  const used = new Set()
  const investigators = []
  for (const [index, p] of players.entries()) {
    let code
    if (seatInvestigators) {
      code = seatInvestigators[index]
    } else if (p.seat === 0) {
      code = humanPick
    } else {
      code = pickAiInvestigator(p, order, used, invCodes)
    }
    used.add(code)
    investigators.push(makeInvestigator(ALL_INVESTIGATORS[code], p.seat))
  }

  const difficulty = settings.difficulty || 'standard'
  const state = {
    schemaVersion: STATE_SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    revision: 0,
    seed,
    // 建局参数快照：重放（src/engine/replay.js）需要它才能重建同一局。
    // seatInvestigators 记的是**建局时**逐座位选到的调查员；关间换人由动作日志重放，
    // 不覆盖这份快照，否则重放时的开局日志与真人/AI 选人顺序会对不上。
    setup: {
      rulesMode,
      playerDeck: Array.isArray(settings.playerDeck) ? [...settings.playerDeck] : null,
      seatInvestigators: investigators.map(inv => inv.code),
    },
    rngState: randomState.rngState,
    instanceSeq: { c: 0, e: 0 },
    status: 'playing',
    hubFlow: !!settings.campaignHub,
    uiState: settings.campaignHub ? 'campaignHub' : 'inScenario',
    winnerSeat: null,
    currentSeat: 0,
    moveCount: 0,
    round: 1,
    phase: settings.campaignHub ? 'campaignHub' : 'investigation',
    outcome: null,
    resolution: null,
    scenario: null,
    difficulty,
    numInvestigators: investigators.length,
    humanSeats: players.filter(p => p.role === 'human' || (p.role == null && p.seat === 0)).map(p => p.seat),
    actIndex: 0,
    agendaIndex: 0,
    doom: 0,
    clues: 0,
    victory: 0,
    actClues: 0,
    fogMod: 0,
    investigators,
    locations: [],
    enemies: [],
    encounterDeck: [],
    encounterDiscard: [],
    cultistDeck: [],
    cultistsInVictory: [],
    chaosBag: [],
    sealedTokens: [],
    exiled: [],
    exiledBySeat: [],
    // Phase 1（A1）：持续效果实体。纯 JSON、随存档往返，过期只经 expireEffects()。
    effects: [],
    log: [],
    legalMoves: [],
    customPlayerDeck: Array.isArray(settings.playerDeck) ? settings.playerDeck.slice() : null,
    aiStoryAwareness: settings.aiStoryAwareness === true || settings.aiStoryAwareness === 'on',
    // 游戏高级设置只在非默认值时写入状态：默认局（全部 / 允许回档）的状态形状
    // 与旧存档、旧重放基线保持一致；读取方一律按「缺省 = all / 允许」处理。
    ...(cardPoolScope === 'progressive' ? { cardPoolScope } : {}),
    ...(allowRollback ? {} : { allowRollback: false }),
    resourceVersion: META.resourceVersion,
    rulesMode,
    cards: allCardDefs({ runtimeOnly: true, campaignId: CAMPAIGN.id }),
    investigatorDefs: Object.fromEntries(PLAYABLE_INVESTIGATORS.map(code => [code, ALL_INVESTIGATORS[code]])),
    classNames: CLASS_NAMES,
    classColors: CLASS_COLOR,
    skillNames: SKILL_NAMES,
    acts: [],
    agendas: [],
    tokenLabels: TOKEN_LABEL,
    campaign: {
      id: CAMPAIGN.id,
      name: CAMPAIGN.name,
      scenarioCount: CAMPAIGN.scenarioOrder.length,
      scenarioIndex: 0,
      phase: settings.campaignHub ? 'campaignHub' : 'scenario',
      leadSeat: players.find(p => p.role === 'human' || (p.role == null && p.seat === 0))?.seat ?? null,
      leadConfirmed: !settings.campaignHub || players.filter(p => p.role === 'human' || (p.role == null && p.seat === 0)).length === 1,
      investigatorSeq: 0,
      investigators: {},
      retired: [],
      scenarioResults: [],
      victory: 0,
      xp: 0,
      trauma: {},
      recordSchema: structuredClone(CAMPAIGN.recordSchema || {}),
      records: Object.fromEntries(Object.entries(CAMPAIGN.recordSchema || {}).map(([key, type]) =>
        [key, type === 'boolean' ? false : type === 'number' ? 0 : type === 'string[]' ? [] : ''])),
      finished: false,
      result: null,
    },
  }

  state.log.push('🎬 战役开始：' + CAMPAIGN.name)
  for (const inv of investigators) {
    state.log.push(`${CLASS_EMOJI[inv.klass] || ''} ${inv.name}（${CLASS_NAMES[inv.klass] || inv.klass}）加入调查队。`)
  }
  if (state.hubFlow) {
    state.hubSelectedScenarioId = initialHubScenarioMoves(state).length > 1 ? null : CAMPAIGN.scenarioOrder[0]
    state.hubSeatSelected = {}
    state.hubSeatDone = {}
    state.hubUpgradedSeats = {}
    state.legalMoves = legalMoves(state)
    return state
  }
  resolveTransaction(state, 0, { action: 'setup' }, executeCommand, { initial: true })
  state.cards = embeddedCardDefs(state, CAMPAIGN.id)
  state.legalMoves = legalMoves(state)
  return state
}

// allowed 是「卡牌范围」收窄后的候选表：默认就是 PLAYABLE_INVESTIGATORS，
// 所以普通对局的选人顺序不变；渐进式不会因为人设里的职业关键词挑到范围外的调查员。
function pickAiInvestigator(player, order, used, allowed = PLAYABLE_INVESTIGATORS) {
  const persona = (player && player.persona) || ''
  const map = {
    guardian: ['守卫', '守护', '战斗', '枪', '战士', '警察', 'guardian'],
    seeker: ['探求', '求知', '学者', '书', '研究', 'seeker'],
    mystic: ['秘术', '法术', '魔法', '巫师', '意志', 'mystic'],
    rogue: ['游荡', '窃', '敏捷', '赌徒', '小偷', 'rogue'],
    survivor: ['幸存', '生存', '幸运', '流浪', 'survivor'],
  }
  for (const [klass, keys] of Object.entries(map)) {
    if (keys.some((k) => persona.includes(k))) {
      const code = allowed.find((c) => ALL_INVESTIGATORS[c].klass === klass && !used.has(c))
      if (code) return code
    }
  }
  for (const code of order) {
    if (!used.has(code)) return code
  }
  return order[0]
}

// ---------------------------------------------------------------------------
// 剧本切换（战役推进）
// ---------------------------------------------------------------------------

// 从战役进入指定剧本：设置剧本数据、铺地图/敌人/遭遇牌堆/混乱袋、恢复调查员。

function startScenario(state, index, events) {
  const CAMPAIGN = campaignFor(state)
  const scenarioId = CAMPAIGN.scenarioOrder[index]
  const sc = structuredClone(SCENARIOS[scenarioId])
  resolveAgendaDoomThresholds(sc.agendas, state.numInvestigators)
  state.scenario = sc
  // 第四循环P2.1：地点闹鬼能力在开局校验——未知子句/未知目标在加载时失败，
  // 并把规范化后的能力写回剧本数据（读取点只做查询，不再逐次校验）。
  for (const [id, abilities] of Object.entries(normalizeScenarioHaunted(sc.locations))) {
    sc.locations[id].haunted = abilities
  }
  state.acts = sc.acts
  state.agendas = sc.agendas
  state.campaign.scenarioIndex = index
  for (const record of Object.values(state.campaign.investigators || {})) record.currentScenarioIndex = index
  state.campaign.phase = 'scenario'
  state.uiState = 'inScenario'
  state.storyAssets = []
  state.victoryDisplay = []
  state.actIndex = 0
  state.agendaIndex = 0
  state.doom = 0
  state.clues = 0
  state.victory = 0
  state.actClues = 0
  state.fogMod = 0
  state.resolution = null
  state.locations = []
  state.enemies = []
  state.encounterDeck = []
  state.encounterDiscard = []
  state.cultistDeck = []
  state.cultistsInVictory = []
  state.sealedTokens = []
  // 失落的时代：探索牌库逐关重建；免疫/复仇等记录随关卡重置。
  state.explorationDeck = []
  state.explorationDiscard = []
  // 第四循环 P2.2：第二遭遇牌堆逐关重建（关卡 setup 用 api.extraDeck 建堆）。
  // 只在已经存在时清空：不给没有第二牌堆的战役新增状态键，replay 指纹因此零变化。
  if (state.extraEncounterDecks) state.extraEncounterDecks = {}
  // 第四循环 P2.4：塔罗牌组逐关重建；存在才删键，避免给旧战役新增状态字段（replay 指纹不变）。
  if (state.scenarioDecks?.tarot) delete state.scenarioDecks.tarot
  state.relicOfAges = null
  state.expeditionLeaderSeat = state.expeditionLeaderSeat ?? null
  state.exiled = []
  state.exiledBySeat = []
  state.locationVariants = {}
  state.scenarioZones = {}
  state.scenarioFlags = {}
  // 地点能力的「每场游戏一次（团队）」标记属于上一关；重开或进入新关时必须清空。
  state.locationAbilityTeamUsed = {}
  // 第 5 步 P6：「压在黛安娜底下」的延后结算队列属于上一关，不能跨关残留。
  if (state.deferredBeneath) delete state.deferredBeneath
  state.round = 1
  state.phase = 'investigation'
  state.turnsTaken = []
  // 新关卡不带上一关的临时效果（A1）；持续到关卡结束的效果由「所有调查员离场」自然消失。
  state.effects = []

  // 第 2 步 P2.8：上一章散落在手牌/牌库/场上的绑定副本先收回场外集合，再重建牌库。
  if (state.bondedSets) returnAllBonded(state, { events })
  // 上一关的临时区（地点附属/放到一边/移出游戏/闹鬼授权/上限记账……）不能带进新关卡；
  // 放在 returnAllBonded 之后：绑定副本会从 removedFromGame 等区域回收。
  clearScenarioSceneLeftovers(state)

  // 第 2 步 P2.6：故事调查员——本章声明了就选人（每座位各选一次，其余划掉），
  // 没有声明就换回原本的调查员；两者都必须在 prepareInvestigator 之前完成。
  if (sc.storyInvestigators) {
    if (!state.storyInvestigators) {
      selectStoryInvestigators(state, normalizeStoryInvestigatorConfig(sc.storyInvestigators, `${sc.id}.storyInvestigators`), {
        requestChoice,
        cardName: code => ALL_INVESTIGATORS[code]?.nameZh || ALL_INVESTIGATORS[code]?.name || code,
        // 界面靠这份身份信息渲染选人卡；只读卡面印刷字段，不涉及任何隐藏信息。
        cardInfo: code => {
          const card = ALL_INVESTIGATORS[code]
          if (!card) return null
          return {
            klass: card.klass,
            classLabel: state.classNames?.[card.klass] || null,
            subtitle: card.subnameZh || card.subname || null,
            stats: { willpower: card.willpower, intellect: card.intellect, combat: card.combat, agility: card.agility },
            health: card.health,
            sanity: card.sanity,
          }
        },
      })
    }
  } else if (state.storyInvestigators) {
    // 换回原本的调查员：职业/技能按 originals 快照恢复；旧存档没有快照时用卡面定义兜底。
    restoreStoryInvestigators(state, { cardInfo: code => ALL_INVESTIGATORS[code] || null })
    info(state, events, '📜 故事调查员退场，队伍换回原本的调查员。')
  }

  // 计算有效起始地点（午夜假面：房屋已烧毁则从河岸城开始）。
  const startLoc = scenarioStartLocation(state, sc)

  // 调查员：恢复/重建（含创伤）。
  for (const inv of state.investigators) {
    prepareInvestigator(state, inv, events, startLoc)
  }

  // state.cards 是给前端的派生展示表（不进重放指纹），只在开局/读档时重建；而幕间奖励的
  // 剧情卡（如 02040 亨利·阿米蒂奇博士）是在开局之后才进牌组的。这里不补的话，前端拿不到
  // 它的 slots，会把占着盟友槽的支援画进「其他资产」，槽位判定和界面就对不上了。
  // 只补不删：开局那份卡池定义（幕间牌组界面要用）保留，只并入本关实际带入的卡。
  Object.assign(state.cards ||= {}, embeddedCardDefs(state, CAMPAIGN.id))

  scenarioBehavior(state).preScenarioSetup?.(state, events, scenarioRuntime(state, events))

  // 剧本专属布置。
  setupScenarioLocations(state, events)
  setupScenarioEnemies(state, events)
  setupScenarioDecks(state, events)
  setupChaosBag(state, events)
  // 开局即生效的特性连接规则（actRule.locationTraitLinks）：地点已全部入场，重算一次自动连接。
  locationTraits?.sync(state)
  scenarioBehavior(state).afterChaosBagSetup?.(state, events)

  state.currentSeat = firstAliveSeat(state)
  info(state, events, `🎬 第 ${index + 1} 关：${sc.name}`)
  state.scenarioIntro = introduction(sc, state.campaign.records, state)
  const introText = state.scenarioIntro.paragraphs.join('\n\n')
  info(state, events, introText, { kind: 'story', title: '故事导入', scenarioId: sc.id,
    code: sc.acts[0]?.originalCode || sc.acts[0]?.code, name: sc.acts[0]?.name || sc.name,
    text: introText, intro: true })
  const openingAgenda = state.agendas[state.agendaIndex]
  if (openingAgenda) info(state, events, `初始密谋：${openingAgenda.name}。`, {
    kind: 'story', title: '密谋揭示', scenarioId: sc.id, initialAgenda: true,
    code: openingAgenda.originalCode || openingAgenda.code, name: openingAgenda.name,
    text: openingAgenda.text || '新的威胁正在逼近。',
  })
  info(state, events, sc.setup)
  for (const inv of state.investigators) {
    info(state, events, `${CLASS_EMOJI[inv.klass] || ''} ${inv.name} 位于「${locName(state, inv.location)}」。`)
  }
  info(state, events, `☀️ 第 1 回合 · 调查阶段开始，轮到 ${state.investigators[state.currentSeat]?.name}。`)
  // 第 5 步 P6：剧本开局直接进入调查阶段，第一回合的「调查阶段开始时」必须在这里补一次
  // （之后各回合由 turn.js 的 beginInvestigationPhase 结算）。
  for (const inv of state.investigators) hunchDeck.reveal(state, inv, events)
  // 能力层窗口：冒险开始时（起始手牌里的塔罗牌等「游戏开始时」能力）。
  openAbilityWindow(state, 'scenarioStarts', { when: 'scenarioStarts', scenarioId: sc.id }, events)
  state.legalMoves = legalMoves(state)
}

function scenarioStartLocation(state, sc) {
  return contentRegistry.getBehavior(sc.id).startLocation?.(state) || sc.startLocation
}

function setupScenarioLocations(state, events) {
  const placed = scenarioBehavior(state).setupLocations?.(state, events, { randomValue, shuffle, info })
    || [state.scenario.startLocation]
  for (const id of placed) placeLocation(state, id, events)
}

function setupScenarioEnemies(state, events) {
  scenarioBehavior(state).setupEnemies?.(state, events, {
    spawnEnemy, locName, info, choose: options => requestChoice(state, options),
  })
}

function setupScenarioDecks(state, events) {
  const sc = state.scenario
  const rng = () => randomValue(state)
  let deck = sc.encounterDeck.slice()

  deck = scenarioBehavior(state).modifyDeck?.(state, deck, events,
    { randomValue, removeCardByCode, info }) || deck

  state.encounterDeck = shuffle(deck, rng)

  // 午夜假面：独立异教徒牌堆。
  if (sc.cultistDeck) {
    state.cultistDeck = shuffle(sc.cultistDeck.slice(), rng)
  }

  scenarioBehavior(state).afterDeckSetup?.(state, events, { info, randomValue, shuffle })

  // 内容层可以在布置结束后声明「需要按正常揭示流程翻开的地点」：
  // 例如《苍白面具》的哈露子密道，揭示时必须派发 locationRule.onReveal、
  // locationRevealed 造图与胜利点，直接改字段会漏掉这些结算。
  const pendingReveals = state.scenarioFlags?.pendingSetupReveals
  if (Array.isArray(pendingReveals) && pendingReveals.length) {
    delete state.scenarioFlags.pendingSetupReveals
    for (const id of pendingReveals) {
      if (state.locations.some(location => location.id === id)) scenarioRuntime(state, events).reveal(id)
    }
  }
}

function setupChaosBag(state, events) {
  const bags = campaignManifestFor(state).chaosBags || CHAOS_BAGS
  initializeChaosBag(state, bags[state.difficulty] || bags.standard)
  const extra = state.scenario.chaosBagExtra || []
  if (extra.length) {
    state.chaosBag.push(...extra)
    info(state, events, `🎲 混乱袋加入：${extra.map((t) => tokenLabel(t)).join('、')}。`)
  }
}

// ---------------------------------------------------------------------------
// 战役结算（结局 → 创伤 → 冒险日志 → 下一关 / 战役结束）
// ---------------------------------------------------------------------------

  return { makeInvestigator, drawOpeningHand, buildInvestigatorsDeck, prepareInvestigator, refreshStateResources, unknownCardCodes, createGameState, pickAiInvestigator, startScenario, scenarioStartLocation, setupScenarioLocations, setupScenarioEnemies, setupScenarioDecks, setupChaosBag }
}
