import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { agendaRuleFor } from '../../../../../src/cards/card-rules.js'
import { encounterRules } from '../../encounter-rules.js'
import { carcosaChaosToken } from '../../carcosa-chaos.js'

const GUESTS = ['03076a', '03077', '03078', '03079', '03080']
const REALITIES = {
  '03065': { guest: '03076a', enemy: '03065b' },
  '03066': { guest: '03077', enemy: '03066b' },
  '03067': { guest: '03078', enemy: '03067b' },
  '03068': { guest: '03079', enemy: '03068b' },
  '03069': { guest: '03080', enemy: '03069b' },
}
const INTERVIEW_RECORD = {
  '03076a': '03076a',
  '03077': '03077',
  '03078': '03078',
  '03079': '03079',
  '03080': '03080',
}
const SLAIN_RECORD = {
  '03065b': '03065',
  '03066b': '03066',
  '03067b': '03067',
  '03068b': '03068',
  '03069b': '03069',
}
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const possessed = enemy => enemy.traits?.some(trait => trait === 'Possessed' || trait === '附身')

export function setupPlan() {
  return {
    locations: ['foyer', 'courtyard', 'livingRoom', 'ballroom', 'diningRoom', 'gallery'],
    setAside: ['03081', '03065', '03066', '03067', '03068', '03069'],
    removed: [],
  }
}

function pickChoice(items, state, api, source, prompt) {
  if (!items.length) return null
  if (items.length === 1) return items[0]
  const id = api.choose({
    kind: 'target',
    source,
    seat: state.campaign.leadSeat ?? 0,
    prompt,
    options: items.map(item => ({
      id: item.id || item.code,
      label: item.name || item.id || item.code,
    })),
  })
  return items.find(item => (item.id || item.code) === id)
}

function resetSymbolTokens(state) {
  const symbols = new Set(['cultist', 'tablet', 'elderthing'])
  state.chaosBag = state.chaosBag.filter(token => !symbols.has(token))
  state.chaosBag.push('cultist', 'tablet', 'elderthing')
  state.campaign.chaosBag = state.campaign.chaosBag.filter(token => !symbols.has(token))
  state.campaign.chaosBag.push('cultist', 'tablet', 'elderthing')
}

function transformGuest(state, realityCode, api) {
  const identity = REALITIES[realityCode]
  if (!identity) throw new Error(`未知令人作呕的现实：${realityCode}`)
  const guest = state.storyAssets.find(asset => asset.code === identity.guest)
  if (!guest) return
  const location = state.locations.find(candidate => candidate.id === guest.location)
  for (const inv of active(state).filter(inv => inv.location === guest.location)) api.horror(inv.seat, 1)
  if (location) location.clues = (location.clues || 0) + (guest.clues || 0)
  state.storyAssets.splice(state.storyAssets.indexOf(guest), 1)
  state.scenarioZones.removed ||= []
  state.scenarioZones.removed.push(identity.guest)
  api.spawn(identity.enemy, guest.location)
}

function finishInterview(state, guest, api) {
  state.scenarioFlags.interviewed ||= []
  if (!state.scenarioFlags.interviewed.includes(guest.code)) {
    state.scenarioFlags.interviewed.push(guest.code)
  }
  api.cardFlip(guest.code, '会谈完成 · 翻牌结算')
}

function afterParley(state, inv, api) {
  const location = here(state, inv)
  const phaseKey = `${state.round}:${state.phase}`
  if (location?.originalCode === '03071' && state.scenarioFlags.ballroomReaction !== phaseKey) {
    state.scenarioFlags.ballroomReaction = phaseKey
    inv.resources += 2
  }
  if (location?.originalCode === '03072' && state.scenarioFlags.livingRoomReaction !== phaseKey) {
    state.scenarioFlags.livingRoomReaction = phaseKey
    api.drawCards(inv.seat, 1)
  }
}

export const behavior = {
  ...encounterRules,
  id: 'theLastKing',
  setupPlan,

  setupLocations(state, events, api) {
    const destinations = api.shuffle(
      ['courtyard', 'livingRoom', 'ballroom', 'diningRoom', 'gallery'],
      () => api.randomValue(state),
    )
    const guests = api.shuffle([...GUESTS], () => api.randomValue(state))
    state.scenarioFlags = {
      interviewed: [],
      toughCrowd: [],
      ballroomReaction: null,
      livingRoomReaction: null,
      guestPlacements: guests.map((code, index) => ({ code, location: destinations[index] })),
    }
    state.scenarioZones.sickeningReality = [...state.scenario.sickeningRealityCards]
    return setupPlan().locations
  },

  setupEnemies(state) {
    state.storyAssets = state.scenarioFlags.guestPlacements.map(({ code, location }) => ({
      ...structuredClone(state.scenario.storyAssets[code]),
      id: `last-king-guest-${code}`,
      code,
      location,
      controllerSeat: null,
      clues: state.numInvestigators + 1,
      exhausted: false,
    }))
  },

  resolveChaosToken(state, inv, token, api) {
    if (!['skull', 'cultist', 'tablet', 'elderthing'].includes(token)) {
      return carcosaChaosToken('theLastKing', state, inv, token, api)
    }
    const hard = ['hard', 'expert'].includes(state.difficulty)
    if (token === 'skull') return { delta: 0, drawAnother: true }
    if (token === 'cultist') {
      if (hard && inv.clues > 0) {
        api.spendClues(inv.seat, 1)
        const location = here(state, inv)
        if (location) location.clues = (location.clues || 0) + 1
      }
      return { delta: hard ? -3 : -2 }
    }
    if (token === 'tablet') {
      if (hard) api.horror(inv.seat, 1)
      return { delta: -4 }
    }
    return { delta: -(here(state, inv)?.shroud || 0) }
  },

  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    if (result.success) return
    const tokens = (result.drawn || []).filter(token => !result.cancelledTokens?.includes(token))
    const hard = ['hard', 'expert'].includes(state.difficulty)
    for (const token of tokens) {
      if (token === 'skull') {
        let candidates = state.enemies.filter(possessed)
        if (hard && candidates.length) {
          const max = Math.max(...candidates.map(enemy => (enemy.health || 0) - (enemy.damageTaken || 0)))
          candidates = candidates.filter(enemy => (enemy.health || 0) - (enemy.damageTaken || 0) === max)
        }
        const target = pickChoice(candidates, state, api, '03061-skull', '选择一个附身敌人放置1毁灭。')
        if (target) target.doom = (target.doom || 0) + 1
      } else if (token === 'cultist' && !hard && inv.clues > 0) {
        api.spendClues(inv.seat, 1)
        const location = here(state, inv)
        if (location) location.clues = (location.clues || 0) + 1
      } else if (token === 'tablet' && !hard) api.horror(inv.seat, 1)
      else if (token === 'elderthing' && hard) api.damage(inv.seat, 1)
    }
  },

  resolveEncounter(state, inv, card, api) {
    const code = card.originalCode || card.code
    if (code === '03082') {
      const bystanders = state.storyAssets.filter(asset => GUESTS.includes(asset.code))
      const options = [{ id: 'harm', label: '受到1点伤害和1点恐惧' }]
      if (inv.clues > 0 && bystanders.length) {
        options.unshift(...bystanders.map(asset => ({
          id: asset.id,
          label: `将1个线索放到${asset.name}`,
        })))
      }
      const choice = options.length === 1 ? 'harm' : api.choose({
        kind: 'target', source: code, seat: inv.seat,
        prompt: '盛宴：选择将线索放到一名旁人上，或受到伤害和恐惧。',
        options,
      })
      if (choice === 'harm') {
        api.damage(inv.seat, 1)
        api.horror(inv.seat, 1)
      } else {
        const guest = bystanders.find(asset => asset.id === choice)
        if (guest) {
          api.spendClues(inv.seat, 1)
          guest.clues = (guest.clues || 0) + 1
        }
      }
      return false
    }
    if (code === '03083') {
      state.scenarioFlags.toughCrowd.push(code)
      return true
    }
    return encounterRules.resolveEncounter(state, inv, card, api)
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    if (state.scenarioFlags.toughCrowd.length) {
      state.encounterDiscard.push(...state.scenarioFlags.toughCrowd.splice(0))
    }
  },

  locationEntered(state, inv, location, api) {
    if (location.originalCode !== '03074' || !state.encounterDeck.length) return
    const code = state.encounterDeck.pop()
    if (ALL_CARDS[code]?.type === 'enemy') {
      const enemy = api.spawn(code, location.id)
      if (enemy) api.engage(enemy, inv.seat)
    } else state.encounterDiscard.push(code)
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
    if (here(state, inv)?.originalCode !== '03073') return
    api.test(inv.seat, 'willpower', 2, result => {
      if (result.success || inv.clues <= 0) return
      api.spendClues(inv.seat, 1)
      const location = here(state, inv)
      if (location) location.clues = (location.clues || 0) + 1
    }, 0, { type: 'scenario', label: '画廊', code: '03073' })
  },

  agendaReveal(state, agenda, api) {
    agendaRuleFor(agenda.originalCode)?.onReveal?.(state, agenda, api)
  },

  agendaWouldAdvance(state, api) {
    if (state.agendas[state.agendaIndex]?.originalCode !== '03063') return false
    api.cardReveal('03063', '密谋强制效果')
    api.clearDoom()
    const realities = state.scenarioZones.sickeningReality || []
    if (!realities.length) {
      api.advanceAgenda()
      return true
    }
    const index = Math.floor(api.random() * realities.length)
    const code = realities.splice(index, 1)[0]
    api.cardReveal(code, '令人作呕的现实')
    transformGuest(state, code, api)
    return true
  },

  enemyPhaseStart(state, api) {
    for (const jordan of state.enemies.filter(enemy => enemy.code === '03066b')) {
      jordan.damageTaken = Math.max(0, (jordan.damageTaken || 0) - 1)
    }
    for (const dianne of state.enemies.filter(enemy => enemy.code === '03081')) {
      if (!state.storyAssets.length) continue
      const fewest = Math.min(...state.storyAssets.map(asset => asset.clues || 0))
      const locations = [...new Set(state.storyAssets
        .filter(asset => (asset.clues || 0) === fewest).map(asset => asset.location))]
        .map(id => state.locations.find(location => location.id === id)).filter(Boolean)
      const target = pickChoice(locations, state, api, '03081', '选择黛安娜·迪瓦恩要移动到的地点。')
      if (target) api.moveEnemy(dianne, target.id)
    }
  },

  enemyStatModifier(state, enemy, stat) {
    const shared = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    if (enemy.code === '03065b' && enemy.exhausted && stat === 'fight') return shared + 3
    return shared
  },

  skipUpkeepDraw(state, inv) {
    return state.enemies.some(enemy => enemy.code === '03069b' && enemy.location === inv.location)
  },

  canDiscoverClues(state, inv) {
    return !state.enemies.some(enemy => enemy.code === '03081' && enemy.location === inv.location)
  },

  actions(state, inv) {
    const moves = []
    const location = here(state, inv)
    if (!location) return moves
    const extra = state.scenarioFlags.toughCrowd.length
    if (location.originalCode === '03070') {
      moves.push({ action: 'scenarioAction', rule: 'leaveParty', label: '撤退：带着已找到的情报离开庄园' })
    }
    if (location.originalCode === '03075') {
      moves.push({ action: 'scenarioAction', rule: 'diningRoomHeal', label: '治愈1点恐惧并揭示一个混乱标记',
        reason: inv.horror > 0 ? null : '没有需要治愈的恐惧' })
    }
    // 黛安娜在场会打断一切会谈：贵宾仍留在桌上，只是此刻谈不了。
    const dianne = state.enemies.some(enemy => enemy.code === '03081' && enemy.location === inv.location)
    for (const guest of state.storyAssets.filter(asset => asset.location === inv.location && (asset.clues || 0) > 0)) {
      const common = {
        action: 'scenarioAction',
        actionKind: 'parley',
        rule: 'interviewGuest',
        guestId: guest.id,
        actions: (guest.code === '03080' ? 2 : 1) + extra,
      }
      const shortfall = guest.code === '03077'
        ? inv.resources < 10 ? `需要 10 个资源（当前 ${inv.resources}）` : null
        : guest.code === '03078'
          ? inv.hand.length < 6 ? `需要 6 张手牌（当前 ${inv.hand.length}）` : null
          : null
      const reason = dianne ? '同地点有「黛安娜·迪瓦恩」，需要先摆脱她' : shortfall
      if (guest.code === '03076a') moves.push({ ...common, skill: 'intellect', difficulty: 3, label: '与康斯坦丝谈判（智识3）', reason })
      else if (guest.code === '03077') moves.push({ ...common, skill: 'intellect', difficulty: 2, label: '与乔丹谈判（需10资源，智识2）', reason })
      else if (guest.code === '03078') moves.push({ ...common, skill: 'willpower', difficulty: 2, label: '与春子谈判（需6张手牌，意志2）', reason })
      else if (guest.code === '03079') moves.push({ ...common, skill: 'willpower', difficulty: 3, label: '与塞巴斯蒂安谈判（意志3）', reason })
      else if (guest.code === '03080') moves.push({ ...common, label: '聆听阿什莉演唱，取得1个线索', reason })
    }
    return moves
  },

  investigatorEliminated(state, inv, clues) {
    const amount = Number(clues || 0)
    if (amount > 0) {
      state.actClues = Number(state.actClues || 0) + amount
      inv.clues = 0
      state.clues = state.investigators.reduce((sum, investigator) => sum + (investigator.clues || 0), 0)
    }
    return true
  },
  performAction(state, inv, move, api) {
    if (move.rule === 'leaveParty') {
      state.actClues = Number(state.actClues || 0) + inv.clues
      api.spendClues(inv.seat, inv.clues)
      api.resign(inv.seat)
    } else if (move.rule === 'diningRoomHeal') {
      inv.horror = Math.max(0, inv.horror - 1)
      const token = api.revealToken()
      if (['skull', 'autofail'].includes(token)) {
        api.horror(inv.seat, 1)
        const location = here(state, inv)
        if (location) location.doom = (location.doom || 0) + 1
      }
    } else if (move.rule === 'interviewGuest') {
      const guest = state.storyAssets.find(asset => asset.id === move.guestId
        && asset.location === inv.location && (asset.clues || 0) > 0)
      if (!guest) throw new Error('没有合法的贵宾会谈目标')
      const succeed = () => {
        guest.clues--
        api.gainClues(inv.seat, 1)
        if (guest.clues === 0) finishInterview(state, guest, api)
        afterParley(state, inv, api)
      }
      if (guest.code === '03080') succeed()
      else api.test(inv.seat, move.skill, move.difficulty, result => {
        if (result.success) succeed()
        else afterParley(state, inv, api)
      }, 0, { type: 'scenario', label: '谈判', code: guest.code })
    } else throw new Error(`未知最后的王者行动：${move.rule}`)
  },

  allResigned(state, api) {
    api.finish(state.investigators.some(inv => inv.resigned) ? 'r1' : 'r2')
  },

  storyResolutionKey(state, key) {
    return key === 'noResolution'
      ? state.investigators.some(inv => inv.resigned) ? 'r1' : 'r2'
      : key
  },

  resolution(state, key) {
    if (!['noResolution', 'r1', 'r2', 'r3'].includes(key)) throw new Error('未知最后的王者结局')
    const effective = key === 'noResolution'
      ? state.investigators.some(inv => inv.resigned) ? 'r1' : 'r2'
      : key
    const records = state.campaign.records
    const interviewed = (state.scenarioFlags.interviewed || []).map(code => INTERVIEW_RECORD[code])
    const previous = new Set(records.vipsInterviewed || [])
    for (const code of interviewed) previous.add(code)
    if (effective === 'r3') for (const code of interviewed) previous.delete(code)
    records.vipsInterviewed = [...previous]

    const slain = state.victoryDisplay
      .map(card => card.originalCode || card.code)
      .filter(code => ['03065b', '03066b', '03067b', '03068b', '03069b'].includes(code))
      .map(code => SLAIN_RECORD[code])
    records.vipsSlain = [...new Set([...(records.vipsSlain || []), ...slain])]
    if (['r2', 'r3'].includes(effective)) resetSymbolTokens(state)

    const investigators = Math.max(1, state.investigators.length)
    const extra = Math.floor(Number(state.actClues || 0) / 2)
    const base = Math.floor(extra / investigators)
    const remainder = extra % investigators
    return {
      award: true,
      seatBonus: seat => base + Number(seat < remainder),
    }
  },
}
