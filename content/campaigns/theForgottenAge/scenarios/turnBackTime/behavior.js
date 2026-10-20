import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterRules } from '../../encounter-rules.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../../tfa-chaos.js'
import { syncSymbolConnections } from '../../card-data.js'
import {
  EXPLORATION_LOCATIONS, EXPLORATION_TREACHERIES,
  RELIC_OF_AGES, HARBINGER_OF_VALUSIA, YIG, CHAMBER_OF_TIME,
} from './definition.js'

// 本章实际结算了印刷效果的敌人/诡计原卡号（含复用的遭遇组）。
// 04062 只做到近似（缺少「横置时也能反击」），故不列入。
export const implementedEncounterCodes = [
  '01167', '01168',
  '04062', '04083', '04084', '04085', '04088', '04089', '04090', '04091', '04092', '04093',
  '04094', '04098', '04099', '04100', '04101', '04102',
  '04296',
]

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => (state.campaign.records ||= {})
const original = card => card?.originalCode || card?.code
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const traits = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
const hasTrait = (card, trait) => traits(card).includes(trait)
const SERPENT = 'Serpent'

function shuffleWith(list, helper, state) {
  if (helper?.shuffle && helper?.randomValue) return helper.shuffle([...list], () => helper.randomValue(state))
  const copy = [...list]
  const rng = typeof helper?.randomValue === 'function' ? () => helper.randomValue(state) : () => 0
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(rng() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

function shuffleDeck(state, api) {
  const rng = typeof api?.random === 'function' ? api.random : () => 0
  const copy = [...(state.explorationDeck || [])]
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(rng() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  state.explorationDeck = copy
  return copy
}

// 4 张「中毒」中已经进入牌组/威胁区的部分不再放在一边（Haskell getSetAsidePoisonedCount）。
function setAsidePoisonCount(state) {
  let owned = 0
  for (const inv of state.investigators || []) {
    owned += (inv.threat || []).filter(card => original(card) === '04102').length
  }
  for (const record of Object.values(state.campaign?.investigators || {})) {
    owned += (record?.deck || []).filter(code => code === '04102').length
  }
  return Math.max(0, 4 - owned)
}

function placeDoom(location, amount = 1) {
  if (!location) return 0
  location.doom = (location.doom || 0) + amount
  return location.doom
}

// 「将一个线索翻至毁灭标记面」：线索离开地点，改为毁灭标记。
function flipClueToDoom(location, api) {
  if (!location || !(location.clues > 0)) return false
  location.clues -= 1
  placeDoom(location)
  api?.info?.(`🌑 「${location.name}」的 1 个线索被翻至毁灭标记面。`)
  return true
}

function addActToVictory(state, act) {
  const code = original(act)
  state.victoryDisplay ||= []
  if (state.victoryDisplay.some(card => card.id === act.id)) return
  state.victoryDisplay.push({ id: act.id, code, originalCode: code, victory: 0, vengeance: 2 })
}

function setAsideList(state) {
  state.scenarioZones ||= {}
  state.scenarioZones.setAside ||= []
  return state.scenarioZones.setAside
}

function removeSetAside(state, code) {
  const list = setAsideList(state)
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
}

function buffSerpentsAtYig(state) {
  const yig = state.enemies.find(enemy => original(enemy) === YIG)
  if (!yig) return
  for (const enemy of state.enemies) {
    if (enemy.id === yig.id || enemy.location !== yig.location) continue
    if (!hasTrait(enemy, SERPENT)) continue
    enemy.alert = true
    enemy.retaliate = true
  }
}

// 时间石室入场：附属放在一边的古代遗物，并在其上放置 1 个毁灭标记。
function prepareChamberOfTime(state, loc, api) {
  state.scenarioFlags ||= {}
  if (state.scenarioFlags.chamberOfTimePrepared) return false
  state.scenarioFlags.chamberOfTimePrepared = true
  removeSetAside(state, RELIC_OF_AGES)
  if (api?.moveRelicOfAges) api.moveRelicOfAges({ code: RELIC_OF_AGES, location: loc.id })
  else state.relicOfAges = { code: RELIC_OF_AGES, location: loc.id, seat: null }
  placeDoom(loc)
  api?.info?.(`🏺 「${loc.name}」入场：古代遗物附属到此地点，并放置 1 个毁灭标记。`)
  return true
}

// 瓦卢西亚的预示者：「攻击或躲避成功后放 1 资源；2×人数资源时带着伤害放在一边」。

export function setupPlan(state, helper = {}) {
  const locations = [...EXPLORATION_LOCATIONS]
  const treacheries = Object.values(EXPLORATION_TREACHERIES)
  return {
    explorationDeck: shuffleWith([...locations, ...treacheries], helper, state),
    locations,
    treacheries,
  }
}

export const behavior = {
  ...encounterRules,
  id: 'turnBackTime',
  implementedEncounterCodes,

  setupPlan,

  setupLocations(state, events, helper = {}) {
    const plan = setupPlan(state, helper)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [
      RELIC_OF_AGES, HARBINGER_OF_VALUSIA, YIG,
      ...Array(setAsidePoisonCount(state)).fill('04102'),
    ]
    state.scenarioZones.removed = []
    state.scenarioZones.setAsideLocations = [CHAMBER_OF_TIME]
    state.scenarioZones.explorationLocations = [...plan.locations]
    state.explorationDeck = [...plan.explorationDeck]
    state.explorationDiscard = []
    state.scenarioFlags ||= {}
    Object.assign(state.scenarioFlags, {
      chamberOfTimePrepared: false,
      harbingerDamage: 0,
      harbingerResources: 0,
    })
    // 两张密谋都印着「本密谋得到 +1[每名调查员]毁灭阀值」。
    if (!state.scenarioFlags.agendaThresholdApplied) {
      state.scenarioFlags.agendaThresholdApplied = true
      for (const agenda of state.agendas || []) {
        agenda.doomThreshold = (agenda.doomThreshold || 0) + state.numInvestigators
      }
    }
    return ['entryway']
  },

  setupEnemies() {
    // 开场只有遗迹入口；时间石室、古代遗物、预示者与伊格都在一边。
  },

  afterChaosBagSetup(state) {
    // Haskell setup: addChaosToken ElderThing（只在本次冒险生效）。
    state.chaosBag ||= []
    state.chaosBag.push('elderthing')
  },

  preScenarioSetup(state, events, api) {
    const records = recordsFor(state)
    const say = text => api?.info?.(text)
    // 剧本导入前的两条分支：上一章是否清出道路 / 是否在等待补给。
    if (records.theInvestigatorsWereForcedToWaitForAdditionalSupplies) {
      // Haskell：crossOut . drop 3 . campaignLogOrderedKeys —— 保留最上面三条记录，
      // 其余全部划掉（划掉的记录对后续逻辑等同于不存在）。
      const keys = Object.keys(records)
      const crossed = keys.slice(3)
      state.campaign.crossedRecordEntries = [
        ...(state.campaign.crossedRecordEntries || []),
        ...crossed.map(key => ({ key, value: records[key] })),
      ]
      state.campaign.crossedRecords = [...new Set([
        ...(state.campaign.crossedRecords || []), ...crossed,
      ])]
      for (const key of crossed) delete records[key]
      say(`📖 导入：你们不得不等待额外补给——剧本日志只保留最上面三条记录，其余 ${crossed.length} 条被划掉。`)
    } else if (records.theInvestigatorsClearedAPathToTheEztliRuins) {
      say('📖 导入：亚历山卓的队伍已经清出一条通往埃兹特里遗迹的道路。')
    }
    if (records.theInvestigatorsRecruitedTheHelpOfAnotherExpedition) {
      say('📖 导入：另一支探险队的补给堆在神庙前的空地上。')
    }
    if (records.theInvestigatorsTurnedBackTime) {
      say('📖 导入：你们已经改写了命运，但真正的任务仍等待着你们完成。')
    }
    if (records.theInvestigatorsFellIntoTheDepths) {
      say('📖 导入：你们从幽嘶深渊爬了回来，黑暗仍在彼此之间徘徊。')
    } else if (records.theNexusIsNear) {
      say('📖 导入：联结点近在咫尺。')
    }
    if (records.theBraziersAreLit) say('📖 导入：火盆被点燃，伊塔卡的人看见了你们的位置。')
    else if (records.theBraziersRemainUnlit) say('📖 导入：火盆始终没有点亮，遗迹比记忆里更暗。')
    const fury = api?.yigsFury?.() ?? Number(records.yigsFury || 0)
    if (fury > 0) say(`🐍 伊格之怒累计 ${fury} 点。`)
  },

  canExplore(state, inv) {
    return encounterRules.canExplore(state, inv)
  },

  afterExplore(state, inv, context) {
    syncSymbolConnections(state)
    const api = context?.runtime
    inv.tfaExploredThisTurn = true
    if (context?.kind !== 'location') return
    if (context?.code === 'burialPit') {
      // 坑葬墓室：探索成功并入场后，抽 2 张遭遇牌或放置 2 个毁灭（可任意组合）。
      const pit = state.locations.find(entry => original(entry) === '04065')
      if (!pit) return
      for (let point = 0; point < 2; point++) {
        const answer = api?.choose ? api.choose({
          kind: 'location', source: '04065', seat: inv.seat,
          prompt: `坑葬墓室（${point + 1}/2）：抽取 1 张遭遇牌，还是放置 1 个毁灭标记？`,
          options: [{ id: 'draw', label: '从遭遇牌库顶抽 1 张' }, { id: 'doom', label: '在坑葬墓室上放置 1 个毁灭' }],
        }) : 'doom'
        if (answer === 'draw') api?.drawEncounter?.(inv.seat)
        else placeDoom(pit)
      }
    }
  },

  locationRevealed(state, location, api) {
    if (original(location) === '04068') prepareChamberOfTime(state, location, api)
  },

  locationEntered(state, inv, location, api) {
    if (!location || original(location) !== '04067') return
    // 秘密通道：进入后受到 1 点恐惧和 1 点伤害，或在秘道上放置 1 个毁灭；有绳索则忽略。
    if (api?.checkSupplies?.(inv.seat, 'rope')) {
      api.info?.('🪢 你们有绳索，秘密通道的效果被忽略。')
      return
    }
    const answer = api?.choose ? api.choose({
      kind: 'location', source: '04067', seat: inv.seat,
      prompt: '秘密通道：受到 1 点恐惧和 1 点伤害，还是在此放置 1 个毁灭标记？',
      options: [{ id: 'harm', label: '受到 1 点恐惧和 1 点伤害' }, { id: 'doom', label: '放置 1 个毁灭标记' }],
    }) : 'doom'
    if (answer === 'harm') {
      api?.horror?.(inv.seat, 1)
      api?.damage?.(inv.seat, 1)
    } else placeDoom(location)
  },

  afterTest(state, inv, result, api) {
    tfaChaosAfterTest('turnBackTime', state, inv, result, api)
    encounterRules.afterTest?.(state, inv, result, api)
    const investigating = result?.source?.label === '调查'
    const location = here(state, inv)
    // 华美石室：调查失败或未超过难度至少 2 点时，先把 1 个线索翻至毁灭标记面。
    if (investigating && original(location) === '04064') {
      const margin = result.success ? result.value - result.difficulty : 0
      if (!result.success || margin < 2) flipClueToDoom(location, api)
    }
    // 朦胧之雾（01168）的弃置由引擎在成功调查后统一处理（location.fog / fogCode）。
  },

  resolveChaosToken(state, inv, token, api) {
    return tfaChaosToken('turnBackTime', state, inv, token, api)
  },

  resolveEncounter(state, inv, t, api) {
    // 01167 地窖寒风 / 01168 朦胧之雾等核心遭遇卡由 encounterRules 统一处理（共享解析器）。
    return encounterRules.resolveEncounter(state, inv, t, api)
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    buffSerpentsAtYig(state)
  },

  enemyPhaseStart(state, api) {
    encounterRules.enemyPhaseStart?.(state, api)
    buffSerpentsAtYig(state)
  },

  // 伊格：所在地点有另一个处于重整状态的蛇族敌人时不能受到伤害。
  enemyDamageAllowed(state, enemy, source, seat) {
    if (encounterRules.enemyDamageAllowed(state, enemy, source, seat) === false) return false
    if (original(enemy) === YIG) {
      const blockers = state.enemies.filter(other => other.id !== enemy.id
        && other.location === enemy.location && !other.exhausted && hasTrait(other, SERPENT))
      if (blockers.length) return false
    }
    return true
  },

  // 04062 的强制由 encounter-rules 的共享钩子结算（跨章一致，P2）。
  enemyAttackedSuccessfully(state, inv, enemy, api) {
    return encounterRules.enemyAttackedSuccessfully?.(state, inv, enemy, api)
  },

  afterEvade(state, inv, enemy, result, api) {
    return encounterRules.afterEvade?.(state, inv, enemy, result, api)
  },

  enemyAttackResolved(state, enemy, inv, api) {
    encounterRules.enemyAttackResolved?.(state, enemy, inv, api)
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    // 古代石厅：一轮结束时把 1 个线索翻至毁灭；位于此处的调查员可以花费 3 资源取消。
    const hall = state.locations.find(location => original(location) === '04063')
    if (!hall || !(hall.clues > 0)) return
    const volunteers = active(state)
      .filter(inv => inv.location === hall.id && (inv.resources || 0) >= 3)
    let cancel = false
    if (volunteers.length && api?.choose) {
      cancel = api.choose({
        kind: 'location', source: '04063', seat: volunteers[0].seat, canSkip: true,
        prompt: '古代石厅：一位位于此处的调查员可以花费 3 资源，取消「翻线索为毁灭」。',
        options: [{ id: 'cancel', label: '花费 3 资源取消' }],
      }) === 'cancel'
    }
    if (cancel) {
      volunteers[0].resources -= 3
      api.info?.('💸 花费 3 资源，取消了古代石厅的毁灭。')
      return
    }
    flipClueToDoom(hall, api)
  },

  // 地下遗迹：有敌人离场时在上面放置 1 个毁灭标记。
  enemyMoved(state, enemy, previous, api) {
    const ruins = state.locations.find(location => original(location) === '04066')
    if (!ruins || previous !== ruins.id || enemy.location === ruins.id) return
    placeDoom(ruins)
    api?.info?.('🌑 敌人离开了地下遗迹：放置 1 个毁灭标记。')
  },

  enemyDefeated(state, enemy, api) {
    const ruins = state.locations.find(location => original(location) === '04066')
    if (ruins && enemy.location === ruins.id) placeDoom(ruins)
  },

  enemyDiscarded(state, enemy, api) {
    const ruins = state.locations.find(location => original(location) === '04066')
    if (ruins && enemy.location === ruins.id) placeDoom(ruins)
  },

  actions(state, inv) {
    const moves = []
    const location = here(state, inv)
    const code = original(location)
    if (code === '04060') {
      moves.push({ action: 'scenarioAction', rule: 'resignEntryway', label: '🚪 撤退：你暂时……逃出来了。' })
      moves.push({
        action: 'scenarioAction', rule: 'inspectSupplies',
        label: '🔦 检查补给品：查看探索牌库顶 2 张，弃掉其中的诡计后洗牌',
      })
    }
    const relic = (inv.assets || []).find(asset => original(asset) === RELIC_OF_AGES)
    const yig = state.enemies.find(enemy => original(enemy) === YIG)
    if (original(state.acts?.[state.actIndex]) === '04347') {
      moves.push({
        action: 'scenarioAction', rule: 'relicOfAgesStrike',
        label: '🏺 古代遗物：检定意志或智识(4)，成功翻 1 个线索为毁灭并对伊格造成 3 点伤害',
        reason: !relic ? '需要先控制古代遗物' : !yig ? '伊格尚未现身' : null,
      })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (move.rule === 'resignEntryway') {
      api.resign(inv.seat)
      return
    }
    if (move.rule === 'inspectSupplies') {
      if (!api.checkSupplies(inv.seat, 'torches')) {
        api.info?.('检查补给品：队伍中没有火把，这次行动没有效果。')
        return
      }
      const deck = state.explorationDeck || []
      const top = deck.slice(-2)
      if (!top.length) return
      state.explorationDeck = deck.slice(0, deck.length - top.length)
      state.explorationDiscard ||= []
      for (const entry of top) {
        if (ALL_CARDS[entry]?.type === 'treachery') state.explorationDiscard.push(entry)
        else state.explorationDeck.push(entry)
      }
      shuffleDeck(state, api)
      api.info?.('火把照亮了探索牌库顶：诡计被弃掉，其余卡牌洗回牌库。')
      return
    }
    if (move.rule === 'relicOfAgesStrike') {
      const yig = state.enemies.find(enemy => original(enemy) === YIG)
      if (!yig) { api.info?.('伊格不在场，古代遗物没有目标。'); return }
      const picked = api.choose ? api.choose({
        kind: 'skill', source: RELIC_OF_AGES, seat: inv.seat,
        prompt: '古代遗物：选择检定意志还是智识。',
        options: [{ id: 'willpower', label: '意志(4)' }, { id: 'intellect', label: '智识(4)' }],
      }) : 'willpower'
      const skill = ['willpower', 'intellect'].includes(picked) ? picked : 'willpower'
      api.test(inv.seat, skill, 4, result => {
        if (!result.success) return
        const users = active(state).filter(other => other.location === inv.location && (other.clues || 0) > 0)
        let flipped = false
        if (users.length) {
          const target = users.length === 1 ? users[0] : users.find(other =>
            String(other.seat) === String(api.choose({
              kind: 'investigator', source: RELIC_OF_AGES, seat: inv.seat,
              prompt: '选择一位位于此地点、控制线索的调查员。',
              options: users.map(other => ({ id: String(other.seat), label: other.name })),
            }))) || users[0]
          if (api.spendClues) api.spendClues(target.seat, 1)
          else target.clues -= 1
          placeDoom(here(state, inv) || here(state, target))
          flipped = true
        }
        if (flipped) api.info?.('🏺 1 个线索被翻至毁灭标记面。')
        if (api.damageEnemy) api.damageEnemy(yig.id, 3, inv.seat, RELIC_OF_AGES)
        else {
          yig.damageTaken = (yig.damageTaken || 0) + 3
          api.checkEnemyDefeat?.(yig)
        }
      })
      return
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知时间倒流行动：${move.rule}`)
  },

  actReveal(state, act, api) {
    const code = original(act)
    if (code === '04345') {
      // 背面：把放在一边的时间石室洗入探索牌库；本场景进胜利区并获得复仇 2。
      removeSetAsideLocation(state, CHAMBER_OF_TIME)
      if (api.addToExplorationDeck) api.addToExplorationDeck([CHAMBER_OF_TIME])
      else {
        state.explorationDeck = [...(state.explorationDeck || []), CHAMBER_OF_TIME]
        shuffleDeck(state, api)
      }
      state.scenarioFlags ||= {}
      state.scenarioFlags.chamberOfTimeInDeck = true
      addActToVictory(state, act)
      api.info?.('🧭 时间石室被洗入探索牌库。')
      return
    }
    if (code === '04346') {
      // 背面：选择时间石室的调查员控制古代遗物；伊格生成在时间石室；进胜利区并获得复仇 2。
      const chamber = state.locations.find(location => original(location) === '04068')
      const candidates = active(state).filter(inv => chamber && inv.location === chamber.id)
      let seat = null
      if (candidates.length === 1) seat = candidates[0].seat
      else if (candidates.length > 1) {
        seat = Number(api.choose({
          kind: 'investigator', source: '04346', seat: state.campaign.leadSeat,
          prompt: '选择一位位于时间石室的调查员控制古代遗物。',
          options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
        }))
        if (!Number.isInteger(seat)) seat = candidates[0].seat
      }
      if (seat == null) seat = state.campaign.leadSeat
      const holder = state.investigators[seat]
      if (holder) {
        removeSetAside(state, RELIC_OF_AGES)
        api.giveAsset?.(seat, RELIC_OF_AGES)
        if (api.moveRelicOfAges) api.moveRelicOfAges({ code: RELIC_OF_AGES, seat })
        else state.relicOfAges = { code: RELIC_OF_AGES, location: holder.location, seat }
        api.info?.(`🏺 ${holder.name} 控制了古代遗物。`)
      }
      removeSetAside(state, YIG)
      const spawnAt = chamber?.id || CHAMBER_OF_TIME
      const yig = api.spawn(YIG, spawnAt)
      if (yig) {
        yig.damageTaken = 0
        api.info?.(`🐍 伊格在「${yig.location}」现身！`)
      }
      addActToVictory(state, act)
      return
    }
    if (code === '04347') { api.finish('r1'); return }
    throw new Error(`未知时间倒流场景：${code}`)
  },

  agendaReveal(state, agenda, api) {
    const code = original(agenda)
    if (code === '04055') {
      // 背面：把放在一边的瓦卢西亚的预示者生成在毁灭标记最多的地点。
      removeSetAside(state, HARBINGER_OF_VALUSIA)
      const candidates = [...state.locations].sort((left, right) =>
        (right.doom || 0) - (left.doom || 0))
      const target = candidates[0]?.id
      if (!target) return
      const enemy = api.spawn(HARBINGER_OF_VALUSIA, target)
      if (enemy) {
        enemy.damageTaken = Number(state.scenarioFlags?.harbingerDamage || 0)
        enemy.resources = 0
        api.info?.(`🐍 瓦卢西亚的预示者在「${enemy.location}」苏醒。`)
      }
      return
    }
    if (code === '04056') {
      // 背面：每位没有撤退的调查员被击败 → 无结局（时间之布被拆解）。
      for (const inv of active(state)) api.defeat(inv, null)
      if (state.status === 'playing') api.finish('noResolution')
      return
    }
    throw new Error(`未知时间倒流密谋：${code}`)
  },

  resolution(state, key, events, api) {
    if (!['noResolution', 'r1'].includes(key)) throw new Error('未知时间倒流结局')
    const records = recordsFor(state)
    if (key === 'noResolution') {
      records.theFabricOfTimeIsUnwoven = true
      for (const inv of state.investigators) {
        if (inv.defeated || inv.resigned) continue
        inv.defeated = true
        inv.defeatCause = 'mental'
        api?.addTrauma?.(state, inv.seat, 'mental', 1, events)
        api?.info?.(`💔 ${inv.name} 的时间线互相冲突，陷入疯狂。`)
      }
      return { award: false, bonus: 0 }
    }
    records.theInvestigatorsSealedTheRelicOfAgesForever = true
    return { award: true, bonus: 0 }
  },
}

function removeSetAsideLocation(state, id) {
  const list = state.scenarioZones?.setAsideLocations
  if (!Array.isArray(list)) return
  const index = list.indexOf(id)
  if (index >= 0) list.splice(index, 1)
}
