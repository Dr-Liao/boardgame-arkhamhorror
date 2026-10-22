import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterRules } from '../../encounter-rules.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../../tfa-chaos.js'
import { syncSymbolConnections } from '../../card-data.js'
import { actRuleFor, agendaRuleFor, locationRuleFor } from '../../../../../src/cards/card-rules.js'
import { EXPLORATION_LOCATIONS, EXPLORATION_TREACHERIES } from './definition.js'

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => (state.campaign.records ||= {})
const original = card => card?.originalCode || card?.code
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const AGENTS_OF_YIG = ['04083', '04084', '04085']

// 本章逐条实现的敌人/诡计原卡号（供迁移审计核对，不实现的不列）。
export const implementedEncounterCodes = [
  '01166', // 远古恶魔：核心遭遇卡，由共享解析器处理
  '04052', '04076', '04077', '04078', '04079', '04080', '04081', '04082',
  '04083', '04084', '04085', '04086', '04087', '04101', '04102',
]

function mix(state, helper, list) {
  if (helper?.shuffle && helper?.randomValue) return helper.shuffle([...list], () => helper.randomValue(state))
  if (typeof helper?.random === 'function') {
    const copy = [...list]
    for (let index = copy.length - 1; index > 0; index--) {
      const target = Math.floor(helper.random() * (index + 1))
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
    }
    return copy
  }
  return [...list]
}

export function setupPlan(state, helper = {}) {
  const locations = [...EXPLORATION_LOCATIONS]
  const treacheries = Object.values(EXPLORATION_TREACHERIES)
  return {
    explorationDeck: mix(state, helper, [...locations, ...treacheries]),
    locations,
    treacheries,
  }
}

export const behavior = {
  ...encounterRules,
  id: 'theUntamedWilds',
  implementedEncounterCodes,
  roundEndActIndex: 0,

  setupPlan,

  setupLocations(state, events, helper = {}) {
    const plan = setupPlan(state, helper)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [
      '04051', '04052', '04053', '04074', '04075', '04102', '04102', '04102', '04102',
      ...AGENTS_OF_YIG,
      // 伊格的使徒按印刷份数放在一边：伊格之子 3 张、伊格的诅咒 2 张。
      AGENTS_OF_YIG[0], AGENTS_OF_YIG[0], AGENTS_OF_YIG[2],
    ]
    state.scenarioZones.removed = []
    state.scenarioZones.explorationLocations = [...plan.locations]
    state.explorationDeck = [...plan.explorationDeck]
    state.explorationDiscard = []
    state.scenarioFlags ||= {}
    state.scenarioFlags.ichtacaSpawned = false
    return ['expeditionCamp']
  },

  setupEnemies() {
    // 开场只有营地；伊塔卡、亚历山卓与三处遗迹都在一边。
  },

  canExplore(state, inv) {
    return encounterRules.canExplore(state, inv)
  },

  // 第 115 轮：索桥（04071）与曲折小道（04073）的探索前规则在地点条目的 locationRule.beforeExplore。
  beforeExplore(state, inv, api) {
    const location = here(state, inv)
    const rule = locationRuleFor(original(location))
    if (typeof rule?.beforeExplore === 'function') return rule.beforeExplore(state, inv, api, location) !== false
    return true
  },

  afterExplore(state, inv, context) {
    syncSymbolConnections(state)
    const api = context?.runtime
    const location = here(state, inv)
    const rule = locationRuleFor(original(location))
    // 调查/探索后的地点规则（04072 万蛇据点：已中毒则受到 1 点伤害）。
    // 探索成功（翻到连接地点）也要结算，所以放在提前 return 之前。
    rule?.afterExplore?.({ state, inv, api, context, location })
    if (context?.kind === 'location') {
      state.explorationDiscard ||= []
      inv.tfaExploredThisTurn = true
      return
    }
    // 探索失败：抽到的是诡计/敌人（04069 荆棘之路）。
    rule?.afterExploreFailure?.({ state, inv, api, context, location })
  },

  locationEntered(state, inv, location, api) {
    encounterRules.locationEntered?.(state, inv, location, api)
  },

  // ---- 场景 3 的正面持续效果（P2：04048 / 04049）----
  // 04048 搜索遗迹：埃兹特里的守卫者（04086）不能攻击、也不能被攻击；「林中暗箭」（04087）
  // 的效果被忽略（引擎在诡计结算前读这个钩子）。
  // 04086 的两条规则与 04049 的 +1 战斗/躲避已迁到能力层
  // （src/cards/encounter-abilities.js 的 04086 条目），这里只留剧本入口的诡计豁免。
  ignoreTreachery(state, code) {
    return state.scenarioFlags?.actThree === 'search' && original({ code }) === '04087'
  },

  // 04072 万蛇据点：此处的每个蛇族敌人 +1 攻击值（已迁到 04072 地点条目）。
  // 本章只保留共享遭遇组的修正继承。
  enemyStatModifier(state, enemy, stat) {
    return encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
  },

  // 04074 毒牙神庙：胜利区每有一点复仇点数，帷幕 +1（已迁到 04074 地点条目）。
  locationShroudModifier(state, location) {
    return encounterRules.locationShroudModifier?.(state, location) || 0
  },

  // 04049：「林中暗箭」获得涌动。
  encounterGainsSurge(state, code, api) {
    if (state.scenarioFlags?.actThree === 'guarded' && original({ code }) === '04087') return true
    return encounterRules.encounterGainsSurge?.(state, code, api)
  },

  afterTest(state, inv, result, api) {
    tfaChaosAfterTest('theUntamedWilds', state, inv, result, api)
    // 第 115 轮：04069 荆棘之路 / 04072 万蛇据点 / 04053 埃兹特里的遗迹的调查后规则在条目。
    locationRuleFor(original(here(state, inv)))?.afterTest?.({ state, inv, result, api })
  },

  resolveChaosToken(state, inv, token, api) {
    return tfaChaosToken('theUntamedWilds', state, inv, token, api)
  },

  actions(state, inv) {
    const moves = []
    const location = here(state, inv)
    // 第 115 轮：04050 探险营地 / 04070 河流峡谷的行动在地点条目的 locationRule.actions。
    locationRuleFor(original(location))?.actions?.({ state, inv, location, moves })
    const ichtaca = state.enemies.find(enemy => original(enemy) === '04052' && enemy.location === inv.location)
    if (ichtaca) moves.push({
      action: 'scenarioAction', rule: 'parleyIchtaca', enemyId: ichtaca.id,
      label: '🗣️ 谈判：检定智识(4)说服伊塔卡',
    })
    return moves
  },

  performAction(state, inv, move, api) {
    const location = here(state, inv)
    // 第 115 轮：地点条目先接管自己的场景行动。
    if (locationRuleFor(original(location))?.performAction?.(state, inv, move, api, location)) return
    if (move.rule === 'parleyIchtaca') {
      const enemy = state.enemies.find(entry => entry.id === move.enemyId)
      if (!enemy) return
      api.test(inv.seat, 'intellect', 4, result => {
        if (result.success) {
          enemy.clues = (enemy.clues || 0) + 1
          return
        }
        if (!enemy.exhausted) api.attack(enemy, inv)
      })
      return
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知荒莽密林行动：${move.rule}`)
  },

  actReveal(state, act, api) {
    // 第 115 轮：04046–04049 的幕揭示规则在条目的 actRule.onReveal。
    actRuleFor(original(act))?.onReveal?.(state, act, api)
  },

  agendaReveal(state, agenda, api) {
    // 第 115 轮：04044 / 04045 的密谋揭示规则在条目的 agendaRule.onReveal。
    agendaRuleFor(original(agenda))?.onReveal?.(state, agenda, api)
  },

  checkObjectives(state, api) {
    // 第 115 轮：幕的推进检查由条目的 actRule.objectiveCheck 声明。
    const act = state.acts[state.actIndex]
    actRuleFor(original(act))?.objectiveCheck?.(state, act, api)
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    // 第 115 轮：04046 的轮末共同支付由条目的 actRule.roundEndCheck 声明。
    const act = state.acts[state.actIndex]
    actRuleFor(original(act))?.roundEndCheck?.(state, act, api)
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
  },

  resolution(state, key, events, api) {
    if (!['noResolution', 'r1', 'r2'].includes(key)) throw new Error('未知荒莽密林结局')
    const records = recordsFor(state)
    if (key === 'noResolution') {
      records.theInvestigatorsWereForcedToWaitForAdditionalSupplies = true
      if (state.actIndex < 2) {
        records.ichtacaObservedYourProgressWithKeenInterest = true
        records.alejandroFollowedTheInvestigatorsIntoTheRuins = true
        api.giveAsset?.(state.campaign.leadSeat, '04051')
      }
      if (state.scenarioFlags?.tfaFoughtWithIchtaca) {
        records.ichtacaIsWaryOfTheInvestigators = true
        records.alejandroFollowedTheInvestigatorsIntoTheRuins = true
      }
      if (state.scenarioFlags?.ichtacaLeadsTheWay) {
        records.theInvestigatorsHaveEarnedIchtacasTrust = true
        records.alejandroChoseToRemainAtCamp = true
      }
      return { award: true, bonus: 0 }
    }
    if (key === 'r1') {
      records.theInvestigatorsClearedAPathToTheEztliRuins = true
      records.alejandroChoseToRemainAtCamp = true
      records.theInvestigatorsHaveEarnedIchtacasTrust = true
      return { award: true, bonus: 0 }
    }
    records.theInvestigatorsClearedAPathToTheEztliRuins = true
    records.alejandroFollowedTheInvestigatorsIntoTheRuins = true
    records.ichtacaIsWaryOfTheInvestigators = true
    return { award: true, bonus: 0 }
  },
}
