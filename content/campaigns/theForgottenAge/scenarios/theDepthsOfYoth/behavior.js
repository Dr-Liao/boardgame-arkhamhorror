import { changeChaosBag } from '../../../../../src/engine/chaos-bag.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { chooseCandidate } from '../../../../choice-helpers.js'
import { encounterRules, isPoisoned } from '../../encounter-rules.js'
import { agendaRuleFor, locationRuleFor } from '../../../../../src/cards/card-rules.js'
import { nonPlayerEntryFor } from '../../../../../src/cards/encounter-abilities.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../../tfa-chaos.js'
import {
  DEPTH_LOCATIONS, STEPS_OF_YOTH, RELIC_OF_AGES, HARBINGER, YIG, PIT_WARDEN,
  EATER_OF_THE_DEPTHS, CHILDREN_OF_VALUSIA, agendaCodesFor,
} from './definition.js'

// 幽嘶深渊：深度等级（depth level）驱动的连续下降 + 伊格之怒。
// 深度等级存在 state.scenarioFlags.depthLevel（引擎的混乱标记表按它取 X），
// 每次幕推进 +1；追击区、放在一边的地点池也都写成可 JSON 保存的纯数据。

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => (state.campaign.records ||= {})
const flagsFor = (state) => (state.scenarioFlags ||= {})
const zonesFor = (state) => (state.scenarioZones ||= {})
const original = card => card?.originalCode || card?.code
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const traits = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
const hasTrait = (card, trait) => traits(card).includes(trait)
const isSerpent = card => hasTrait(card, 'Serpent')
const depthOf = state => Math.max(1, Number(state.scenarioFlags?.depthLevel || 1))
const yigsFuryOf = state => Number(state.campaign.records?.yigsFury || 0)

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

function pickAtRandom(state, api, list) {
  if (!list.length) return null
  const index = Math.min(list.length - 1, Math.floor((api?.random?.() ?? 0) * list.length))
  return list[index]
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------

// 中毒弱点一共 4 张；已经在牌库里的部分不再放进一边。
export function poisonedSetAsideCount(state) {
  const list = state.campaign?.investigators
  const entries = Array.isArray(list) ? list : Object.values(list || {})
  let inDecks = 0
  for (const entry of entries) inDecks += (entry?.deck || []).filter(code => nonPlayerEntryFor(code)?.flags?.poisoned).length
  return Math.max(0, 4 - inDecks)
}

// 瓦卢西亚的预示者用「记录里的伤害」当初始伤害；记录为 0 视作已不存活。
export function harbingerStartingDamage(state) {
  const value = state.campaign?.records?.theHarbingerIsStillAlive
  if (typeof value === 'number') return value
  return value ? 1 : 0
}

export function setupPlan(state, helper = {}) {
  const shuffled = mix(state, helper, [...DEPTH_LOCATIONS])
  const startLocation = shuffled[0]
  const inExplore = shuffled.slice(1, 5)
  const setAsideLocations = shuffled.slice(5)
  return {
    startLocation,
    explorationDeck: mix(state, helper, [STEPS_OF_YOTH, ...inExplore]),
    setAsideLocations,
    agendaCodes: agendaCodesFor(yigsFuryOf(state)),
  }
}

// 深度等级 1 的起始地点由洗牌决定；04xxx 的起始地点在卡面随机，所以这里也用它。
export const behavior = {
  ...encounterRules,
  id: 'theDepthsOfYoth',
  // 幕的目标只在轮末支付线索（04285：Objective - 一轮结束时……）。
  roundEndActIndex: 0,
  implementedEncounterCodes: [
    '04062', // 瓦卢西亚的预示者：共享钩子（资源累积 / 横置反击 / 带伤入场）
    '04296', '04297', '04298', '04299', '04300', '04301', '04302',
  ],

  setupPlan,

  startLocation(state) {
    return state.scenarioFlags?.depthStartLocation || 'cityOfTheSerpents'
  },

  // 剧本导入的分支记录（Haskell PreScenarioSetup）。
  preScenarioSetup(state, events, api) {
    const records = recordsFor(state)
    const flags = flagsFor(state)
    const forging = Boolean(records.youAreForgingYourOwnWay)
    const faithRestored = Boolean(records.ichtacasFaithIsRestored)
    if (forging) {
      records.ichtacaIsSetAgainstYou = true
      flags.extraElderThingToken = true
      return
    }
    if (faithRestored) return
    records.ichtacaIsSetAgainstYou = true
    const hasPocketknife = active(state).some(inv =>
      api?.hasSupply?.(inv.seat, 'pocketknife') ?? api?.checkSupplies?.(inv.seat, 'pocketknife'))
    if (!records.theRelicIsMissing && !hasPocketknife) {
      // 伊塔卡拿走了古代遗物：划掉「找回了遗失的遗物」，把遗物移出战役。
      records.theInvestigatorsFoundTheMissingRelic = false
      records.theRelicIsMissing = true
      state.relicOfAges = null
    }
  },

  setupLocations(state, events, helper = {}) {
    const plan = setupPlan(state, helper)
    const flags = flagsFor(state)
    const zones = zonesFor(state)
    zones.setAside = [RELIC_OF_AGES, ...Array(poisonedSetAsideCount(state)).fill('04102')]
    // 找回了古代遗物：本关使用「重拾往昔」版本（04303），交给领队控制。
    const records = recordsFor(state)
    if (records.theInvestigatorsRecoveredTheRelicOfAges && !records.theRelicIsMissing) {
      const holder = state.investigators.find(inv => inv.seat === (state.campaign?.leadSeat ?? 0)
        && !inv.defeated && !inv.resigned) || state.investigators.find(inv => !inv.defeated && !inv.resigned)
      if (holder) {
        holder.assets ||= []
        holder.assets.push({
          id: `relicOfAges:${holder.seat}`, code: RELIC_OF_AGES, originalCode: RELIC_OF_AGES,
          name: ALL_CARDS[RELIC_OF_AGES]?.nameZh, exhausted: false, damage: 0, horror: 0,
        })
        zones.setAside = zones.setAside.filter(code => code !== RELIC_OF_AGES)
        state.relicOfAges = { code: RELIC_OF_AGES, seat: holder.seat, location: holder.location }
      }
    }
    zones.removed = []
    zones.locationPool = [...plan.setAsideLocations]
    zones.pursuit = []
    zones.childrenOfValusia = []
    delete zones.harbingerAside
    flags.depthLevel = 1
    flags.depthStartLocation = plan.startLocation
    flags.collectedAStrangeLiquid = false
    // 密谋牌库按伊格之怒裁剪：怒气越高，开场越靠后。
    state.agendas = state.scenario.agendas
      .filter(agenda => plan.agendaCodes.includes(agenda.originalCode))
      .map(agenda => structuredClone(agenda))
    state.agendaIndex = 0
    state.explorationDeck = [...plan.explorationDeck]
    state.explorationDiscard = []
    for (const inv of state.investigators) {
      if (inv.defeated || inv.resigned) continue
      inv.location = plan.startLocation
    }
    return [plan.startLocation]
  },

  setupEnemies(state, events, helper = {}) {
    const zones = zonesFor(state)
    const flags = flagsFor(state)
    const fury = yigsFuryOf(state)
    const agendaCodes = agendaCodesFor(fury)
    const startsOnAgendaSix = agendaCodes[0] === '04283'
    const startsOnAgendaFive = startsOnAgendaSix || agendaCodes[0] === '04282'
    if (fury === 0) {
      // 怒气为 0：伊格与 3 张深坑守卫整场移出游戏。
      zones.removed.push(YIG, PIT_WARDEN, PIT_WARDEN, PIT_WARDEN)
    } else if (startsOnAgendaSix) {
      zones.pursuit.push({ code: YIG, damageTaken: 0, resources: 0 })
    } else {
      zones.setAside.push(YIG)
    }
    const harbingerDamage = harbingerStartingDamage(state)
    if (harbingerDamage > 0) {
      const entry = { code: HARBINGER, damageTaken: harbingerDamage, resources: 0 }
      if (startsOnAgendaFive) zones.pursuit.push(entry)
      else zones.harbingerAside = entry
      flags.harbingerEnteredPlay = false
    }
    helper.info?.(state, events, `本深度等级从「${helper.locName?.(state, flags.depthStartLocation) || flags.depthStartLocation}」开始。`)
  },

  afterChaosBagSetup(state, events) {
    const flags = flagsFor(state)
    if (!flags.extraElderThingToken || flags.extraElderThingTokenApplied) return
    // 自行其路：混乱袋永久加入 1 个古神标记。
    flags.extraElderThingTokenApplied = true
    changeChaosBag(state, 'elderthing', 1, { permanent: true })
  },

  afterDeckSetup(state, events, helper = {}) {
    if (yigsFuryOf(state) !== 0) return
    state.encounterDeck = (state.encounterDeck || []).filter(code => code !== YIG && code !== PIT_WARDEN)
    helper.info?.(state, events, '伊格之怒为 0：伊格与深坑守卫已被移出游戏。')
  },

  // -------------------------------------------------------------------------
  // 深度等级
  // -------------------------------------------------------------------------

  // 每次幕推进时 +1；幽嘶的阶梯的反应能力可以再 +1（每场游戏一次，划掉绳索）。
  incrementDepth(state, api) {
    const flags = flagsFor(state)
    let next = depthOf(state) + 1
    if (!flags.stepsOfYothRopeUsed) {
      const stepsInPlay = state.locations.some(location => location.id === STEPS_OF_YOTH)
      const atSteps = active(state).filter(inv => inv.location === STEPS_OF_YOTH)
      const clues = atSteps.reduce((sum, inv) => sum + (inv.clues || 0), 0)
      const holder = stepsInPlay && clues >= 5 * state.numInvestigators
        ? atSteps.find(inv => api?.hasSupply?.(inv.seat, 'rope') ?? api?.checkSupplies?.(inv.seat, 'rope'))
        : null
      if (holder) {
        // [reaction] 是可选的：问一下，且真正划掉绳索（crossOffSupply 返回 false）才 +1。
        const answer = typeof api?.choose === 'function'
          ? api.choose({
            kind: 'reaction', source: '04286', seat: holder.seat, canSkip: true,
            prompt: '幽嘶的阶梯：划掉绳索，让当前深度等级额外 +1？（每场游戏一次）',
            options: [
              { id: 'use', label: '划掉绳索，深度额外 +1' },
              { id: 'skip', label: '不使用' },
            ],
          })
          : 'use'
        if (answer === 'use') {
          const crossed = api.crossOffSupply?.(holder.seat, 'rope')
          if (crossed !== false) {
            flags.stepsOfYothRopeUsed = true
            next += 1
            api.info?.(`幽嘶的阶梯：${holder.name} 划掉绳索，当前深度等级额外 +1。`)
          } else {
            api.info?.(`幽嘶的阶梯：${holder.name} 没能划掉绳索，深度不额外 +1。`)
          }
        }
      }
    }
    flags.depthLevel = next
    api.info?.(`🕳️ 当前深度等级变为 ${next}。`)
    return next
  },

  // -------------------------------------------------------------------------
  // 探索限制与地点效果
  // -------------------------------------------------------------------------

  canExplore(state, inv) {
    if (!encounterRules.canExplore(state, inv)) return false
    // 04285：只有你所在地点没有线索时才能探索。
    const location = here(state, inv)
    return (location?.clues || 0) <= 0
  },

  // 04285：探索翻出的地点必须与当前地点相连（按剧本的符号连线），
  // 否则不放置入场（引擎把它放回探索牌库底部）。
  exploreConnects(state, fromId, code) {
    const from = state.scenario.locations?.[fromId]
    if (!from) return true
    const links = from.connections || []
    if (!links.length) return true
    return links.includes(code)
  },

  beforeExplore(state, inv, api) {
    // 探索后仍需要知道「从哪一处地点开始探索」（分岔路要用）。
    inv.tfaExploreFrom = inv.location
    const location = here(state, inv)
    const code = original(location)
    // 第 87 轮：04293 坍塌通道的探索前规则在地点条目。
    const entryHandled = locationRuleFor(code)?.beforeExplore?.(state, inv, api)
    if (entryHandled != null) return entryHandled
    return true
  },

  afterExplore(state, inv, context) {
    const from = inv.tfaExploreFrom
    delete inv.tfaExploreFrom
    const api = context?.runtime
    if (!api || context?.kind !== 'location') return
    if (from !== 'forkedPath' || !(api.hasSupply?.(inv.seat, 'map') ?? api.checkSupplies(inv.seat, 'map'))) return
    // 分岔路 + 地图：再从探索牌库翻出 1 处连接地点，放它入场并可以让过去。
    const extra = drawConnectingLocation(state, api)
    if (!extra) return
    const destination = state.locations.find(location => location.id === extra)
    const answer = typeof api.choose === 'function'
      ? api.choose({
        kind: 'location', source: '04291', seat: inv.seat,
        prompt: '分岔路（地图）：是否移动到另一处刚刚发现的地点？',
        options: [{ id: 'stay', label: `留在「${state.locations.find(location => location.id === context.code)?.name || context.code}」` },
          { id: extra, label: `移动到「${destination?.name || extra}」` }],
      })
      : 'stay'
    if (answer === extra) api.moveInvestigator(inv.seat, extra)
  },

  // 被遗弃的仪式场所：帷幕 X = 当前深度等级；横跨恩凯之桥：每点复仇 +1 帷幕。
  locationShroudModifier(state, location) {
    const code = original(location)
    // 第 87 轮：04294 的「帷幕=深度」在地点条目 shroudModifier。
    const entryModifier = locationRuleFor(code)?.shroudModifier?.(state, location)
    if (entryModifier != null) return entryModifier
    // 横跨恩凯之桥：每点复仇 +1 帷幕。要用「视同胜利区」的合计，而不是只读胜利区。
    if (nonPlayerEntryFor(code)?.flags?.vengeanceShroud) return totalVengeance(state)
    return 0
  },

  locationRevealed(state, location, api) {
    if (original(location) !== '04290') return
    // 幽嘶洞群：入场后按当前深度等级放置线索。
    const depth = depthOf(state)
    location.clues = (location.clues || 0) + depth
    api?.info?.(`幽嘶洞群：按当前深度等级放置 ${depth} 个线索。`)
  },

  locationEntered(state, inv, location, api) {
    if (original(location) === '04295' && isPoisoned(inv)) {
      api?.info?.(`光耀峡谷：${inv.name} 已中毒，受到 1 点伤害。`)
      api?.damage?.(inv.seat, 1)
    }
  },

  // -------------------------------------------------------------------------
  // 剧本行动
  // -------------------------------------------------------------------------

  actions(state, inv) {
    const moves = []
    const location = here(state, inv)
    if (original(location) === '04295') {
      const used = state.scenarioFlags?.brightCanyonDepth
      // 卡面：只有带双筒望远镜才有这个行动；没有就不显示按钮。
      const hasBinoculars = (state.campaign?.supplies?.[inv.seat] || []).includes('binoculars')
      if (used !== depthOf(state) && hasBinoculars) moves.push({
        action: 'scenarioAction', rule: 'brightCanyonClues', locationId: 'brightCanyon',
        label: '🔭 检查补给：带双筒望远镜就发现光耀峡谷的 2 个线索（团队每深度等级一次）',
      })
    }
    const relic = (inv.assets || []).find(asset => original(asset) === RELIC_OF_AGES)
    if (!state.scenarioFlags?.relicOfAgesSucceeded) moves.push({
      action: 'scenarioAction', rule: 'relicOfAgesDoom', assetId: relic?.id,
      label: '🏺 横置古代遗物：检定意志(4)，成功则移除场上 1 点毁灭（每场游戏一次成功）',
      reason: !relic ? '需要先控制古代遗物'
        : relic.exhausted ? '古代遗物已横置，需要先重整' : null,
    })
    return moves
  },

  performAction(state, inv, move, api) {
    if (move.rule === 'brightCanyonClues') {
      const location = here(state, inv)
      if (!(api.hasSupply?.(inv.seat, 'binoculars') ?? api.checkSupplies(inv.seat, 'binoculars'))) {
        api.info?.('光耀峡谷：队伍中没有人带双筒望远镜，这次行动没有效果。')
        return
      }
      const flags = flagsFor(state)
      flags.brightCanyonDepth = depthOf(state)
      const found = Math.min(2, location?.clues || 0)
      if (found > 0) {
        location.clues -= found
        api.gainClues(inv.seat, found)
      }
      api.info?.(`光耀峡谷：发现了 ${found} 个线索。`)
      return
    }
    if (move.rule === 'relicOfAgesDoom') {
      const asset = (inv.assets || []).find(item => item.id === move.assetId)
      if (!asset) return
      asset.exhausted = true
      api.test(inv.seat, 'willpower', 4, result => {
        if (!result.success) return
        const removed = removeOneDoomFromAnyCard(state, inv, api)
        if (!removed) return
        flagsFor(state).relicOfAgesSucceeded = true
        api.info?.('古代遗物：场上 1 点毁灭被移除。')
      }, 0, { label: '古代遗物', ability: true })
      return
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知幽嘶深渊行动：${move.rule}`)
  },

  // -------------------------------------------------------------------------
  // 遭遇卡（04299–04302）
  // -------------------------------------------------------------------------

  resolveEncounter(state, inv, t, api) {
    const code = original(t)
    const location = here(state, inv)
    if (code === CHILDREN_OF_VALUSIA) {
      // 瓦卢西亚之子：放在密谋牌库旁，每个蛇族敌人 +1 攻击 +1 躲避。
      const zones = zonesFor(state)
      zones.childrenOfValusia ||= []
      zones.childrenOfValusia.push(CHILDREN_OF_VALUSIA)
      api.info?.('瓦卢西亚之子被放在密谋牌库旁：每个蛇族敌人 +1 攻击值、+1 躲避值。')
      return true
    }
    // 第 114 轮：蛇族的愤怒（04302）已迁到遭遇条目（encounterResolve）。
    return encounterRules.resolveEncounter(state, inv, t, api)
  },

  // -------------------------------------------------------------------------
  // 敌人
  // -------------------------------------------------------------------------

  // 伊格：所在地点有另一个处于重整状态的蛇族敌人时不能受到伤害。
  enemyDamageAllowed(state, enemy, source, seat) {
    if (original(enemy) === YIG) {
      const guard = state.enemies.some(other => other.id !== enemy.id && other.location === enemy.location
        && !other.exhausted && isSerpent(other))
      if (guard) return false
    }
    return encounterRules.enemyDamageAllowed?.(state, enemy, source, seat) !== false
  },

  enemyStatModifier(state, enemy, stat) {
    let value = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    // 瓦卢西亚之子：**每张**在密谋牌库旁的副本都给蛇族 +1 攻击值、+1 躲避值。
    const children = (state.scenarioZones?.childrenOfValusia || []).length
    if (isSerpent(enemy) && children && (stat === 'fight' || stat === 'evade')) value += children
    // 深渊吞噬者：「X 为当前深度等级」——只补躲避值，生命值保持印刷 6（04298）。
    if (original(enemy) === EATER_OF_THE_DEPTHS && stat === 'evade') value += depthOf(state)
    return value
  },

  enemySpawned(state, enemy, api) {
    const code = original(enemy)
    if (code === HARBINGER) flagsFor(state).harbingerEnteredPlay = true
    // 记录印刷关键词，04296 的「其他蛇族获得警戒/反击」是动态光环，离开后要还原。
    for (const other of state.enemies) {
      if (!isSerpent(other) || original(other) === YIG) continue
      if (other.printedAlert === undefined) other.printedAlert = !!other.alert
      if (other.printedRetaliate === undefined) other.printedRetaliate = !!other.retaliate
    }
    refreshYigAura(state)
  },

  enemyMoved(state, enemy, api) {
    refreshYigAura(state)
  },

  enemyDefeated(state, enemy, api) {
    refreshYigAura(state)
    return encounterRules.enemyDefeated?.(state, enemy, api)
  },

  enemyDiscarded(state, enemy, api) {
    refreshYigAura(state)
    return encounterRules.enemyDiscarded?.(state, enemy, api) ?? false
  },

  // 深坑守卫：伊格在场时生成在伊格所在地点，否则放进追击区域。
  spawnLocation(state, code, loc, engagedSeat, api) {
    if (code === PIT_WARDEN) {
      const yig = state.enemies.find(enemy => original(enemy) === YIG)
      return yig ? yig.location : null
    }
    if (code === EATER_OF_THE_DEPTHS) {
      // 深渊吞噬者：随机一处放在一边的地点入场，并在那里生成。
      return placeRandomSetAsideLocation(state, api) || loc
    }
    return loc
  },

  spawnFailed(state, code, engagedSeat, api) {
    if (code !== PIT_WARDEN) return
    const index = state.encounterDiscard.lastIndexOf(PIT_WARDEN)
    if (index >= 0) state.encounterDiscard.splice(index, 1)
    const zones = zonesFor(state)
    zones.pursuit ||= []
    zones.pursuit.push({ code: PIT_WARDEN, damageTaken: 0, resources: 0 })
    api?.info?.('深坑守卫被放入追击区域。')
  },

  // 预言者：成功攻击或躲避后放置 1 资源；达到 2×人数时遁去（保留伤害）。
  // P2：统一由 encounter-rules 的共享钩子结算。
  enemyAttackedSuccessfully(state, inv, enemy, api) {
    return encounterRules.enemyAttackedSuccessfully?.(state, inv, enemy, api)
  },

  afterEvade(state, inv, enemy, result, api) {
    return encounterRules.afterEvade?.(state, inv, enemy, result, api)
  },

  // -------------------------------------------------------------------------
  // 混乱标记
  // -------------------------------------------------------------------------

  resolveChaosToken(state, inv, token, api) {
    return tfaChaosToken('theDepthsOfYoth', state, inv, token, api)
  },

  afterTest(state, inv, result, api) {
    tfaChaosAfterTest('theDepthsOfYoth', state, inv, result, api)
    encounterRules.afterTest?.(state, inv, result, api)
    // 困难/专家：骷髅标记检定失败再受 1 点恐惧。
    const tokens = (result.drawn || []).filter(token => !(result.cancelledTokens || []).includes(token))
    if (!result.success && tokens.includes('skull') && ['hard', 'expert'].includes(state.difficulty)) {
      api.horror(inv.seat, 1)
    }
  },

  // -------------------------------------------------------------------------
  // 幕 / 密谋
  // -------------------------------------------------------------------------

  actReveal(state, act, api) {
    const code = original(act)
    if (code !== '04285') throw new Error(`未知幽嘶深渊场景：${code}`)
    descend(state, api)
  },

  agendaReveal(state, agenda, api) {
    const code = original(agenda)
    // 第 111 轮：全部密谋翻面都在 agendaRule.onReveal。
    const entry = nonPlayerEntryFor(code)?.agendaRule?.onReveal
    if (entry) { entry(state, agenda, api); return }
    throw new Error(`未知幽嘶深渊密谋：${code}`)
  },

  // 放置毁灭后的强制（P2 引擎钩子 doomPlaced）：
  //   04282 撼地之怒：本密谋上第 3 个毁灭标记后放 1 名追击敌人。
  //   04283 赤红深渊：每次在本密谋上放置毁灭后都放 1 名追击敌人。
  doomPlaced(state, payload, api) {
    if (!payload?.agenda) return
    const code = original(state.agendas?.[state.agendaIndex])
    nonPlayerEntryFor(code)?.agendaRule?.onDoomPlaced?.(state, payload, api)
    // 04283 背面留下的持续效果：推进到 04284 后，每次当前密谋放毁灭仍然放追击敌人。
    if (flagsFor(state).redDepthsOngoing && !nonPlayerEntryFor(code)?.agendaRule?.onDoomPlaced) {
      tfaPlacePursuit(state, api)
    }
  },

  // -------------------------------------------------------------------------
  // 轮末
  // -------------------------------------------------------------------------

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    const flags = flagsFor(state)
    const zones = zonesFor(state)
    // 瓦卢西亚之子：轮末从场上弃掉 1 张（每轮最多一次）。
    const children = zones.childrenOfValusia || []
    if (children.length && flags.childrenDiscardedRound !== state.round) {
      flags.childrenDiscardedRound = state.round
      const code = children.pop()
      if (code) state.encounterDiscard.push(code)
      api.info?.('瓦卢西亚之子：轮末从场上弃掉 1 张。')
    }
    const agenda = state.agendas?.[state.agendaIndex]
    // 赤红深渊（04283）的强制已改由引擎的 doomPlaced 钩子逐次结算，
    // 不再在轮末补一次脉冲（见本文件的 doomPlaced）。
    void agenda
  },

  // 04284 复仇：神话阶段「检查毁灭阈值」步骤结束时，场上每点毁灭让调查员按玩家
  // 顺序各抽 1 张额外遭遇牌。此前写在轮末，会少算刚放下的毁灭、也多算了之后的毁灭。
  mythosDoomChecked(state, api) {
    const agenda = state.agendas?.[state.agendaIndex]
    if (original(agenda) !== '04284') return
    const doom = (state.doom || 0)
      + state.locations.reduce((sum, location) => sum + (location.doom || 0), 0)
      + state.enemies.reduce((sum, enemy) => sum + (enemy.doom || 0), 0)
    if (!doom) return
    const order = active(state).slice().sort((left, right) =>
      (left.seat - (state.campaign.leadSeat ?? 0) + state.numInvestigators) % state.numInvestigators
      - (right.seat - (state.campaign.leadSeat ?? 0) + state.numInvestigators) % state.numInvestigators)
    if (!order.length) return
    api.info?.(`复仇：场上 ${doom} 点毁灭，调查员按玩家顺序追加抽取 ${doom} 张遭遇牌。`)
    for (let index = 0; index < doom; index++) {
      const target = order[index % order.length]
      if (!target || target.defeated || target.resigned) continue
      api.drawEncounter(target.seat)
    }
  },

  // -------------------------------------------------------------------------
  // 结局
  // -------------------------------------------------------------------------

  // 未达成结局按卡面同样进入「结局 1」（坠入深渊）。
  storyResolutionKey(state, key) {
    return key === 'noResolution' ? 'r1' : key
  },

  resolution(state, key, events, api = {}) {
    if (!['noResolution', 'r1', 'r2'].includes(key)) throw new Error('未知幽嘶深渊结局')
    const records = recordsFor(state)
    const depth = depthOf(state)
    const fell = key !== 'r2'
    if (fell) records.theInvestigatorsFellIntoTheDepths = true
    else records.theNexusIsNear = true
    if (fell) {
      // 深度 1：全员阵亡（战役记录也标成 killed，不能还按在役算）。
      if (depth === 1) {
        for (const inv of active(state)) {
          inv.defeated = true
          inv.defeatCause = 'fellIntoTheDepths'
          const record = state.campaign.investigators?.[inv.seat]
          if (record) record.status = 'killed'
        }
        if (!state.investigators.some(inv => !inv.defeated && !inv.resigned)) state.campaign.failed = true
      } else {
        const trauma = depth === 2 ? 2 : depth === 3 ? 1 : 0
        if (trauma) for (const inv of active(state)) api.addTrauma?.(state, inv.seat, 'physical', trauma, events)
        // 深度 2：每位幸存调查员再从收藏随机获得一张基础[[伤势]]弱点并洗入牌库。
        if (depth === 2) {
          const pool = Object.values(ALL_CARDS).filter(card =>
            card.subtype === 'weakness' && (card.traits || []).includes('Injury'))
          for (const inv of active(state)) {
            const record = state.campaign.investigators?.[inv.seat]
            if (!record) continue
            record.deck ||= []
            const available = pool.filter(card => !record.deck.includes(card.code))
            if (!available.length) continue
            const pick = available[Math.floor((api.random?.() ?? 0.5) * available.length)] || available[0]
            record.deck.push(pick.code)
            api.info?.(`🩹 ${inv.name} 从收藏获得基础伤势弱点「${pick.nameZh || pick.name}」并洗入牌库。`)
          }
        }
      }
    }
    // 瓦卢西亚的预示者：进了胜利区就划掉记录，否则把它的伤害写回记录。
    if (flagsFor(state).harbingerEnteredPlay) {
      const inVictory = (state.victoryDisplay || []).some(card => original(card) === HARBINGER)
      if (inVictory) {
        records.theHarbingerIsStillAlive = 0
      } else {
        const inPlay = state.enemies.find(enemy => original(enemy) === HARBINGER)
        const aside = zonesFor(state).harbingerAside
        records.theHarbingerIsStillAlive = inPlay
          ? (inPlay.damageTaken || 0)
          : aside ? (aside.damageTaken || 0) : Number(records.theHarbingerIsStillAlive || 0)
      }
    }
    // 胜利区每有 1 点复仇点数，就在「伊格之怒」下方作 1 次记录。
    const vengeance = totalVengeance(state)
    if (vengeance > 0) records.yigsFury = Number(records.yigsFury || 0) + vengeance
    // 「收集了一种奇怪的液体」+ 粘稠物：取得埃兹特里的钥匙。
    if (flagsFor(state).collectedAStrangeLiquid) {
      const holders = active(state).filter(inv => suppliesOf(state, inv.seat).includes('stickyGoop'))
      let holder = holders[0]
      // 多位调查员都带粘稠物时，由队长选择谁拿钥匙（不再默认第一个）。
      if (holders.length > 1 && typeof api?.choose === 'function') {
        const answer = api.choose({
          kind: 'investigator', source: '04284', seat: state.campaign.leadSeat ?? 0,
          prompt: '选择一位带有粘稠物的调查员：他/她获得埃兹特里的钥匙。',
          options: holders.map(inv => ({ id: String(inv.seat), label: inv.name })),
        })
        holder = holders.find(inv => String(inv.seat) === String(answer)) || holders[0]
      }
      if (holder) {
        const list = state.campaign.supplies[holder.seat]
        if (!list.includes('keyOfEztli')) list.push('keyOfEztli')
      }
    }
    return { award: true, bonus: depth }
  },
}

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

const CRUMBLING_TESTS = [['willpower', 4], ['agility', 3], ['combat', 2]]

function crumblingChain(state, inv, api, index, outcome) {
  const [skill, difficulty] = CRUMBLING_TESTS[index]
  api.test(inv.seat, skill, difficulty, result => {
    if (result.success) {
      outcome.died = false
      return
    }
    if (index + 1 < CRUMBLING_TESTS.length) {
      crumblingChain(state, inv, api, index + 1, outcome)
      return
    }
    outcome.died = true
    api.info?.(`岌岌可危的悬崖：${inv.name} 三次检定全部失败，坠入深渊身亡。`)
    // 卡面是「坠入深渊，阵亡」：直接写进战役记录，而不是折算成精神创伤。
    api.defeat(inv, 'killed')
    const record = state.campaign?.investigators?.[inv.seat]
    if (record) record.status = 'killed'
  }, 0, { label: '岌岌可危的悬崖', ability: true })
}

// 04296 伊格：所在地点上的其他蛇族敌人获得警戒与反击。这是持续光环——
// 蛇族离开、伊格离开或被击败后要还原到印刷关键词。
function refreshYigAura(state) {
  const yig = (state.enemies || []).find(enemy => original(enemy) === YIG)
  for (const enemy of state.enemies || []) {
    if (original(enemy) === YIG || !isSerpent(enemy)) continue
    if (enemy.printedAlert === undefined) enemy.printedAlert = !!enemy.alert
    if (enemy.printedRetaliate === undefined) enemy.printedRetaliate = !!enemy.retaliate
    const shares = !!yig && enemy.location === yig.location
    enemy.alert = shares ? true : !!enemy.printedAlert
    enemy.retaliate = shares ? true : !!enemy.printedRetaliate
  }
}

function vengeanceInVictoryDisplay(state) {  return (state.victoryDisplay || []).reduce((sum, card) => sum + Number(card.vengeance || 0), 0)
}

// 结局时的复仇总计：胜利区 + 视同进入胜利区的地点（04066/04287/04288）。
export function totalVengeance(state) {
  return encounterRules.inPlayVengeance ? encounterRules.inPlayVengeance(state) : vengeanceInVictoryDisplay(state)
}

function suppliesOf(state, seat) {
  state.campaign.supplies ||= {}
  state.campaign.supplies[seat] ||= []
  return state.campaign.supplies[seat]
}

function pursuitEvade(state, entry) {
  const printed = Number(state.scenario.enemies?.[entry.code]?.evade || 0)
  return entry.code === EATER_OF_THE_DEPTHS ? printed + depthOf(state) : printed
}

// 追击区域：放在场外、保留伤害的敌人（原卡：追击区域）。
export function pursuitEnemies(state) {
  return [...(zonesFor(state).pursuit || [])]
}

export function placePursuitEnemies(state, api) {
  const pursuit = zonesFor(state).pursuit || []
  if (!pursuit.length) return null
  const best = Math.max(...pursuit.map(entry => pursuitEvade(state, entry)))
  const candidates = pursuit.filter(entry => pursuitEvade(state, entry) === best)
  const chosen = candidates.length === 1 || typeof api?.choose !== 'function'
    ? candidates[0]
    : candidates[Number(api.choose({
      kind: 'enemy', source: 'theDepthsOfYoth', seat: state.campaign.leadSeat,
      prompt: '选择一位躲闪值最高的追击敌人入场。',
      options: candidates.map((entry, index) => ({
        id: String(index), label: state.scenario.enemies?.[entry.code]?.name || entry.code,
      })),
    }))] || candidates[0]
  const index = pursuit.indexOf(chosen)
  if (index >= 0) pursuit.splice(index, 1)
  const start = state.scenarioFlags?.depthStartLocation
  const enemy = api.spawn(chosen.code, start)
  if (!enemy) {
    pursuit.push(chosen)
    return null
  }
  enemy.damageTaken = chosen.damageTaken || 0
  if (chosen.code === HARBINGER && chosen.resources) enemy.harbingerResources = chosen.resources
  api.info?.(`追击中的「${enemy.name}」在「${start}」现身。`)
  return enemy
}

function placeRandomSetAsideLocation(state, api) {
  const zones = zonesFor(state)
  const pool = zones.locationPool || []
  if (!pool.length) return null
  const id = pickAtRandom(state, api, pool)
  const index = pool.indexOf(id)
  if (index >= 0) pool.splice(index, 1)
  api.place(id)
  api.reveal(id)
  return id
}

// 分岔路：继续从探索牌库抽牌，直到翻出 1 处地点（遭遇卡放回牌库底部）。
function drawConnectingLocation(state, api) {
  const deck = state.explorationDeck ||= []
  // 卡面：继续抽，直到抽出「连接地点」。按剧本定义的符号连线判断，而不是随便抽一处。
  const originDef = state.scenario.locations?.forkedPath
  const desired = new Set(originDef?.connections || [])
  const returned = []
  let found = null
  while (deck.length && !found) {
    const code = deck.pop()
    const isLocation = Boolean(state.scenario.locations?.[code])
    const connecting = desired.size === 0 || desired.has(code)
    if (isLocation && connecting && code !== 'forkedPath') found = code
    else returned.push(code)
  }
  state.explorationDeck = [...returned.reverse(), ...deck]
  if (!found) return null
  api.place(found)
  api.reveal(found)
  const origin = state.locations.find(location => location.id === 'forkedPath')
  const placed = state.locations.find(location => location.id === found)
  if (origin && placed) {
    origin.connections = [...new Set([...(origin.connections || []), placed.id])]
    placed.connections = [...new Set([...(placed.connections || []), origin.id])]
  }
  return found
}

function removeEnemyFromPlay(state, enemy) {
  const index = state.enemies.indexOf(enemy)
  if (index < 0) return false
  state.enemies.splice(index, 1)
  if (enemy.engagedSeat != null) {
    const inv = state.investigators[enemy.engagedSeat]
    if (inv) inv.engaged = (inv.engaged || []).filter(id => id !== enemy.id)
  }
  return true
}

function removeOneDoomFromAnyCard(state, inv, api) {
  const candidates = []
  if ((state.doom || 0) > 0) candidates.push({ id: 'agenda', label: '当前密谋' })
  for (const location of state.locations) {
    if ((location.doom || 0) > 0) candidates.push({ id: location.id, label: location.name })
  }
  if (!candidates.length) {
    api.info?.('古代遗物：场上没有任何卡牌带毁灭标记。')
    return false
  }
  const chosen = chooseCandidate(api, {
    kind: 'card', source: RELIC_OF_AGES, seat: inv.seat,
    prompt: '选择要移除 1 点毁灭的卡牌。',
  }, candidates, { key: option => String(option.id) })
  if (chosen.id === 'agenda') state.doom = Math.max(0, (state.doom || 0) - 1)
  else {
    const location = state.locations.find(entry => entry.id === chosen.id)
    if (location) location.doom = Math.max(0, (location.doom || 0) - 1)
  }
  return true
}

// 04285 背面：深度等级 +1，随后把整层楼收起来、换一批地点继续下潜。
// 深度 5+ 且剧本模式 → 结局 2（联结点近在眼前）。
function descend(state, api) {
  const flags = flagsFor(state)
  const zones = zonesFor(state)
  const depth = behavior.incrementDepth(state, api)
  if (depth >= 5) {
    api.finish('r2')
    return
  }
  // 不位于幽嘶的阶梯的调查员被留在身后并击败。
  const stepsInPlay = state.locations.some(location => location.id === STEPS_OF_YOTH)
  for (const inv of active(state)) {
    if (stepsInPlay && inv.location === STEPS_OF_YOTH) continue
    api.info?.(`${inv.name} 没能跟上队伍，被留在了身后。`)
    api.defeat(inv, '留在了身后')
  }
  for (const inv of active(state)) inv.clues = 0
  // 场上所有敌人移进追击区域。
  zones.pursuit ||= []
  for (const enemy of [...state.enemies]) {
    zones.pursuit.push({
      code: enemy.code, damageTaken: enemy.damageTaken || 0, resources: enemy.harbingerResources || 0,
    })
    removeEnemyFromPlay(state, enemy)
  }
  // 地点上的毁灭标记全部移除。
  for (const location of state.locations) location.doom = 0
  // 场上与探索牌库里的地点全部放回一边。
  zones.locationPool ||= []
  for (const location of [...state.locations]) {
    zones.locationPool.push(location.id)
    api.remove(location.id)
  }
  for (const card of [...(state.explorationDeck || [])]) {
    if (state.scenario.locations?.[card]) zones.locationPool.push(card)
  }
  state.explorationDeck = []
  state.explorationDiscard ||= []
  // 随机一处放在一边的地点（幽嘶的阶梯除外）成为新的起始地点。
  const pool = zones.locationPool
  const options = pool.filter(id => id !== STEPS_OF_YOTH)
  const newStart = options.length ? pickAtRandom(state, api, options) : (pool.find(id => id === STEPS_OF_YOTH) || 'cavernsOfYoth')
  const startIndex = pool.indexOf(newStart)
  if (startIndex >= 0) pool.splice(startIndex, 1)
  api.place(newStart)
  api.reveal(newStart)
  for (const inv of active(state)) api.moveInvestigator(inv.seat, newStart)
  flags.depthStartLocation = newStart
  // 新的探索牌库：幽嘶的阶梯 + 随机 4 处地点。
  const others = pool.filter(id => id !== STEPS_OF_YOTH)
  const drawn = []
  while (drawn.length < 4 && others.length) {
    const id = pickAtRandom(state, api, others)
    others.splice(others.indexOf(id), 1)
    drawn.push(id)
  }
  for (const id of [...drawn, STEPS_OF_YOTH]) {
    const index = pool.indexOf(id)
    if (index >= 0) pool.splice(index, 1)
  }
  state.explorationDeck = mix(state, api, [STEPS_OF_YOTH, ...drawn])
  api.info?.(`你们下降到第 ${depth} 层：新的探索牌库有 ${state.explorationDeck.length} 张。`)
  // 04285 翻回正面：引擎在 reveal 之后会 actIndex + 1，这里回到 -1 让它留在同一张幕上。
  state.actIndex = -1
}
