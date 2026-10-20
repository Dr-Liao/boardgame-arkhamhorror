import { changeChaosBag } from '../../../../../src/engine/chaos-bag.js'
import { campaignCardChange } from '../../../../../src/campaign/campaign.js'
import { encounterRules } from '../../encounter-rules.js'
import { carcosaChaosToken } from '../../carcosa-chaos.js'

const ACTIVE_ACT_TWO = new Set(['03047a', '03047b', '03047c'])
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const here = (state, inv) => state.locations.find(location => location.id === inv.location)

export function setupPlan(state) {
  return {
    locations: ['theatre', 'lobby', 'balcony', 'backstage'],
    setAside: ['03053', '03054', '03055', '03056', '03057', '03058', '03059', '03060'],
    removed: [],
  }
}

function pickRandom(items, api) {
  if (!items.length) return null
  return items[Math.floor(api.random() * items.length)]
}

function removeEngagement(state, enemy) {
  if (enemy.engagedSeat != null) {
    const inv = state.investigators[enemy.engagedSeat]
    if (inv) inv.engaged = (inv.engaged || []).filter(id => id !== enemy.id)
  }
  enemy.engagedSeat = null
}

function addCampaignWeakness(state) {
  const seat = state.campaign.leadSeat ?? 0
  const record = state.campaign.investigators?.[seat]
  const deck = record?.deck || []
  if (!deck.includes('03059')) campaignCardChange(state.campaign, seat, '03059', 'add', 'curtainCall')
  if (record?.id) state.campaign.records.pallidMaskBearer = record.id
}

function triggerHazard(state, inv, difficulty, harm, api, key) {
  state.scenarioFlags.hazardTests ||= {}
  if (state.scenarioFlags.hazardTests[`${key}:${inv.seat}`] === state.round) return
  state.scenarioFlags.hazardTests[`${key}:${inv.seat}`] = state.round
  api.test(inv.seat, 'agility', difficulty, result => {
    if (result.success) return
    if (harm.damage) api.damage(inv.seat, harm.damage)
    if (harm.horror) api.horror(inv.seat, harm.horror)
  }, 0, { type: 'scenario', label: '谢幕灾害', code: key })
}

export const behavior = {
  ...encounterRules,
  id: 'curtainCall',
  setupPlan,

  setupLocations(state, events, api) {
    const actTwos = state.scenario.acts.filter(act => ACTIVE_ACT_TWO.has(act.originalCode))
    const selected = api.shuffle([...actTwos], () => api.randomValue(state))[0]
    state.acts = [
      structuredClone(state.scenario.acts.find(act => act.originalCode === '03046')),
      structuredClone(selected),
      structuredClone(state.scenario.acts.find(act => act.originalCode === '03048')),
    ]
    state.scenarioFlags = {
      actTwoCode: selected.originalCode,
      lobbyDoorways: ['lightingBox', 'boxOffice', 'greenRoom'],
      backstageDoorways: ['dressingRoom', 'rehearsalRoom', 'trapRoom'],
      stoleFromBoxOffice: false,
      boxOfficeUsed: false,
      hazardTests: {},
    }
    for (const inv of state.investigators) if (inv.code === '03006') inv.location = 'backstage'
    return setupPlan(state).locations
  },

  resolveChaosToken(state, inv, token, api) {
    if (!['skull', 'cultist', 'tablet', 'elderthing'].includes(token)) {
      return carcosaChaosToken('curtainCall', state, inv, token, api)
    }
    const hard = ['hard', 'expert'].includes(state.difficulty)
    if (token === 'skull') {
      return { delta: hard ? -Math.max(1, inv.horror) : inv.horror >= 3 ? -3 : -1 }
    }
    const location = here(state, inv)
    if (location) {
      if ((location.horror || 0) > 0) api.horror(inv.seat, 1)
      else location.horror = 1
    }
    return { delta: hard ? -5 : -4 }
  },

  locationRevealed(state, location, api) {
    let pool
    if (location.originalCode === '03050') pool = state.scenarioFlags.lobbyDoorways
    if (location.originalCode === '03052') pool = state.scenarioFlags.backstageDoorways
    if (pool) for (let count = 0; count < 2 && pool.length; count++) {
      const id = pickRandom(pool, api)
      pool.splice(pool.indexOf(id), 1)
      api.place(id)
    }
    if (location.originalCode !== '03058') return
    const copies = state.numInvestigators >= 3 ? 2 : 1
    for (let count = 0; count < copies; count++) {
      let found = false
      for (const pile of [state.encounterDeck, state.encounterDiscard]) {
        const index = pile.findIndex(code => code === 'swarmOfRats' || code === '01159')
        if (index < 0) continue
        const enemy = api.spawn(pile.splice(index, 1)[0], location.id)
        if (enemy) api.engage(enemy, state.currentSeat)
        found = true
        break
      }
      if (!found) break
    }
    api.shuffleEncounterDeck()
  },

  locationEntered(state, inv, location, api) {
    if (state.scenarioFlags.hazard === 'flames' && (location.horror || 0) > 0) {
      triggerHazard(state, inv, 3, { damage: 1 }, api, '03047a')
    }
  },

  locationLeft(state, inv, location, api) {
    encounterRules.locationLeft?.(state, inv, location, api)
    if (location.originalCode === '03051' && inv.location === 'theatre') api.damage(inv.seat, 2)
    if (state.scenarioFlags.hazard === 'ooze' && (location.horror || 0) > 0) {
      api.test(inv.seat, 'agility', 4, result => {
        if (!result.success) {
          api.damage(inv.seat, 1)
          api.horror(inv.seat, 1)
        }
      }, 0, { type: 'scenario', label: '膨胀的淤泥', code: '03047b' })
    }
  },

  locationLeaveTest(state, inv, location) {
    if (state.scenarioFlags.hazard !== 'flood' || !(location?.horror || 0)) return null
    state.scenarioFlags.floodTests ||= {}
    if (state.scenarioFlags.floodTests[inv.seat] === state.round) return null
    state.scenarioFlags.floodTests[inv.seat] = state.round
    return { skill: 'agility', difficulty: 2 }
  },

  locationLeaveFailed(state, inv, location, api) {
    api.damage(inv.seat, 1)
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
    const location = here(state, inv)
    if (state.scenarioFlags.hazard === 'flames' && (location?.horror || 0) > 0) {
      triggerHazard(state, inv, 3, { damage: 1 }, api, '03047a')
    }
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    if (state.acts[state.actIndex]?.originalCode !== '03048') return
    const horrified = new Set(state.locations.filter(location => (location.horror || 0) > 0)
      .flatMap(location => location.connections || []))
    for (const location of state.locations) {
      if (!(location.horror || 0) && horrified.has(location.id)) location.horror = 1
    }
  },

  actReveal(state, act, api) {
    if (act.originalCode === '03046') {
      const pool = [...state.scenarioFlags.lobbyDoorways, ...state.scenarioFlags.backstageDoorways]
      const id = pickRandom(pool, api)
      if (!id) throw new Error('没有可用于生成苍白面具下的男子的放在一边地点')
      for (const key of ['lobbyDoorways', 'backstageDoorways']) {
        const index = state.scenarioFlags[key].indexOf(id)
        if (index >= 0) state.scenarioFlags[key].splice(index, 1)
      }
      api.place(id)
      api.spawn('03059', id)
    } else if (act.originalCode === '03048') {
      state.scenarioFlags.hazardTests = {}
    }
  },

  agendaReveal(state, agenda, api) {
    if (agenda.originalCode === '03044') {
      const victory = state.victoryDisplay.findIndex(card => (card.originalCode || card.code) === '03060')
      if (victory >= 0) state.victoryDisplay.splice(victory, 1)
      if (!state.enemies.some(enemy => enemy.code === '03060')) api.spawn('03060', 'theatre')
    } else if (agenda.originalCode === '03045') {
      for (const inv of active(state)) api.horror(inv.seat, 100)
      if (state.status === 'playing') api.finish('noResolution')
    }
  },

  enemyPhaseEnd(state, api) {
    for (const emissary of state.enemies.filter(enemy => enemy.code === '03060')) {
      const origin = state.locations.find(location => location.id === emissary.location)
      const affected = new Set([emissary.location, ...(origin?.connections || [])])
      for (const inv of active(state).filter(inv => affected.has(inv.location))) api.horror(inv.seat, 1)
    }
  },

  enemyDiscarded(state, enemy, api) {
    if ((enemy.originalCode || enemy.code) === '03059'
      && state.acts[state.actIndex]?.originalCode === '03047c') api.advanceAct()
  },

  enemyDefeated(state, enemy, api) {    if (enemy.code === '03060') {
      api.clearDoom()
      state.agendaIndex = 0
      state.doom = 3
      return false
    }
    if (enemy.code !== '03059') return encounterRules.enemyDefeated?.(state, enemy, api) || false
    if (!ACTIVE_ACT_TWO.has(state.acts[state.actIndex]?.originalCode)) {
      return encounterRules.enemyDefeated?.(state, enemy, api) || false
    }

    const origin = state.locations.find(location => location.id === enemy.location)
    const code = state.acts[state.actIndex].originalCode
    if (code === '03047a') {
      changeChaosBag(state, 'cultist', 2, { permanent: true })
      const theatre = state.locations.find(location => location.id === 'theatre')
      if (theatre) theatre.horror = (theatre.horror || 0) + 1
      state.scenarioFlags.hazard = 'flames'
    } else if (code === '03047b') {
      changeChaosBag(state, 'tablet', 2, { permanent: true })
      if (origin) origin.horror = (origin.horror || 0) + 1
      state.scenarioFlags.hazard = 'ooze'
    } else {
      changeChaosBag(state, 'elderthing', 2, { permanent: true })
      for (const location of state.locations) {
        if (location.traits?.includes('Private')) location.horror = (location.horror || 0) + 1
      }
      state.scenarioFlags.hazard = 'flood'
    }
    removeEngagement(state, enemy)
    enemy.damageTaken = 0
    enemy.location = 'lobby'
    enemy.exhausted = false
    api.advanceAct()
    return true
  },

  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    if (result.success && result.value - result.difficulty >= 2
      && result.source?.code === '03057') api.horror(inv.seat, 1)
  },

  actions(state, inv) {
    const moves = []
    const location = here(state, inv)
    if (!location) return moves
    if (location.originalCode === '03050') {
      moves.push({ action: 'scenarioAction', rule: 'lobbyDraw', actions: 2, label: '花费2行动，抽取3张牌' })
    }
    if (location.originalCode === '03054' && !state.scenarioFlags.boxOfficeUsed) {
      moves.push({ action: 'scenarioAction', rule: 'stealBoxOffice', label: '从售票处取得5资源' })
    }
    if (location.originalCode === '03055') {
      moves.push({ action: 'scenarioAction', rule: 'greenRoomInvestigate', label: '调查演员休息室（本次智识+3，之后弃掉全部手牌）' })
    }
    if (location.originalCode === '03056') {
      // 化妆间能力一直登记，只差"身上还有恐惧"这个能被治愈改变的条件。
      moves.push({ action: 'scenarioAction', rule: 'dressingRoomHeal', actions: 3,
        label: '花费3行动，治愈3点恐惧',
        reason: inv.horror > 0 ? null : '没有需要治愈的恐惧' })
    }
    if (state.acts[state.actIndex]?.originalCode === '03048' && location.id === 'lobby') {
      const stranger = state.enemies.some(enemy => enemy.code === '03059')
      moves.push({ action: 'scenarioAction', rule: 'escapeTheatre', label: '撤退：逃离剧院',
        reason: stranger ? '「苍白面具下的男子」还在场上，需要先解决他' : null })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    const location = here(state, inv)
    if (move.rule === 'lobbyDraw') api.drawCards(inv.seat, 3)
    else if (move.rule === 'stealBoxOffice') {
      if (state.scenarioFlags.boxOfficeUsed) throw new Error('本场游戏已从售票处取过资源')
      state.scenarioFlags.boxOfficeUsed = true
      state.scenarioFlags.stoleFromBoxOffice = true
      inv.resources += 5
    } else if (move.rule === 'greenRoomInvestigate') {
      api.test(inv.seat, 'intellect', (location.shroud || 0) + (location.shroudMod || 0), result => {
        if (result.success && location.clues > 0) {
          location.clues--
          api.gainClues(inv.seat, 1)
        }
        inv.discard.push(...inv.hand.splice(0))
      }, 3, { type: 'scenario', label: '调查', code: '03055' })
    } else if (move.rule === 'dressingRoomHeal') inv.horror = Math.max(0, inv.horror - 3)
    else if (move.rule === 'escapeTheatre') api.resign(inv.seat)
    else throw new Error(`未知谢幕行动：${move.rule}`)
  },

  allResigned(state, api) {
    if (state.acts[state.actIndex]?.originalCode !== '03048') return
    const choice = api.choose({
      kind: 'resolution',
      source: '03048',
      seat: state.campaign.leadSeat ?? 0,
      prompt: '逃离剧院后，你们要去警局示警吗？',
      options: [
        { id: 'r1', label: '前往警局，提醒警方' },
        { id: 'r2', label: '警方不会相信我们，独自调查' },
      ],
    })
    api.finish(choice)
  },

  resolution(state, key) {
    if (!['noResolution', 'r1', 'r2'].includes(key)) throw new Error('未知谢幕结局')
    const records = state.campaign.records
    records.theStrangerIsOnToYou = true
    addCampaignWeakness(state)
    if (key === 'r1' || key === 'r2') {
      records.chasingTheStranger = Number(records.chasingTheStranger || 0) + 2
    }
    if (key === 'r1') {
      records.youTriedToWarnThePolice = true
      records.conviction = Number(records.conviction || 0) + 1
      if (state.scenarioFlags.stoleFromBoxOffice) records.thePoliceAreSuspiciousOfYou = true
    } else if (key === 'r2') {
      records.youChoseNotToGoToThePolice = true
      records.doubt = Number(records.doubt || 0) + 1
    }
    return { award: true }
  },
}
