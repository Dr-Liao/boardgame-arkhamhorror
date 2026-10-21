import { changeChaosBag } from '../../../../../src/engine/chaos-bag.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterRules } from '../../encounter-rules.js'
import { carcosaChaosToken, carcosaChaosAfterTest } from '../../carcosa-chaos.js'

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => state.campaign.records ||= {}
const original = card => card?.originalCode || card?.code
const interviewed = (state, code) => (recordsFor(state).vipsInterviewed || []).includes(code)
const slain = (state, code) => (recordsFor(state).vipsSlain || []).includes(code)
const directions = {
  '03247': [[0, -1], [0, 1]],
  '03248': [[1, 0]],
  '03249': [[0, -1], [1, 0]],
  '03250': [[0, 1], [1, 0]],
  '03251': [[0, -1], [0, 1], [1, 0]],
  '03252': [[-1, 0], [1, 0]],
  '03253': [[0, -1], [0, 1], [1, 0]],
  '03254': [[0, -1], [1, 0]],
  '03255': [[0, 1], [1, 0]],
}
const directionCount = { '03251': 1, '03254': 1, '03255': 1 }

function mix(state, helper, list) {
  if (helper?.shuffle && helper?.randomValue) return helper.shuffle([...list], () => helper.randomValue(state))
  return [...list]
}

function removeOne(list, code) {
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
}

function definitionForCode(state, code) {
  const definition = Object.values(state.scenario.locations)
    .find(location => original(location) === code)
  if (!definition) throw new Error(`未知地下墓穴地点：${code}`)
  return definition
}

function variantFor(state, slot, code, grid, revealed = false) {
  const base = structuredClone(definitionForCode(state, code))
  return {
    ...base,
    id: slot,
    connections: [],
    grid: { ...grid },
    ...(revealed ? {} : {
      name: '地下墓穴',
      hiddenIdentity: true,
      unrevealedActualName: base.name,
    }),
  }
}

function nextSlot(state) {
  const used = new Set([
    ...state.locations.map(location => location.id),
    ...Object.keys(state.locationVariants),
  ])
  return Object.keys(state.scenario.locations).find(id => !used.has(id))
}

function occupied(state, x, y) {
  return state.locations.some(location => location.grid?.x === x && location.grid?.y === y)
    || Object.values(state.locationVariants).some(location => location.grid?.x === x && location.grid?.y === y)
}

function updateConnections(state) {
  for (const location of state.locations) {
    if (!location.grid) continue
    location.connections = state.locations.filter(other => other.id !== location.id && other.grid
      && Math.abs(other.grid.x - location.grid.x) + Math.abs(other.grid.y - location.grid.y) === 1)
      .map(other => other.id)
  }
}

function chooseDirections(state, source, offsets, api, amount = offsets.length) {
  const available = offsets.filter(([dx, dy]) =>
    !occupied(state, source.grid.x + dx, source.grid.y + dy))
  if (available.length <= amount) return available
  const chosen = []
  while (chosen.length < amount && available.length) {
    const answer = api.choose({
      kind: 'location',
      source: original(source),
      seat: state.campaign.leadSeat,
      prompt: '选择新地下墓穴地点的相邻方向。',
      options: available.map(([dx, dy]) => ({
        id: `${dx},${dy}`,
        label: dx < 0 ? '左方' : dx > 0 ? '右方' : dy < 0 ? '上方' : '下方',
      })),
    })
    const index = available.findIndex(([dx, dy]) => `${dx},${dy}` === answer)
    chosen.push(...available.splice(index < 0 ? 0 : index, 1))
  }
  return chosen
}

function placeNext(state, source, offsets, api, amount = offsets.length) {
  const zones = state.scenarioZones
  const selected = chooseDirections(state, source, offsets, api, amount)
  for (const [dx, dy] of selected) {
    const code = zones.catacombsDeck.pop()
    const slot = nextSlot(state)
    if (!code || !slot) break
    state.locationVariants[slot] = variantFor(state, slot, code, {
      x: source.grid.x + dx,
      y: source.grid.y + dy,
    })
    api.place(slot)
    updateConnections(state)
  }
}

function distance(state, from, target) {
  const queue = [[from, 0]], seen = new Set([from])
  for (const [id, amount] of queue) {
    if (id === target) return amount
    for (const next of state.locations.find(location => location.id === id)?.connections || []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, amount + 1])
    }
  }
  return -1
}

function replaceSymbols(state, token) {
  state.campaign.chaosBag ||= [...state.chaosBag]
  for (const face of ['cultist', 'tablet', 'elderthing']) {
    const amount = state.chaosBag.filter(value => value === face).length
    if (amount) changeChaosBag(state, face, -amount, { permanent: true })
  }
  changeChaosBag(state, token, 2, { permanent: true })
}

export function setupPlan(state, helper = {}) {
  const records = recordsFor(state)
  const awokeInside = !!(records.youDidNotEscapeTheGazeOfThePhantom || records.youWereUnableToFindNigel)
  const all = [
    '03247', '03248', '03248', '03249', '03250', '03251', '03252',
    '03252', '03253', '03253', '03254', '03255',
  ]
  let startCode = '03247'
  if (awokeInside) startCode = mix(state, helper, all)[0]
  removeOne(all, startCode)
  const shuffled = mix(state, helper, all)
  const bottomFill = shuffled.splice(0, 3)
  const bottom = mix(state, helper, ['03257', '03256', ...bottomFill])
  const catacombsDeck = [...bottom, ...mix(state, helper, shuffled)]
  return { awokeInside, startCode, catacombsDeck }
}

export const behavior = {
  ...encounterRules,
  id: 'thePallidMask',
  setupPlan,
  preScenarioSetup(state) {
    const records = recordsFor(state)
    const awokeInside = !!(records.youDidNotEscapeTheGazeOfThePhantom || records.youWereUnableToFindNigel)
    records[awokeInside ? 'youAwokeInsideTheCatacombs' : 'youEnteredTheCatacombsOnYourOwn'] = true
    state.scenarioFlags ||= {}
    state.scenarioFlags.harukoPassage = interviewed(state, '03078')
    state.scenarioFlags.preScenarioComplete = true
    return { awokeInside, harukoPassage: state.scenarioFlags.harukoPassage }
  },
  setupLocations(state, events, helper) {
    state.scenarioFlags ||= {}
    if (!state.scenarioFlags.preScenarioComplete) this.preScenarioSetup(state)
    state.locationVariants = {}
    const plan = setupPlan(state, helper)
    state.scenarioZones = {
      catacombsDeck: [...plan.catacombsDeck],
      setAside: ['03059'],
      removed: [],
      catacombStartCode: plan.startCode,
    }
    state.scenarioFlags.startLocationId = 'catacomb0'
    state.scenarioFlags.setupRevealSlots = []
    state.locationVariants.catacomb0 = variantFor(state, 'catacomb0', plan.startCode, { x: 0, y: 0 }, true)
    const placed = ['catacomb0']
    const planPlacement = (sourceSlot, offsets) => {
      const source = state.locationVariants[sourceSlot]
      for (const [dx, dy] of offsets.filter(([x, y]) =>
        !occupied(state, source.grid.x + x, source.grid.y + y))) {
        const code = state.scenarioZones.catacombsDeck.pop()
        const slot = nextSlot(state)
        if (!code || !slot) break
        state.locationVariants[slot] = variantFor(state, slot, code, {
          x: source.grid.x + dx,
          y: source.grid.y + dy,
        })
        placed.push(slot)
      }
    }
    planPlacement('catacomb0', (directions[plan.startCode] || [])
      .slice(0, directionCount[plan.startCode] || directions[plan.startCode]?.length))
    if (state.scenarioFlags.harukoPassage) {
      let target = placed.find(id => id !== 'catacomb0')
      if (!target) {
        planPlacement('catacomb0', [[1, 0]])
        target = placed.find(id => id !== 'catacomb0')
      }
      if (target) state.scenarioFlags.setupRevealSlots.push(target)
    }
    state.acts = state.scenario.acts.slice(0, 3).map(card => structuredClone(card))
    return placed
  },
  afterDeckSetup(state) {
    for (const id of state.scenarioFlags.setupRevealSlots || []) {
      const location = state.locations.find(candidate => candidate.id === id)
      if (!location) continue
      location.revealed = true
      location.name = location.unrevealedActualName || location.name
      delete location.unrevealedActualName
      delete location.hiddenIdentity
      location.clues = location.maxClues || 0
    }
    updateConnections(state)
  },
  resolveChaosToken(state, inv, token, api) {
    return carcosaChaosToken('thePallidMask', state, inv, token, api)
  },
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    carcosaChaosAfterTest('thePallidMask', state, inv, result, api)
  },
  beforeMove(state, inv, destination, api) {
    const source = state.locations.find(location => location.id === inv.location)
    if (!destination?.revealed && source?.originalCode !== '03248') {
      api.payClues(state.numInvestigators, source.id)
    }
  },
  locationLeaveTest(state, inv, location) {
    if (location?.originalCode === '03254') return { skill: 'agility', difficulty: 3 }
    return null
  },
  locationLeaveFailed(state, inv, location, api) {
    if (location?.originalCode === '03254') api.damage(inv.seat, 1)
  },
  locationRevealed(state, location, api) {
    updateConnections(state)
    if (location.originalCode === '03257' && state.actIndex === 0) {
      state.scenarioFlags.tombLocationId = location.id
      api.advanceAct()
      return
    }
    if (directions[location.originalCode]) {
      placeNext(state, location, directions[location.originalCode], api,
        directionCount[location.originalCode] || directions[location.originalCode].length)
    }
    if (location.originalCode === '03256' && state.acts[state.actIndex]?.originalCode !== '03246') {
      const inv = state.investigators[state.currentSeat]
      if (inv?.location === location.id) api.damage(inv.seat, 2)
      location.cannotLeaveRound = state.round
    }
  },
  actReveal(state, act, api) {
    registeredEntry(act.originalCode)?.actRule?.onReveal?.(state, act, api)
  },
  agendaReveal(state, agenda, api) {
    registeredEntry(agenda.originalCode)?.agendaRule?.onReveal?.(state, agenda, api)
  },
  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    if (enemy.code === '03059' && enemy.location === state.scenarioFlags.tombLocationId) {
      enemy.health += state.numInvestigators
      enemy.cannotBeDefeatedByAction = true
    }
  },
  enemyCanBeDefeated(state, enemy, source) {
    if (enemy.code === '03059' && enemy.cannotBeDefeatedByAction && source === '03059') return false
    return true
  },
  enemyDefeated(state, enemy, api) {
    if (enemy.code === '03059' && state.actIndex === 1) {
      state.scenarioFlags.actTwoAdvancedWith = 'defeat'
      api.advanceAct()
    }
    return encounterRules.enemyDefeated?.(state, enemy, api) || false
  },
  actions(state, inv) {
    const moves = []
    const location = state.locations.find(candidate => candidate.id === inv.location)
    if (original(location) === '03252' && !state.scenarioFlags.candlelitTunnelsUsed) {
      moves.push({ action: 'scenarioAction', rule: 'readAncientSign',
        label: '检定智识（3），查看一处地下墓穴的揭示面' })
    }
    if (state.actIndex === 1 && inv.location === state.scenarioFlags.tombLocationId) {
      const clues = active(state).filter(candidate => candidate.location === inv.location)
        .reduce((sum, candidate) => sum + candidate.clues, 0)
      const needed = 2 * state.numInvestigators
      moves.push({
        action: 'scenarioAction',
        rule: 'studyTomb',
        scriptCard: 'act',
        label: `共同花费${2 * state.numInvestigators}个线索，研究暗影坟墓`,
        reason: clues >= needed ? null : `需要共同花费 ${needed} 个线索（当前 ${clues}）`,
      })
    }
    return moves
  },
  performAction(state, inv, move, api) {
    if (move.rule === 'readAncientSign') {
      const location = state.locations.find(candidate => candidate.id === inv.location)
      if (original(location) !== '03252' || state.scenarioFlags.candlelitTunnelsUsed) {
        throw new Error('烛光隧道能力当前不可用')
      }
      state.scenarioFlags.candlelitTunnelsUsed = true
      api.test(inv.seat, 'intellect', 3, result => {
        if (!result.success) return
        const locations = state.locations.filter(candidate => String(original(candidate)).startsWith('032'))
        if (!locations.length) return
        const id = locations.length === 1 ? locations[0].id : api.choose({
          kind: 'location', source: '03252', seat: inv.seat,
          prompt: '选择查看一处地下墓穴地点的揭示面。',
          options: locations.map(candidate => ({
            id: candidate.id, label: `${candidate.name}（${candidate.id}）`,
          })),
        })
        const target = locations.find(candidate => candidate.id === id)
        const card = target && ALL_CARDS[original(target)]
        if (target && card) api.privateInfo(inv.seat,
          `烛光隧道：你查看了「${card.nameZh || card.name}」（帷幕${card.shroud ?? target.shroud}）。${card.textZh || card.text || '没有卡面效果。'}`)
      })
    } else if (move.rule === 'studyTomb') {
      if (inv.location !== state.scenarioFlags.tombLocationId) throw new Error('必须位于暗影坟墓')
      api.payClues(2 * state.numInvestigators, inv.location)
      state.scenarioFlags.actTwoAdvancedWith = 'clues'
      api.advanceAct()
    } else throw new Error(`未知苍白面具行动：${move.rule}`)
  },
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    if (state.acts[state.actIndex]?.originalCode !== '03245') return
    const start = state.scenarioFlags.startLocationId
    const candidates = state.locations.filter(location => location.id !== start)
      .map(location => ({ location, distance: distance(state, location.id, start) }))
    if (!candidates.length) return
    const farthestDistance = Math.max(...candidates.map(candidate => candidate.distance))
    const farthest = candidates.filter(candidate => candidate.distance === farthestDistance)
    const id = farthest.length === 1 ? farthest[0].location.id : api.choose({
      kind: 'location',
      source: '03245',
      seat: state.campaign.leadSeat,
      prompt: '选择离地狱之门最远、将被弃掉的地点。',
      options: farthest.map(candidate => ({ id: candidate.location.id, label: candidate.location.name })),
    })
    const location = state.locations.find(candidate => candidate.id === id)
    const destinations = (location.connections || []).filter(next => state.locations.some(candidate => candidate.id === next))
    for (const inv of active(state).filter(candidate => candidate.location === id)) {
      const destination = destinations.length === 1 ? destinations[0] : api.choose({
        kind: 'location',
        source: '03245',
        seat: inv.seat,
        prompt: '选择逃离崩塌地点的连接地点。',
        options: destinations.map(next => ({ id: next, label: state.locations.find(candidate => candidate.id === next)?.name || next })),
      })
      if (destination) api.moveInvestigator(inv.seat, destination)
      api.damage(inv.seat, 2)
    }
    for (const enemy of state.enemies.filter(candidate => candidate.location === id)) {
      const destination = destinations[0]
      if (destination) api.moveEnemy(enemy, destination)
      enemy.damageTaken = (enemy.damageTaken || 0) + 2
    }
    api.remove(id)
    updateConnections(state)
  },
  checkObjectives(state, api) {
    const act = state.acts[state.actIndex]?.originalCode
    if (act === '03245' && active(state).every(inv => inv.location === state.scenarioFlags.startLocationId)) api.advanceAct()
    if (act === '03246') {
      const blocked = state.locations.find(location => location.originalCode === '03256')?.id
      if (blocked && active(state).every(inv => inv.location === blocked)) api.advanceAct()
    }
  },
  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
    const code = state.locations.find(location => location.id === inv.location)?.originalCode
    if (code === '03251') {
      const answer = api.choose({
        kind: 'harm',
        source: code,
        seat: inv.seat,
        prompt: '百魂之井：选择受到1点直接恐惧，或随机弃掉2张手牌。',
        options: [{ id: 'horror', label: '受到1点直接恐惧' }, { id: 'discard', label: '随机弃2张手牌' }],
      })
      if (answer === 'horror') api.directHorror(inv.seat, 1)
      else api.discardRandom(inv.seat, 2)
    }
    if (code === '03255') {
      const answer = api.choose({
        kind: 'harm',
        source: code,
        seat: inv.seat,
        prompt: '颤栗水池：选择受到1点直接伤害，或失去5资源。',
        options: [{ id: 'damage', label: '受到1点直接伤害' }, { id: 'resources', label: '失去5资源' }],
      })
      if (answer === 'damage') api.directDamage(inv.seat, 1)
      else inv.resources = Math.max(0, inv.resources - 5)
    }
  },
  resolution(state, key, events, api) {
    if (!['noResolution', 'r1', 'r2'].includes(key)) throw new Error('未知苍白面具结局')
    const records = recordsFor(state)
    records.youKnowTheSiteOfTheGate = true
    if (key === 'r2') records.chasingTheStranger = Number(records.chasingTheStranger || 0) + 2
    if (key === 'noResolution') {
      const readers = []
      for (let index = 0; index < state.investigators.length; index++) {
        const inv = state.investigators[index]
        const mustRead = index === state.investigators.length - 1 && !readers.length
        const answer = mustRead ? 'read' : api.choose({
          kind: 'story',
          source: 'thePallidMaskActII',
          seat: inv.seat,
          prompt: `${inv.name}是否阅读《黄衣之王》第二幕？至少一人必须阅读。`,
          options: [{ id: 'skip', label: '不阅读' }, { id: 'read', label: '阅读第二幕' }],
        })
        if (answer === 'read') readers.push(inv.seat)
      }
      records.readActII ||= []
      for (const seat of readers) {
        const id = state.campaign.investigators?.[seat]?.id
          || state.investigators.find(inv => inv.seat === seat)?.campaignId
        if (id && !records.readActII.includes(id)) records.readActII.push(id)
      }
      state.scenarioFlags.actIIReaders = readers
    }
    replaceSymbols(state, key === 'r1' ? 'cultist' : key === 'r2' ? 'tablet' : 'elderthing')
    if (state.victoryDisplay.some(card => original(card) === '03067b')) {
      records.vipsSlain ||= []
      if (!records.vipsSlain.includes('03067')) records.vipsSlain.push('03067')
    }
    return { award: true, bonus: 0 }
  },
}
