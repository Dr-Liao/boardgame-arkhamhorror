import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { actRuleFor, agendaRuleFor, entryFlags, locationRuleFor } from '../../../../../src/cards/card-rules.js'
import { encounterRules } from '../../encounter-rules.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../../tfa-chaos.js'
import { syncSymbolConnections } from '../../card-data.js'
import {
  APEX_STRANGLEWEED, BASILISK, EXPLORATION_LOCATIONS, EXPLORATION_TREACHERIES,
  PILLARS_TO_OPEN, POISONED_WEAKNESS, RUINS_CANDIDATES, WINGED_SERPENT,
} from './definition.js'

// tfa-chaos.js 把本章（剧情卡 04205，上下两部共用一张）的混乱标记表登记在
// 'heartOfTheElders' 键下。这里探测是否已存在 part1 专用键，避免将来重复结算。
const CHAOS_TABLE_ID = (() => {
  const probe = {
    locations: [], enemies: [], investigators: [], victoryDisplay: [],
    campaign: {}, scenarioFlags: {}, difficulty: 'standard',
  }
  const token = tfaChaosToken('heartOfTheEldersPart1', probe, { seat: 0, threat: [], hand: [] }, 'cultist', {})
  return token ? 'heartOfTheEldersPart1' : 'heartOfTheElders'
})()

const MOUTH = 'mouthOfKnyan'
const POISONED_SET_ASIDE = 4
// 第 116 轮：04218 石板祭坛的标记名已改走 api.tokenLabel（卡条目里），这里只导出符号集合给测试用。
const SYMBOL_TOKENS = new Set(['eldersign', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail'])

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => (state.campaign.records ||= {})
const original = card => card?.originalCode || card?.code
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const traits = card => (ALL_CARDS[original(card)]?.traits || card?.traits || []).map(trait => String(trait).toLowerCase())
const hasTrait = (card, trait) => traits(card).includes(String(trait).toLowerCase())
const isElite = card => hasTrait(card, 'Elite')
const isPoisoned = inv => (inv?.threat || []).some(card => card.code === POISONED_WEAKNESS) || inv?.poisoned === true
const pillarCount = state => Number(state.scenarioFlags?.pillars || 0)
const hardSide = state => ['hard', 'expert'].includes(state.difficulty)

// ---------------------------------------------------------------------------
// TFA 探索规则：只能翻出「连接地点」
// ---------------------------------------------------------------------------
// 参考实现（Campaigns/TheForgottenAge/Helpers.hs:239-335）的 explore：从探索牌库顶
// 一直抽到「与当前地点的连接符号相同的地点」或遭遇卡；途中不连接的地点先放一边，
// 本次探索结束后洗回探索牌库。引擎 doExplore 目前只抽 1 张（读点 exploreConnects
// 已存在），因此本章在 beforeExplore 里先把不连接的地点挪到一边，让引擎抽到的第一张
// 就是合法目标；afterExplore 再把一边的牌洗回。04207/04208 的探索由此获得连接筛选。
const scenarioLocations = state => state.scenario?.locations || {}

const exploreLinks = (state, fromId) => scenarioLocations(state)[fromId]?.connections || []

function connectsForExplore(state, fromId, code) {
  const target = scenarioLocations(state)[code]
  if (!target) return true
  const links = exploreLinks(state, fromId)
  if (!links.length) return true
  return links.includes(code)
}

function shuffleExplorationAsideBack(state, api) {
  const aside = state.scenarioFlags?.exploreAside || []
  if (!aside.length) return false
  state.scenarioFlags.exploreAside = []
  const merged = [...aside, ...(state.explorationDeck || [])]
  state.explorationDeck = typeof api?.shuffle === 'function' ? api.shuffle(merged) : merged
  return true
}

function prepareExplorationDraw(state, inv, api) {
  const deck = state.explorationDeck || []
  const aside = []
  while (deck.length) {
    const code = deck[deck.length - 1]
    if (!scenarioLocations(state)[code]) break // 遭遇卡：本次探索停在它上面
    if (connectsForExplore(state, inv.location, code)) break
    deck.pop()
    aside.push(code)
  }
  state.explorationDeck = deck
  if (aside.length) {
    state.scenarioFlags.exploreAside = [...(state.scenarioFlags.exploreAside || []), ...aside]
  }
  // 牌库里已没有可翻的地点：把一边的牌洗回，让引擎照常翻出一张（多半是遭遇卡）。
  if (!state.explorationDeck.length && (state.scenarioFlags.exploreAside || []).length) {
    shuffleExplorationAsideBack(state, api)
  }
}

// 04205 重玩：Haskell 用 scenario metadata 的 reachedAct2 跨 RestartScenario 保留
// （HeartOfTheElders.hs:64-84,393-430）。引擎 startScenario 会清空 scenarioFlags，
// 所以这里写进战役级 JSON 槽位（campaign.flow）；不需要新增存档 schema。
const REPLAY_META = 'heartOfTheEldersPart1'
const replayMetaFor = state => state.campaign?.flow?.tfaScenarioMeta?.[REPLAY_META] || null

function writeReplayMeta(state, reachedAct2) {
  state.campaign ||= {}
  state.campaign.flow ||= {}
  state.campaign.flow.tfaScenarioMeta ||= {}
  state.campaign.flow.tfaScenarioMeta[REPLAY_META] = { reachedAct2: Boolean(reachedAct2) }
}

function clearReplayMeta(state) {
  const meta = state.campaign?.flow?.tfaScenarioMeta
  if (meta && Object.hasOwn(meta, REPLAY_META)) delete meta[REPLAY_META]
}

// ---------------------------------------------------------------------------
// 04215 落入陷阱 / 04216 有毒孢子 属于上下两部共用的 HeartOfTheElders 遭遇组，但
// encounter-rules.js 还没有收录，因此在本文件用本地 resolveEncounter 实现（先串联共享规则）。
// 其余共享遭遇组（雨林 / 蛇族 / 远征 / 毒素 / 审判之柱）的效果来自 encounter-rules.js。
const LOCAL_ENCOUNTER_CODES = ['04209b', '04215', '04216', '04219', '04220', '04221']
const SHARED_ENCOUNTER_CODES = [
  '04076', '04077', '04078', '04079', '04080', '04081', '04082', '04101', '04102',
]
// 本章遭遇牌中已经实现印刷效果的全部原卡号（供迁移审计使用）。
export const implementedEncounterCodes = [...LOCAL_ENCOUNTER_CODES, ...SHARED_ENCOUNTER_CODES]

// ---------------------------------------------------------------------------
// 随机与地图辅助
// ---------------------------------------------------------------------------
function mix(state, helper, list) {
  if (helper?.shuffle && helper?.randomValue) return helper.shuffle([...list], () => helper.randomValue(state))
  if (typeof helper?.random === 'function') return shuffleWith([...list], () => helper.random())
  return [...list]
}

function shuffleWith(list, rng) {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(rng() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

function distance(state, from, to) {
  if (from === to) return 0
  if (!from || !to) return Number.POSITIVE_INFINITY
  const seen = new Set([from]), queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    for (const next of state.locations.find(entry => entry.id === id)?.connections || []) {
      if (next === to) return steps + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Number.POSITIVE_INFINITY
}

function poisonSetAsideCount(state) {
  const list = state.campaign?.investigators
  const records = Array.isArray(list) ? list : Object.values(list || {})
  const owned = records.filter(record => (record?.deck || []).includes(POISONED_WEAKNESS)).length
  return Math.max(0, POISONED_SET_ASIDE - owned)
}

// 从「放在一边」拿一张中毒弱点放进威胁区域（Haskell：getSetAsidePoisoned）。
function poisonFromSetAside(state, seat, api) {
  const setAside = state.scenarioZones?.setAside
  const index = (setAside || []).indexOf(POISONED_WEAKNESS)
  if (index >= 0) setAside.splice(index, 1)
  api.poison?.(seat)
  return index >= 0
}

// 石柱标记：卡面要求「在昆扬之口上放置 1 资源，作为石柱标记」。
// 引擎的地图徽章直接渲染 loc.resources，所以把标记放到地点卡上（玩家可见），
// scenarioFlags.pillars 只作为目标进度 0..6 的镜像计数（P2：地点指示物）。
function placePillar(state, api) {
  state.scenarioFlags ||= {}
  const total = pillarCount(state) + 1
  state.scenarioFlags.pillars = total
  const mouth = state.locations.find(location => location.id === MOUTH)
  if (mouth) mouth.resources = (mouth.resources || 0) + 1
  api.info?.(`🪨 在昆扬之口放置 1 个石柱标记（${total}/${PILLARS_TO_OPEN}）。`)
  // 羽翼蛇族：强制 - 石柱标记被放置在昆扬之口后，横置且本轮补给阶段不重整。
  const serpent = state.enemies.find(enemy => original(enemy) === WINGED_SERPENT)
  if (serpent) {
    serpent.exhausted = true
    serpent.preventReady = { from: state.round, rounds: 1 }
  }
  // 蛇怪：强制 - 石柱标记被放置在昆扬之口后，将一张蛇怪洗入遭遇牌库（每轮最多一次）。
  // 只有场上有蛇怪、且牌盒里还有副本（弃牌堆/放在一边）时才洗回，不会凭空多出第 3 张。
  if (state.enemies.some(enemy => original(enemy) === BASILISK)
    && state.scenarioFlags.basiliskRound !== state.round) {
    const fromDiscard = (state.encounterDiscard || []).indexOf(BASILISK)
    const fromSetAside = (state.scenarioZones?.setAside || []).indexOf(BASILISK)
    const source = fromDiscard >= 0 ? state.encounterDiscard : fromSetAside >= 0 ? state.scenarioZones.setAside : null
    const index = fromDiscard >= 0 ? fromDiscard : fromSetAside
    if (source) {
      state.scenarioFlags.basiliskRound = state.round
      source.splice(index, 1)
      state.encounterDeck.push(BASILISK)
      state.encounterDeck = shuffleWith([...(state.encounterDeck || [])], () => api.random?.() ?? 0)
      api.info?.('🐍 蛇怪：将一张蛇怪洗入遭遇牌库（每轮最多一次）。')
    } else {
      api.info?.('🐍 蛇怪：牌盒里没有可洗回的副本（两张都在场上或牌库里）。')
    }
  }
  return total
}

export function setupPlan(state, helper = {}) {
  const records = recordsFor(state)
  const pathsKnown = Math.max(0, Math.min(PILLARS_TO_OPEN, Number(records.pathsAreKnownToYou || 0)))
  const mappedOut = Boolean(records.theInvestigatorsMappedOutTheWayForward)
  const ruins = mix(state, helper, [...RUINS_CANDIDATES])
  const ruinLocation = ruins[0]
  const removedRuins = ruins.slice(1)
  // 原卡：随机一处遗迹洗入探索牌库；若已“摸清前进的道路”，改为直接放置入场。
  const pool = [
    ...(mappedOut ? [] : [ruinLocation]),
    ...EXPLORATION_LOCATIONS,
    ...EXPLORATION_TREACHERIES,
  ]
  return {
    pathsKnown, mappedOut, ruinLocation, removedRuins,
    autoResolve: pathsKnown >= PILLARS_TO_OPEN,
    // 重玩（上次无结局）时：已进入过场景 2 的，跳过场景 1（Haskell setActDeck）。
    reachedAct2: Boolean(replayMetaFor(state)?.reachedAct2),
    explorationDeck: mix(state, helper, pool),
  }
}

export const behavior = {
  ...encounterRules,
  id: 'heartOfTheEldersPart1',
  implementedEncounterCodes,

  setupPlan,

  // 04205 序盘导入（P2）：谁随行由前面的战役卡/记录决定，四段导入按在场者读。
  //   - 伊塔卡 04147：上一章把她加入牌组，或与她建立纽带。
  //   - 亚历山卓 04051：把他加入牌组，或救出他 / 遗物交给他保管。
  //   - 探险日志 04148：上一章把它加入牌组。
  preScenarioSetup(state, events, api) {
    const flags = (state.scenarioFlags ||= {})
    const records = recordsFor(state)
    const hasCard = code => Object.values(state.campaign?.investigators || {})
      .some(record => (record?.deck || []).includes(code))
    const hasRecord = keys => keys.some(key => records[key] === true)
    flags.ichtacaPresent = hasCard('04147')
      || hasRecord(['theInvestigatorsForgedABondWithIchtaca', 'ichtacasFaithIsRestored', 'ichtacaHasConfidenceInYou'])
    flags.alejandroPresent = hasCard('04051')
      || hasRecord(['theInvestigatorsRescuedAlejandro', 'theInvestigatorsGaveCustodyOfTheRelicToAlejandro', 'alejandroRecoveredTheRelicOfAges'])
    flags.journalPresent = hasCard('04148')
    const present = [
      flags.ichtacaPresent ? '伊塔卡' : null,
      flags.alejandroPresent ? '亚历山卓' : null,
      flags.journalPresent ? '探险日志' : null,
    ].filter(Boolean)
    api?.info?.(present.length ? `序盘：${present.join('、')}随队进入久远腹地。` : '序盘：没有向导随队，只有你们自己。')
  },

  setupLocations(state, events, helper = {}) {
    const plan = setupPlan(state, helper)
    const poison = poisonSetAsideCount(state)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = Array(poison).fill(POISONED_WEAKNESS)
    state.scenarioZones.removed = [...plan.removedRuins]
    state.scenarioZones.ruinsLocation = plan.ruinLocation
    state.scenarioZones.explorationTreacheries = [...EXPLORATION_TREACHERIES]
    state.explorationDeck = [...plan.explorationDeck]
    state.explorationDiscard = []
    state.scenarioFlags ||= {}
    state.scenarioFlags.pillars = plan.pathsKnown
    state.scenarioFlags.ruinsLocation = plan.ruinLocation
    state.scenarioFlags.mappedOutTheWayForward = plan.mappedOut
    state.scenarioFlags.autoResolveR1 = plan.autoResolve
    state.scenarioFlags.reachedAct2 = plan.reachedAct2
    state.scenarioFlags.basiliskRound = 0
    // 幕牌库：重玩且上次已进入过场景 2 时，场景 1 已完成，不再放进幕牌库
    // （Haskell setActDeck $ [act1 | not reachedAct2] <> [openingTheMaw]）。
    state.acts = state.scenario.acts
      .filter(card => !(plan.reachedAct2 && (card.originalCode || card.code) === '04209'))
      .map(card => structuredClone(card))
    const placed = [MOUTH]
    if (plan.mappedOut) placed.push(plan.ruinLocation)
    return placed
  },

  // 重玩跳过场景 1 时，羽翼蛇族不会由 04209 的背面生成：按参考实现在布置时直接放在
  // 昆扬之口（Haskell HeartOfTheElders.hs:263-264）。
  setupEnemies(state, events, helper = {}) {
    if (!state.scenarioFlags?.reachedAct2) return
    helper.spawnEnemy?.(state, WINGED_SERPENT, MOUTH, null)
    helper.info?.(state, events, '🐍 重玩：羽翼蛇族已在昆扬之口等着你们。')
  },

  canExplore(state, inv) {
    return encounterRules.canExplore(state, inv)
  },

  // 引擎读点（src/cards/campaign-plugin.js 的 doExplore）：探索牌库抽到的地点必须
  // 与当前地点相连（卡面 04207/04208/04211/04212 的「如果该卡牌是一个连接地点」）。
  exploreConnects(state, fromId, code) {
    return connectsForExplore(state, fromId, code)
  },

  // 04102 中毒弱点按共享规则（encounter-rules）留在威胁区域，这里只处理本章地点的限制。
  // 第 116 轮：索桥（04071）/ 曲折小道（04073）的探索前规则在地点条目。
  beforeExplore(state, inv, api) {
    const location = here(state, inv)
    const rule = locationRuleFor(original(location))
    if (typeof rule?.beforeExplore === 'function' && rule.beforeExplore(state, inv, api, location) === false) {
      return false
    }
    // 引擎的 doExplore 在 beforeExplore 之后才从探索牌库抽卡；用这个标记让「落入陷阱」
    // 知道自己是“从探索牌库抽出”的（此时不能选择洗回探索牌库）。
    state.scenarioFlags ||= {}
    // TFA 探索：先把不连接的地点挪到一边，让引擎翻出的是「连接地点」。
    prepareExplorationDraw(state, inv, api)
    state.scenarioFlags.exploreDrawPending = true
    return true
  },

  // 04073 曲折小道：调查或探索时若没有指南针，必须先花 3 资源（条目声明）。
  beforeInvestigate(state, inv, location, api) {
    const rule = locationRuleFor(original(location))
    if (typeof rule?.beforeInvestigate !== 'function') return true
    return rule.beforeInvestigate(state, inv, location, api) !== false
  },

  afterExplore(state, inv, context) {
    syncSymbolConnections(state)
    const api = context?.runtime
    const location = here(state, inv)
    const rule = locationRuleFor(original(location))
    if (state.scenarioFlags) delete state.scenarioFlags.exploreDrawPending
    // 第 116 轮：04072 万蛇据点的中毒伤害在地点条目（探索成功也要结算）。
    rule?.afterExplore?.({ state, inv, api, context, location })
    // TFA 探索：把本次探索时放一边的不连接地点洗回探索牌库。
    if (shuffleExplorationAsideBack(state, api)) {
      api?.info?.('🧭 与当前地点不连接的地点已洗回探索牌库。')
    }
    if (context?.kind === 'location') {
      state.explorationDiscard ||= []
      inv.tfaExploredThisTurn = true
      return
    }
    // 抽到的是诡计/敌人＝探索失败，按地点的强制效果结算（04069 荆棘之路）。
    rule?.afterExploreFailure?.({ state, inv, api, context, location })
  },

  afterTest(state, inv, result, api) {
    tfaChaosAfterTest(CHAOS_TABLE_ID, state, inv, result, api)
    encounterRules.afterTest?.(state, inv, result, api)
    // 困难/专家的平板条款统一由 tfa-chaos.js 结算（含把放在一边的 04102 移入威胁区域），
    // 本章不再重复放置，避免同一张弱点被结算两次。
    // 第 116 轮：04069 / 04072 / 04053 的调查后规则在地点条目。
    locationRuleFor(original(here(state, inv)))?.afterTest?.({ state, inv, result, api })
  },

  resolveChaosToken(state, inv, token, api) {
    return tfaChaosToken(CHAOS_TABLE_ID, state, inv, token, api)
  },

  // 毒牙神庙（04074）的「胜利区每有 1 点复仇点数，帷幕 +1」已迁到
  // src/cards/encounter-abilities.js 的 04074 地点条目，本章不再重复实现。

  locationEntered(state, inv, location, api) {
    // 第 116 轮：04075（中毒即结束回合）与 04218（石板祭坛）的进入规则在地点条目，
    // 由引擎派发 locationRule.onEnter.effect；本章不再重复实现。
    return encounterRules.locationEntered?.(state, inv, location, api)
  },

  enemyStatModifier(state, enemy, stat) {
    // 万蛇据点（04072）的「此处每个蛇族敌人 +1 攻击」已迁到 04072 的地点条目。
    return encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    if (original(enemy) === WINGED_SERPENT && enemy.location !== MOUTH) {
      // 原卡：生成 - 昆扬之口。若它已经被交战，先解除交战再移动过去。
      const owner = state.investigators[enemy.engagedSeat]
      if (owner) owner.engaged = (owner.engaged || []).filter(id => id !== enemy.id)
      enemy.engagedSeat = null
      enemy.location = MOUTH
    }
    if (original(enemy) === BASILISK) {
      // 猎物 - 距离昆扬之口最近的调查员。
      const scored = active(state)
        .map(inv => ({ seat: inv.seat, steps: distance(state, inv.location, MOUTH) }))
        .sort((left, right) => left.steps - right.steps)
      if (scored.length) enemy.preySeat = scored[0].seat
    }
  },

  // 羽翼蛇族：不能被击败 / 不发动借机攻击（已迁到 04209b 的敌人条目）。
  enemyCanBeDefeated(state, enemy, source, seat) {
    return encounterRules.enemyCanBeDefeated?.(state, enemy, source, seat) !== false
  },

  canOpportunityAttack(state, enemy) {
    return encounterRules.canOpportunityAttack?.(state, enemy) !== false
  },

  // 绝命噬藤：强制 - 它对“你”发动借机攻击后，检查补给品；没有折叠小刀则失去所有行动并结束回合。
  // P2：引擎的 enemyAttackResolved 现在会带上本次攻击的 kind（'opportunity' / 'enemy' / 'effect'…），
  // 不再用「正在结算一次行动」近似。
  enemyAttackResolved(state, enemy, inv, api, attack) {
    encounterRules.enemyAttackResolved?.(state, enemy, inv, api, attack)
    if (original(enemy) !== APEX_STRANGLEWEED || attack?.kind !== 'opportunity') return
    if (api.hasSupply?.(inv.seat, 'pocketknife') ?? api.checkSupplies?.(inv.seat, 'pocketknife')) return
    api.loseActions(inv.seat, 99)
    api.endTurn(inv.seat)
    api.info?.(`绝命噬藤：${inv.name} 没有折叠小刀，失去所有行动并结束回合。`)
  },

  // 本章专门的遭遇结算（先串联共享遭遇组规则）。
  resolveEncounter(state, inv, t, api) {
    const code = original(t)
    // 第 117 轮：这三张卡的身份由条目标志声明（上下两章共用，本章文案/数值仍在本文件）。
    const flags = entryFlags(code) || {}
    if (flags.pitfall) {
      const fromExploration = Boolean(state.scenarioFlags?.exploreDrawPending)
      if (state.scenarioFlags) delete state.scenarioFlags.exploreDrawPending
      const pitfallTest = () => api.test(inv.seat, 'agility', 3, result => {
        if (result.success) return
        const failedBy = Math.max(0, 3 - (result.value ?? 0))
        for (let index = 0; index < failedBy; index++) api.damage(inv.seat, 1)
      })
      if (fromExploration) {
        api.info?.('落入陷阱从探索牌库抽出，必须检定敏捷(3)。')
        pitfallTest()
        return false
      }
      const answer = aiChoice(api, {
        kind: 'harm', source: '04215', seat: inv.seat, peril: true,
        prompt: '落入陷阱：检定敏捷(3)跳过裂隙，或把本卡洗入探索牌库。',
        options: [
          { id: 'test', label: '检定敏捷(3)：每失败 1 点受到 1 点伤害' },
          { id: 'shuffle', label: '把落入陷阱洗入探索牌库' },
        ],
      })
      if (answer === 'shuffle') {
        state.explorationDeck ||= []
        state.explorationDeck.push('04215')
        state.explorationDeck = shuffleWith([...state.explorationDeck], () => api.random?.() ?? 0)
        api.info?.('落入陷阱被洗回探索牌库。')
        return { placed: true }
      }
      pitfallTest()
      return false
    }
    if (flags.spores) {
      const location = here(state, inv)
      if (!location) {
        api.horror(inv.seat, 1)
        return false
      }
      location.attachments ||= []
      const sporesHere = location.attachments.filter(item => original(item) === '04216').length
      location.attachments.push({
        id: `poisonous-spores:${state.round}:${location.id}:${sporesHere}`,
        code: '04216', originalCode: '04216',
      })
      api.info?.(`有毒孢子附属到「${location.name}」；本轮结束时结算。`)
      return true
    }
    if (flags.ants) {
      api.test(inv.seat, 'agility', 4, result => {
        if (result.success) return
        const failedBy = Math.max(0, 4 - (result.value ?? 0))
        for (let index = 0; index < failedBy; index++) {
          const playArea = (inv.assets || []).filter(asset => !asset.isStoryAsset)
          const options = []
          if ((inv.hand || []).length) options.push({ id: 'hand', label: '随机弃掉一张手牌' })
          if (playArea.length) options.push({ id: 'asset', label: '选择并弃掉你游戏区域的一张卡牌' })
          if (!options.length) return
          const answer = options.length === 1 ? options[0].id : aiChoice(api, {
            kind: 'harm', source: '04221', seat: inv.seat,
            prompt: `蚁群缠身：第 ${index + 1}/${failedBy} 点差额，选择弃牌。`,
            options,
          })
          if (answer !== 'asset') {
            api.discardRandom(inv.seat, 1)
            continue
          }
          const picked = playArea.length === 1 ? playArea[0].id : aiChoice(api, {
            kind: 'asset', source: '04221', seat: inv.seat,
            prompt: '蚁群缠身：选择弃掉的卡牌。',
            options: playArea.map(asset => ({
              id: asset.id, label: ALL_CARDS[original(asset)]?.nameZh || original(asset),
            })),
          })
          api.discardAsset(inv.seat, picked)
        }
      })
      return false
    }
    return encounterRules.resolveEncounter(state, inv, t, api)
  },

  actions(state, inv) {
    const moves = []
    const location = here(state, inv)
    // 第 116 轮：04206 昆扬之口 / 04217 时间折磨的树林 / 04070 河流峡谷的行动在地点条目。
    locationRuleFor(original(location))?.actions?.({
      state, inv, location, moves, hooks: { pillarsToOpen: PILLARS_TO_OPEN },
    })
    return moves
  },

  performAction(state, inv, move, api) {
    // 第 116 轮：地点条目先接管自己的场景行动（如 04070 的治愈）。
    const location = here(state, inv)
    if (locationRuleFor(original(location))?.performAction?.(state, inv, move, api, location)) return
    if (move.rule === 'resignMouth') {
      api.resign(inv.seat)
      return
    }
    if (move.rule === 'mouthCompass') {
      if (!(api.hasSupply?.(inv.seat, 'compass') ?? api.checkSupplies(inv.seat, 'compass'))) {
        api.info?.('检查补给：队伍中没有指南针，这次行动没有效果。')
        return
      }
      const deck = state.explorationDeck || []
      const top = deck.slice(-3).reverse()
      if (!top.length) {
        api.info?.('探索牌库已经空了。')
        return
      }
      const bottomId = top.length === 1 ? 0 : Number(aiChoice(api, {
        kind: 'deck', source: '04206', seat: inv.seat,
        prompt: '选择 1 张放在探索牌库底部（其余按原顺序放回牌库顶）。',
        options: top.map((code, index) => ({
          id: String(index), label: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
        })),
      }))
      const picked = top[bottomId] || top[0]
      const rest = top.filter((code, index) => index !== bottomId)
      // 其余 2 张也按任意顺序放回牌库顶（再问一次哪张在最上面）。
      let topOrder = rest
      if (rest.length === 2) {
        const first = Number(aiChoice(api, {
          kind: 'deck', source: '04206', seat: inv.seat,
          prompt: '选择放在探索牌库顶的第一张（另一张紧接其下）。',
          options: rest.map((code, index) => ({
            id: String(index), label: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
          })),
        }))
        topOrder = first === 1 ? [rest[1], rest[0]] : rest
      }
      // 探索牌库的数组末尾是牌库顶：选中那张放在数组开头（牌库底）。
      state.explorationDeck = [
        picked,
        ...deck.slice(0, Math.max(0, deck.length - 3)),
        ...topOrder.slice().reverse(),
      ]
      api.info?.('指南针：1 张放在探索牌库底部，其余 2 张回到牌库顶。')
      return
    }
    if (move.rule === 'solvePillar') {
      if (original(state.acts?.[state.actIndex]) !== '04210') throw new Error('当前场景不能解石柱谜题')
      if (inv.location !== MOUTH) throw new Error('必须在昆扬之口解石柱谜题')
      api.payClues(state.numInvestigators, inv.location)
      placePillar(state, api)
      return
    }
    if (move.rule === 'expelVengeance') {
      if (state.scenarioFlags?.timeWrackedWoodsUsed) throw new Error('错时林地的能力每场游戏仅限一次')
      const candidates = (state.victoryDisplay || [])
        .filter(card => (card.vengeance || 0) > 0 && !isElite(card))
      if (!candidates.length) {
        api.info?.('胜利区没有带复仇点数的非精英卡牌。')
        return
      }
      const pickedId = candidates.length === 1 ? candidates[0].id : aiChoice(api, {
        kind: 'victory', source: '04217', seat: inv.seat,
        prompt: '选择放进遭遇弃牌堆的卡牌。',
        options: candidates.map(card => ({ id: String(card.id), label: ALL_CARDS[original(card)]?.nameZh || original(card) })),
      })
      const picked = candidates.find(card => String(card.id) === String(pickedId)) || candidates[0]
      const index = state.victoryDisplay.indexOf(picked)
      if (index >= 0) state.victoryDisplay.splice(index, 1)
      state.encounterDiscard.push(original(picked))
      state.scenarioFlags ||= {}
      state.scenarioFlags.timeWrackedWoodsUsed = true
      api.info?.(`错时林地：把「${ALL_CARDS[original(picked)]?.nameZh || original(picked)}」放进遭遇弃牌堆。`)
      return
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知久远腹地（上）行动：${move.rule}`)
  },

  actReveal(state, act, api) {
    actRuleFor(original(act))?.onReveal?.(state, act, api)
  },

  agendaReveal(state, agenda, api) {
    agendaRuleFor(original(agenda))?.onReveal?.(state, agenda, api)
  },

  checkObjectives(state, api) {
    if (state.scenarioFlags?.autoResolveR1) {
      state.scenarioFlags.autoResolveR1 = false
      api.info?.('六根石柱的通路都已经知晓，队伍直接进入昆扬。')
      api.finish('r1')
      return
    }
    if (original(state.acts?.[state.actIndex]) !== '04210') return
    if (pillarCount(state) >= PILLARS_TO_OPEN) api.advanceAct()
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    // 有毒孢子：每张孢子各自结算一次（同一地点多张会各触发一遍），轮末弃掉。
    for (const location of state.locations) {
      const spores = (location.attachments || []).filter(item => original(item) === '04216')
      if (!spores.length) continue
      for (const spore of spores) {
        for (const inv of active(state).filter(entry => entry.location === location.id)) {
          if (isPoisoned(inv)) {
            api.horror(inv.seat, 2)
            continue
          }
          poisonFromSetAside(state, inv.seat, api)
        }
        const index = location.attachments.indexOf(spore)
        if (index >= 0) location.attachments.splice(index, 1)
        state.encounterDiscard.push('04216')
      }
      api.info?.(`有毒孢子：结算「${location.name}」上的 ${spores.length} 张孢子并弃掉。`)
    }
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
  },

  resolution(state, key, events, api = {}) {
    if (!['noResolution', 'r1', 'r2'].includes(key)) throw new Error('未知久远腹地（上）结局')
    const records = recordsFor(state)
    state.scenarioFlags ||= {}
    if (key === 'noResolution') {
      // 原卡：记录已解开的通路数（只有比记录更大时才更新），随后重玩本关（RestartScenario）。
      const solved = pillarCount(state)
      if (solved > Number(records.pathsAreKnownToYou || 0)) records.pathsAreKnownToYou = solved
      state.scenarioFlags.reachedAct2 = state.actIndex >= 1
      // reachedAct2 要跨 restart 保留（startScenario 会清空 scenarioFlags），写进战役级槽位。
      writeReplayMeta(state, state.scenarioFlags.reachedAct2)
      // 与 04059 结局 4 相同的方式调用引擎重开：原地重开本关并重新发起手牌。
      const restarted = typeof api?.restartScenario === 'function' ? api.restartScenario() : false
      // 兼容只有结局对象、没有重开能力的调用方（测试/独立结算）：未重开时保持原返回形状。
      return restarted ? { award: false, bonus: 0, restarted: true } : { award: false, bonus: 0 }
    }
    if (key === 'r2') {
      // 结局 2（基础流程不会触发，保留给「重返」的未达成分支）：补齐石柱并记录伊格之怒。
      const missing = Math.max(0, PILLARS_TO_OPEN - pillarCount(state))
      if (missing) {
        state.scenarioFlags.pillars = PILLARS_TO_OPEN
        records.yigsFury = Number(records.yigsFury || 0) + 2 * missing
      }
      for (const inv of state.investigators) {
        if (inv.defeated || inv.resigned) continue
        if (isPoisoned(inv)) api.addTrauma?.(state, inv.seat, 'mental', 1, events)
        else api.campaignCardChange?.(state.campaign, inv.seat, POISONED_WEAKNESS, 'add', state.scenario.id)
      }
    }
    // 通过本关（r1/r2）：清掉重玩元数据，避免影响后续战役流程。
    clearReplayMeta(state)
    // 结局 1（以及结局 2 之后）：把胜利区中带复仇点数的卡牌记入“丛林窥视”。
    const watches = (state.victoryDisplay || [])
      .filter(card => (card.vengeance || 0) > 0)
      .map(card => original(card))
    records.theJungleWatches = [...new Set([...(records.theJungleWatches || []), ...watches])]
    return { award: true, bonus: 0 }
  },
}

// 选择题的统一入口：只有一个选项时不打断流程（与引擎 requestChoice 的行为一致）。
function aiChoice(api, request) {
  if (typeof api.choose !== 'function') return request.options[0].id
  const answer = api.choose(request)
  return answer ?? request.options[0].id
}

export { CHAOS_TABLE_ID, pillarCount, poisonSetAsideCount, SYMBOL_TOKENS }
