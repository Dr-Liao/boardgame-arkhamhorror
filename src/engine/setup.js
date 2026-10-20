// 建局（createGameState / 调查员准备 / 关卡布置 / 混乱袋）从 engine.js 拆出的模块
// （Phase 6 · 6d-18）。
//
// 「一局怎么开始」的全部步骤：选调查员、建牌组、发起手、准备关卡地点与敌人、
// 布置遭遇牌库与混乱袋、进入第一关。这是 engine.js 里最长的一段准备逻辑，
// 拆出来后主文件只剩「运行时」：动作、检定、阶段、API。
//
// 依赖注入同前；被外部 import 的三个名字（createGameState / refreshStateResources /
// unknownCardCodes）在 engine.js 里用函数声明再导出，调用点不变。

import { contentRegistry } from '../../content/registered.js'

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
    INVESTIGATOR_ABILITIES,
    META,
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
    canSelectInvestigator,
    carcosaPlayerEffect,
    cardDef,
    consumeStartingAdjustments,

    corePlayerPool,
    descriptorOfKind,
    embeddedCardDefs,
    executeCommand,
    executeDescriptor,
    expeditionLeaderSeat,
    extraActionBonus,
    firstAliveSeat,
    hashSeed,
    inHub,
    info,
    initialHubScenarioMoves,
    initializeChaosBag,
    introduction,
    isWeaknessCode,
    legalMoves,
    locName,
    newPlayerAssetInstance,
    openAbilityWindow,
    placeLocation,
    randomUUID,
    randomValue,
    registerCampaignInvestigator,
    registerCampaignScenarios,
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
    location: 'study',
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
  const target = INVESTIGATOR_ABILITIES[inv.code]?.openingHandSize || 5
  while (inv.hand.length < target && inv.deck.length) {
    const code = inv.deck.pop()
    if (isWeaknessCode(code)) weaknesses.push(code)
    else inv.hand.push(code)
  }
  inv.deck = shuffle([...inv.deck, ...weaknesses], () => randomValue(state))
}

// 为调查员构筑牌库：人类座位若设置了自定义卡组（settings.playerDeck）则用自定义清单，
// 校验失败拒绝开局；其余座位（AI）始终使用相同许可池自动构筑。

function buildInvestigatorsDeck(state, inv, def, events) {
  const opts = {
    seat: inv.seat,
    seed: Math.floor(randomValue(state) * 4294967296),
    playerPool: corePlayerPool(),
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

function prepareInvestigator(state, inv, events, startLocation) {
  const def = ALL_INVESTIGATORS[inv.code]
  let record = state.campaign.investigators[inv.seat]
  let deck
  if (!record) {
    const built = buildInvestigatorsDeck(state, inv, def, events)
    record = registerCampaignInvestigator(state.campaign, inv, built.deck)
    deck = built.deck
  } else {
    if (record.code !== inv.code || record.status !== 'active') throw new Error('调查员战役身份不可进入剧本')
    deck = shuffle(record.deck, () => randomValue(state))
  }
  const trauma = state.campaign.trauma[inv.seat]
  inv.campaignId = record.id
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
  inv.actionsLeft = 3 + extraActionBonus(inv)
  inv.exploreOnlyActions = 0
  inv.tomeActionUsed = false
  inv.hand = []
  inv.deck = deck
  inv.discard = []
  inv.hiddenCards = []
  inv.assets = []
  inv.threat = []
  inv.engaged = []
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
  const startsWith = INVESTIGATOR_ABILITIES[inv.code]?.startsWith
  for (const code of startsWith == null ? [] : Array.isArray(startsWith) ? startsWith : [startsWith]) {
    if (removeCardByCode(inv.deck, code)) inv.assets.push(newPlayerAssetInstance(state, inv, code))
  }
  for (const code of inv.deck.filter(code => cardDef(code)?.permanent)) {
    removeCardByCode(inv.deck, code)
    const card = newPlayerAssetInstance(state, inv, code)
    if (cardDef(code)?.type === 'treachery') inv.threat.push(card)
    else inv.assets.push(card)
    inv.resources = Math.max(0, inv.resources + (EFFECTS[code]?.startingResources || 0))
    // Phase 5（5c-39）：「原定计划」这类开局效果改成描述子（kind: 'setup'）；
    // 旧的数据体 setup 仍是回退路径，保证未迁移的卡不受影响。
    const setupDescriptor = descriptorOfKind(code, 'setup')
    if (setupDescriptor?.resolve) {
      executeDescriptor(state, { inv, source: card, descriptor: setupDescriptor, events, silent: true })
    } else {
      const setup = EFFECTS[code]?.setup
      if (setup) carcosaPlayerEffect(state, inv.seat, { ...setup, assetId: card.id }, events)
    }
  }
  drawOpeningHand(state, inv)
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
  // New games get independent randomness; explicit seeds remain reproducible.
  // The seed and evolving rngState are persisted with the game for resuming.
  const seed = String(settings.seed ?? randomUUID())
  const randomState = { rngState: hashSeed(seed) >>> 0 }
  const invCodes = PLAYABLE_INVESTIGATORS
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
      code = pickAiInvestigator(p, order, used)
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

function pickAiInvestigator(player, order, used) {
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
      const code = PLAYABLE_INVESTIGATORS.find((c) => ALL_INVESTIGATORS[c].klass === klass && !used.has(c))
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
  state.relicOfAges = null
  state.expeditionLeaderSeat = state.expeditionLeaderSeat ?? null
  state.exiled = []
  state.exiledBySeat = []
  state.locationVariants = {}
  state.scenarioZones = {}
  state.scenarioFlags = {}
  state.round = 1
  state.phase = 'investigation'
  state.turnsTaken = []
  // 新关卡不带上一关的临时效果（A1）；持续到关卡结束的效果由「所有调查员离场」自然消失。
  state.effects = []

  // 计算有效起始地点（午夜假面：房屋已烧毁则从河岸城开始）。
  const startLoc = scenarioStartLocation(state, sc)

  // 调查员：恢复/重建（含创伤）。
  for (const inv of state.investigators) {
    prepareInvestigator(state, inv, events, startLoc)
  }

  scenarioBehavior(state).preScenarioSetup?.(state, events, scenarioRuntime(state, events))

  // 剧本专属布置。
  setupScenarioLocations(state, events)
  setupScenarioEnemies(state, events)
  setupScenarioDecks(state, events)
  setupChaosBag(state, events)
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
  scenarioBehavior(state).setupEnemies?.(state, events, { spawnEnemy, locName, info })
}

function setupScenarioDecks(state, events) {
  const sc = state.scenario
  const rng = () => randomValue(state)
  let deck = sc.encounterDeck.slice()

  deck = scenarioBehavior(state).modifyDeck?.(state, deck, events,
    { randomValue, removeCardByCode, info }) || deck

  // 若食尸鬼祭司仍存活（第一幕未击败），洗入遭遇牌库。
  if (scenarioBehavior(state).includeSurvivingPriest && state.campaign.records.ghoulPriestAlive) {
    deck.push('ghoulPriest')
    info(state, events, '👹 食尸鬼祭司仍存活，被洗入遭遇牌库。')
  }

  state.encounterDeck = shuffle(deck, rng)

  // 午夜假面：独立异教徒牌堆。
  if (sc.cultistDeck) {
    state.cultistDeck = shuffle(sc.cultistDeck.slice(), rng)
  }

  scenarioBehavior(state).afterDeckSetup?.(state, events, { info, randomValue, shuffle })
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
