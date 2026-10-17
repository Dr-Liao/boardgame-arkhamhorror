import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { awardStoryCard } from '../../../../../src/campaign/campaign-effects.js'
import { campaignCardChange } from '../../../../../src/campaign/campaign.js'
import { requestChoice } from '../../../../../src/engine/resolution.js'
import { encounterRules } from '../../encounter-rules.js'
import { carcosaChaosToken, carcosaChaosAfterTest } from '../../carcosa-chaos.js'

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const original = card => card?.originalCode || card?.code
const hardSide = state => ['hard', 'expert'].includes(state.difficulty)
const historicalRooms = new Set(['03128', '03129', '03130', '03132', '03133', '03134', '03136', '03137', '03138'])
const symbolFamily = new Set(['cultist', 'tablet', 'elderthing'])

function shuffleWithSetup(state, values, api) {
  return api.shuffle([...values], () => api.randomValue(state))
}

function distance(state, start, target) {
  if (start === target) return 0
  const queue = [start]
  const seen = new Map([[start, 0]])
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]
    for (const next of state.locations.find(location => location.id === current)?.connections || []) {
      if (next === target) return seen.get(current) + 1
      if (!seen.has(next)) {
        seen.set(next, seen.get(current) + 1)
        queue.push(next)
      }
    }
  }
  return Infinity
}

function replaceSymbols(state, token) {
  const replace = bag => [...(bag || []).filter(face => !symbolFamily.has(face)), token, token]
  state.chaosBag = replace(state.chaosBag)
  state.campaign.chaosBag = replace(state.campaign.chaosBag)
}

function addVipSlain(state, code) {
  const slain = state.campaign.records.vipsSlain ||= []
  if (!slain.includes(code)) slain.push(code)
}

function awardRequiredStoryCard(state, code, reason, api = {}) {
  const candidates = Object.values(state.campaign.investigators)
    .filter(record => record.status === 'active' && !record.deck.includes(code))
  if (!candidates.length || Object.values(state.campaign.investigators).some(record => record.deck.includes(code))) return
  const request = {
    kind: 'storyCard', source: code, seat: state.campaign.leadSeat ?? candidates[0].seat,
    prompt: `选择一位调查员持有${ALL_CARDS[code].nameZh || ALL_CARDS[code].name}。`,
    options: candidates.map(record => ({ id: String(record.seat), label: record.name })),
  }
  const answer = candidates.length === 1 ? String(candidates[0].seat)
    : api.choose ? api.choose(request) : requestChoice(state, request)
  campaignCardChange(state.campaign, Number(answer), code, 'add', reason)
}

function awardOptionalStoryCard(state, code, reason, api = {}) {
  if (state._resolution) return awardStoryCard(state, code, reason)
  const candidates = Object.values(state.campaign.investigators)
    .filter(record => record.status === 'active' && !record.deck.includes(code))
  if (!candidates.length || !api.choose) return
  const answer = api.choose({
    kind: 'storyCard', source: code, seat: state.campaign.leadSeat ?? candidates[0].seat,
    prompt: `是否将${ALL_CARDS[code].nameZh || ALL_CARDS[code].name}加入牌组？`,
    options: [{ id: 'skip', label: '不加入' }, ...candidates.map(record => ({
      id: String(record.seat), label: record.name,
    }))],
  })
  if (answer !== 'skip') campaignCardChange(state.campaign, Number(answer), code, 'add', reason)
}

function placeDoomOnNearestEnemy(state, inv, api) {
  if (!state.enemies.length) return
  const nearestDistance = Math.min(...state.enemies.map(enemy => distance(state, inv.location, enemy.location)))
  const nearest = state.enemies.filter(enemy => distance(state, inv.location, enemy.location) === nearestDistance)
  const id = nearest.length === 1 ? nearest[0].id : api.choose({
    kind: 'target', source: '03120-cultist', seat: inv.seat,
    prompt: '选择一名最近的敌人，在其上放置 1 个毁灭标记。',
    options: nearest.map(enemy => ({ id: enemy.id, label: enemy.name })),
  })
  const enemy = nearest.find(candidate => candidate.id === id)
  if (enemy) enemy.doom = (enemy.doom || 0) + 1
}

function echoesChaosToken(state, inv, token, api) {
  if (!symbolFamily.has(token) && token !== 'skull') return carcosaChaosToken('echoesOfThePast', state, inv, token, api)
  const hard = hardSide(state)
  if (token === 'skull') {
    const doom = state.enemies.map(enemy => enemy.doom || 0)
    return { delta: -(hard ? doom.reduce((sum, value) => sum + value, 0) : Math.max(0, ...doom)) }
  }
  if (hard) {
    if (token === 'cultist') placeDoomOnNearestEnemy(state, inv, api)
    if (token === 'tablet') api.discardRandom(inv.seat, 1)
    if (token === 'elderthing' && state.enemies.some(enemy => enemy.location === inv.location)) api.horror(inv.seat, 1)
  }
  return { delta: hard ? -4 : -2 }
}

export function setupPlan(state) {
  const kept = state.scenarioFlags?.echoesFloors || state.scenario.floorPools
  return {
    locations: ['entryHall', 'quietHallsSecond', 'quietHallsThird', ...Object.values(kept).flat()],
    setAside: ['03139', '03140', '03141', '03142', '03143'],
    removed: state.scenarioZones?.removed || [],
  }
}

export const behavior = {
  ...encounterRules,
  id: 'echoesOfThePast',
  setupPlan,
  resolveChaosToken(state, inv, token, api) {
    return echoesChaosToken(state, inv, token, api)
  },
  setupLocations(state, _events, api) {
    state.scenarioFlags = { firstRoundBonus: !!state.campaign.records.youFledTheDinnerParty }
    state.scenarioZones.removed = []
    state.scenarioFlags.echoesFloors = {}
    for (const [floor, ids] of Object.entries(state.scenario.floorPools)) {
      const shuffled = shuffleWithSetup(state, ids, api)
      state.scenarioFlags.echoesFloors[floor] = shuffled.slice(0, 2)
      state.scenarioZones.removed.push(state.scenario.locations[shuffled[2]].originalCode)
    }
    const third = state.scenarioFlags.echoesFloors.third
    const candidates = state.numInvestigators < 4
      ? third : [...state.scenarioFlags.echoesFloors.second, ...third]
    state.scenarioFlags.seekerLocations = shuffleWithSetup(state, candidates, api)
    if ((state.campaign.records.vipsInterviewed || []).includes('03079')) {
      state.scenario.locations.entryHall.cluesFixed = state.numInvestigators
    }
    if (state.scenarioFlags.firstRoundBonus) {
      for (const inv of active(state)) inv.actionsLeft++
    }
    return setupPlan(state).locations
  },
  setupEnemies(state, _events, api) {
    const count = state.numInvestigators === 1 ? 0 : state.numInvestigators === 2 ? 1 : state.numInvestigators === 3 ? 2 : 3
    for (let i = 0; i < count; i++) api.spawnEnemy(state, '03144', state.scenarioFlags.seekerLocations[i], null)
  },
  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    const location = state.locations.find(candidate => candidate.id === enemy.location)
    if (location && historicalRooms.has(original(location)) && !location.revealed) api.reveal(location.id)
  },
  enemyDamaged(state, enemy) {
    if (enemy.code === '03140' && state.agendaIndex < 2) enemy.damageTaken = 0
  },
  enemyDefeated(state, enemy, api) {
    if (enemy.code === '03140') {
      if (!state.victoryDisplay.some(card => card.id === enemy.id)) state.victoryDisplay.push({
        ...structuredClone(enemy), originalCode: '03140', victory: 2,
      })
      api.finish('r3')
      return true
    }
    return encounterRules.enemyDefeated?.(state, enemy, api) || false
  },
  enemyPhaseStart(state, api) {
    for (const enemy of state.enemies.filter(candidate => candidate.code === '03140')) {
      if (!enemy.exhausted) enemy.doom = (enemy.doom || 0) + 1
      else {
        const answer = api.choose({
          kind: 'enemy', source: enemy.id, seat: state.campaign.leadSeat,
          prompt: '附身宣誓者：重整它，或在其上放置 1 个毁灭标记。',
          options: [{ id: 'ready', label: '重整附身宣誓者' }, { id: 'doom', label: '放置 1 毁灭' }],
        })
        if (answer === 'ready') enemy.exhausted = false
        else enemy.doom = (enemy.doom || 0) + 1
      }
    }
  },
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    for (const enemy of state.enemies.filter(candidate => candidate.code === '03144')) {
      const location = state.locations.find(candidate => candidate.id === enemy.location)
      if (location?.clues > 0) location.clues--
      enemy.doom = (enemy.doom || 0) + 1
    }
    const temporary = state.scenarioFlags.peabodyPassage
    if (temporary) {
      const location = state.locations.find(candidate => candidate.id === temporary)
      if (location) location.connections = location.connections.filter(id => !state.scenario.passagewayLocations.includes(id))
      delete state.scenarioFlags.peabodyPassage
    }
  },
  actReveal(state, act, api) {
    if (act.originalCode === '03124' || act.originalCode === '03125') {
      for (const location of state.locations.filter(candidate => candidate.revealed && historicalRooms.has(original(candidate)))) {
        location.clues = Math.max(location.clues || 0, state.numInvestigators)
      }
    }
    if (act.originalCode === '03125') {
      const candidates = active(state)
      const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choose({
        kind: 'storyAsset', source: '03141', seat: state.campaign.leadSeat,
        prompt: '选择一位调查员控制皮博迪先生。',
        options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
      }))
      api.giveAsset(seat, '03141')
      api.place('hiddenLibrary')
      this.connectPassageways(state)
    } else if (act.originalCode === '03126') {
      const answer = api.choose({
        kind: 'story', source: act.id, seat: state.campaign.leadSeat,
        prompt: '如何处置黑玛瑙扣环？',
        options: [{ id: 'r1', label: '拿走它' }, { id: 'r2', label: '留在原处' }],
      })
      api.finish(answer)
    }
  },
  connectPassageways(state) {
    const inPlay = state.scenario.passagewayLocations.filter(id => state.locations.some(location => location.id === id))
    for (const location of state.locations.filter(candidate => inPlay.includes(candidate.id))) {
      location.connections = [...new Set([...location.connections, ...inPlay.filter(id => id !== location.id)])]
    }
  },
  agendaReveal(state, agenda, api) {
    if (agenda.originalCode === '03121') api.shuffleDiscard()
    else if (agenda.originalCode === '03122') {
      api.spawn('03140', 'entryHall')
      if (!(state.campaign.records.vipsSlain || []).includes('03068')) api.spawn('03068b', 'entryHall')
    } else if (agenda.originalCode === '03123') api.finish('r4')
  },
  actions(state, inv) {
    const moves = []
    const location = state.locations.find(candidate => candidate.id === inv.location)
    const code = original(location)
    const meetingRoomKey = `meetingRoom:${inv.seat}`
    if (code === '03128' && location.clues > 0
      && state.scenarioFlags[meetingRoomKey] !== state.round
      && inv.assets.some(asset => !asset.exhausted
        && ALL_CARDS[asset.code]?.traits?.some(trait => trait.toLowerCase() === 'ally'))) {
      moves.push({ action: 'scenarioAction', rule: 'meetingRoomAlly',
        label: '横置一名盟友，在会议室发现1个线索' })
    }
    if (['03131', '03135'].includes(code)
      && state.locations.every(candidate => candidate.revealed)
      && state.locations.every(candidate => (candidate.clues || 0) === 0)) {
      moves.push({ action: 'scenarioAction', rule: 'restoreClues', label: '在宁静的走廊放置线索' })
    }
    if (code === '03134' && state.enemies.some(enemy => (enemy.doom || 0) > 0)) {
      moves.push({ action: 'scenarioAction', rule: 'readingRoom', label: '调查阅览室，将敌人上的毁灭转为线索' })
    }
    const peabody = inv.assets.find(asset => asset.code === '03141' && !asset.exhausted)
    if (peabody) moves.push({ action: 'scenarioAction', rule: 'peabodyPassage', label: '横置皮博迪先生，选择一个地点作为通道' })
    return moves
  },
  performAction(state, inv, move, api) {
    if (move.rule === 'meetingRoomAlly') {
      const location = state.locations.find(candidate => candidate.id === inv.location)
      const allies = inv.assets.filter(asset => !asset.exhausted
        && ALL_CARDS[asset.code]?.traits?.some(trait => trait.toLowerCase() === 'ally'))
      if (original(location) !== '03128' || !location.clues || !allies.length
        || state.scenarioFlags[`meetingRoom:${inv.seat}`] === state.round) {
        throw new Error('会议室能力当前不可用')
      }
      const id = allies.length === 1 ? allies[0].id : api.choose({
        kind: 'target', source: '03128', seat: inv.seat,
        prompt: '选择横置一名盟友支援。',
        options: allies.map(asset => ({
          id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || ALL_CARDS[asset.code]?.name || asset.code,
        })),
      })
      const ally = allies.find(asset => asset.id === id)
      if (!ally) throw new Error('必须选择一名可横置的盟友')
      ally.exhausted = true
      state.scenarioFlags[`meetingRoom:${inv.seat}`] = state.round
      location.clues--
      api.gainClues(inv.seat, 1)
    } else if (move.rule === 'restoreClues') {
      state.locations.find(location => location.id === inv.location).clues += state.numInvestigators
    } else if (move.rule === 'readingRoom') {
      const location = state.locations.find(candidate => candidate.id === inv.location)
      api.test(inv.seat, 'intellect', location.shroud + (location.shroudMod || 0), result => {
        if (!result.success) return
        const enemies = state.enemies.filter(enemy => (enemy.doom || 0) > 0)
        const id = enemies.length === 1 ? enemies[0].id : api.choose({
          kind: 'target', source: '03134', seat: inv.seat, prompt: '选择一名有毁灭的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(candidate => candidate.id === id)
        if (enemy) {
          enemy.doom--
          inv.clues++
        }
      })
    } else if (move.rule === 'peabodyPassage') {
      const peabody = inv.assets.find(asset => asset.code === '03141' && !asset.exhausted)
      if (!peabody) throw new Error('皮博迪先生必须处于重整状态')
      const locations = state.locations.filter(location => location.id !== inv.location)
      const id = api.choose({
        kind: 'target', source: '03141', seat: inv.seat, prompt: '选择一个地点获得通道特性。',
        options: locations.map(location => ({ id: location.id, label: location.name })),
      })
      peabody.exhausted = true
      state.scenarioFlags.peabodyPassage = id
      const location = state.locations.find(candidate => candidate.id === id)
      const passageways = state.scenario.passagewayLocations.filter(candidate => state.locations.some(item => item.id === candidate))
      location.connections = [...new Set([...location.connections, ...passageways.filter(candidate => candidate !== id)])]
    } else throw new Error(`未知往事回声行动：${move.rule}`)
  },
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    // The scenario owns its original symbol clauses; the shared dispatcher
    // still receives any future non-symbol result extensions.
    carcosaChaosAfterTest('echoesOfThePast', state, inv, {
      ...result, drawn: result.drawn.filter(token => !symbolFamily.has(token) && token !== 'skull'),
    }, api)
    if (!result.success && !hardSide(state)) {
      const tokens = result.drawn.filter(token => !result.cancelledTokens?.includes(token))
      if (tokens.includes('cultist')) placeDoomOnNearestEnemy(state, inv, api)
      if (tokens.includes('tablet')) api.discardRandom(inv.seat, 1)
      if (tokens.includes('elderthing') && state.enemies.some(enemy => enemy.location === inv.location)) api.horror(inv.seat, 1)
    }
    if (result.success && result.source?.label === '调查') {
      const location = state.locations.find(candidate => candidate.id === inv.location)
      if (['03133', '03136'].includes(original(location))) {
        const key = `library:${location.id}:${inv.seat}`
        if (state.scenarioFlags[key] !== state.round && api.choose({
          kind: 'reaction', source: original(location), seat: inv.seat,
          prompt: '是否承受 2 点恐惧，在此处额外发现 1 个线索？',
          options: [{ id: 'skip', label: '不触发' }, { id: 'trigger', label: '承受恐惧并发现线索' }],
        }) === 'trigger') {
          state.scenarioFlags[key] = state.round
          api.horror(inv.seat, 2)
          if (location.clues > 0) {
            location.clues--
            inv.clues++
          }
        }
      }
    }
  },
  enemyStatModifier(state, enemy, stat) {
    const shared = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    const location = state.locations.find(candidate => candidate.id === enemy.location)
    return shared + (['03129', '03138'].includes(original(location)) && ['fight', 'evade'].includes(stat) ? 1 : 0)
  },
  resolveEncounter(state, inv, card, api) {
    const code = original(card)
    if (code === '03145') {
      const cultists = state.enemies.filter(enemy => enemy.traits?.includes('Cultist'))
      const options = [{ id: 'agenda', label: '在当前议程放置 1 个毁灭' }]
      if (inv.clues > 0) options.unshift(...cultists.map(enemy => ({ id: enemy.id, label: `将 1 个线索移到${enemy.name}` })))
      const answer = api.choose({ kind: 'encounter', source: code, seat: inv.seat, prompt: '误入歧途', options })
      const enemy = cultists.find(candidate => candidate.id === answer)
      if (enemy) {
        inv.clues--
        enemy.doom = (enemy.doom || 0) + 1
      } else state.doom++
      return false
    }
    if (code === '03146') {
      const cultists = state.enemies.filter(enemy => enemy.traits?.includes('Cultist') && (enemy.doom || 0) > 0)
      if (cultists.length) {
        for (const enemy of cultists) {
          state.doom += enemy.doom
          enemy.doom = 0
        }
      } else {
        const index = state.encounterDeck.findLastIndex(candidate =>
          state.scenario.enemies[candidate]?.traits?.includes('Cultist'))
        if (index >= 0) {
          const enemyCode = state.encounterDeck.splice(index, 1)[0]
          api.spawn(enemyCode, inv.location)
          api.shuffleEncounterDeck()
        }
      }
      return false
    }
    return encounterRules.resolveEncounter.call(this, state, inv, card, api)
  },
  allResigned(_state, api) {
    api.finish('noResolution')
  },
  storyResolutionKey(_state, key) {
    return key === 'noResolution' ? 'r4' : key
  },
  resolution(state, key, _events, api = {}) {
    if (!['noResolution', 'r1', 'r2', 'r3', 'r4'].includes(key)) throw new Error('未知往事回声结局')
    const records = state.campaign.records
    if (state.victoryDisplay.some(card => original(card) === '03068b')) addVipSlain(state, '03068')
    if (key === 'r1') {
      records.youTookTheOnyxClasp = true
      records.conviction = (records.conviction || 0) + 1
      awardRequiredStoryCard(state, '03142', 'echoesOfThePast', api)
      replaceSymbols(state, 'cultist')
    } else if (key === 'r2') {
      records.youLeftTheOnyxClaspBehind = true
      records.doubt = (records.doubt || 0) + 1
      replaceSymbols(state, 'tablet')
    } else if (key === 'r3') {
      records.youDestroyedTheOathspeaker = true
      awardOptionalStoryCard(state, '03143', 'echoesOfThePast', api)
      replaceSymbols(state, 'tablet')
    } else {
      records.theFollowersOfTheSignHaveFoundTheWayForward = true
      replaceSymbols(state, 'elderthing')
    }
    return { bonus: key === 'r4' || key === 'noResolution' ? 1 : 0, award: true }
  },
}
