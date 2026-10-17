import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterRules } from '../../encounter-rules.js'
import { carcosaChaosToken } from '../../carcosa-chaos.js'
import { agendaVariants } from './definition.js'

const clone = value => structuredClone(value)
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const codeOf = card => card?.originalCode || card?.code
const interviewedAshleigh = state =>
  (state.campaign.records.vipsInterviewed || []).some(value =>
    value === '03080')
const ashleighSlain = state =>
  (state.campaign.records.vipsSlain || []).some(value =>
    value === '03069')

function random(api, state) {
  if (api?.random) return api.random()
  if (api?.randomValue) return api.randomValue(state)
  throw new Error('黑星升起的随机布置必须在规则事务中执行')
}

function pick(api, state, values) {
  return values[Math.min(values.length - 1, Math.floor(random(api, state) * values.length))]
}

const stageCards = {
  below: {
    a: ['03275', '03276b', '03277'],
    c: ['03278', '03279a', '03280'],
    pathLocation: 'chapelOfStAubert',
    act: '03281',
    resolution: 'r1',
  },
  above: {
    a: ['03275', '03276a', '03277'],
    c: ['03278', '03279b', '03280'],
    pathLocation: 'abbeyTower',
    act: '03282',
    resolution: 'r2',
  },
}

function definitionsFor(route, deck) {
  const source = deck === 'a' ? agendaVariants.tide : agendaVariants.ritual
  return stageCards[route][deck].map(code => clone(source.find(card => card.originalCode === code)))
    .map(card => ({ ...card, reveal: { type: 'campaignRule' } }))
}

export function setupPlan(state, api) {
  state.scenarioFlags ||= {}
  if (state.scenarioFlags.blackStarsPlan) return state.scenarioFlags.blackStarsPlan
  const route = pick(api, state, ['below', 'above'])
  const variants = {
    outerWall: pick(api, state, ['03285', '03286']),
    northTower: pick(api, state, ['03287', '03288']),
    brokenSteps: pick(api, state, ['03289', '03290']),
    choeurGothique: pick(api, state, ['03292', '03293']),
    chapelOfStAubert: route === 'below' ? '03296' : '03297',
    abbeyTower: route === 'above' ? '03298' : '03299',
  }
  const plan = {
    route,
    variants,
    locations: ['porteDeLAvancee', 'grandRue', 'outerWall', 'northTower', 'brokenSteps', 'abbeyChurch'],
    agendaDecks: {
      a: { id: 'a', index: 0, doom: 0, cards: [...stageCards[route].a] },
      c: { id: 'c', index: 0, doom: 0, cards: [...stageCards[route].c] },
    },
    setAside: ['03088', '03300', '03300', '03301', '03301', '03069b', '03281', '03282',
      variants.choeurGothique, variants.chapelOfStAubert, variants.abbeyTower],
    removed: [
      route === 'below' ? '03276a' : '03276b',
      route === 'below' ? '03279b' : '03279a',
      route === 'below' ? '03297' : '03296',
      route === 'below' ? '03298' : '03299',
    ],
  }
  state.scenarioFlags.blackStarsPlan = plan
  return plan
}

function addCampaignMark(state, key) {
  state.campaign.records[key] = Number(state.campaign.records[key] || 0) + 1
}

function syncMainAgenda(state) {
  const deck = state.scenarioFlags.agendaDecks?.a
  if (deck) deck.doom = Number(state.doom || 0)
}

function spawnAshleighAndBeast(state, deckId, api) {
  const location = deckId === 'a' ? 'abbeyTower' : 'chapelOfStAubert'
  if (!state.enemies.some(enemy => enemy.code === '03088')) api.spawn('03088', location)
  if (!ashleighSlain(state) && !state.enemies.some(enemy => enemy.code === '03069b')) {
    api.spawn('03069b', 'porteDeLAvancee')
  }
}

export function advanceAgendaDeck(state, deckId, api) {
  syncMainAgenda(state)
  const decks = state.scenarioFlags.agendaDecks
  const deck = decks?.[deckId]
  if (!deck || deck.index >= 3) throw new Error(`未知黑星升起密谋牌堆：${deckId}`)
  const code = deck.cards[deck.index]
  if (deck.index === 0) {
    const opposing = decks[deckId === 'a' ? 'c' : 'a']
    addCampaignMark(state, opposing.doom > 3 ? 'doubt' : 'conviction')
    const additions = deckId === 'a' ? ['03300', '03300'] : ['03301', '03301']
    state.encounterDeck.push(...state.encounterDiscard.splice(0), ...additions)
    api.shuffleEncounterDeck?.()
    deck.index = 1
    deck.doom = 0
  } else if (deck.index === 1) {
    const correct = (state.scenarioFlags.route === 'below' && deckId === 'a')
      || (state.scenarioFlags.route === 'above' && deckId === 'c')
    if (correct) {
      state.scenarioFlags.openPath = stageCards[state.scenarioFlags.route].act
    } else {
      spawnAshleighAndBeast(state, deckId, api)
      state.scenarioFlags.wrongRoute = deckId
      deck.index = 2
      deck.doom = 0
    }
  } else {
    api.finish('r3')
  }
  if (deckId === 'a') {
    state.doom = deck.doom
    state.agendaIndex = deck.index
  }
  return code
}

export function placeAgendaDoom(state, deckId, amount, api) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('毁灭标记数量无效')
  syncMainAgenda(state)
  const deck = state.scenarioFlags.agendaDecks?.[deckId]
  if (!deck) throw new Error(`未知黑星升起密谋牌堆：${deckId}`)
  deck.doom += amount
  if (deckId === 'a') state.doom = deck.doom
  const definition = definitionsFor(state.scenarioFlags.route, deckId)[deck.index]
  if (definition && deck.doom >= definition.doomThreshold) advanceAgendaDeck(state, deckId, api)
}

export const behavior = {
  ...encounterRules,
  id: 'blackStarsRise',
  setupPlan,
  resolveChaosToken(state, inv, token, api) {
    const base = carcosaChaosToken('blackStarsRise', state, inv, token, api)
    if (!base) return null
    syncMainAgenda(state)
    const decks = state.scenarioFlags.agendaDecks || { a: { doom: state.doom || 0 }, c: { doom: 0 } }
    const hard = ['hard', 'expert'].includes(state.difficulty)
    if (token === 'skull') return {
      delta: -(hard ? decks.a.doom + decks.c.doom : Math.max(decks.a.doom, decks.c.doom)),
    }
    if (token === 'cultist') {
      const enemy = state.enemies.find(item => item.location === inv.location && (item.doom || 0) > 0)
      const targetsDoomEnemy = enemy && ['fight', 'evade'].includes(state.skillTest?.action)
      return { delta: 0, drawAnother: true, autoFail: hard ? !!enemy : !!targetsDoomEnemy }
    }
    if (token === 'tablet') return { delta: 0, drawAnother: true }
    return { delta: hard ? -3 : -2 }
  },
  setupLocations(state, events, api) {
    state.scenarioFlags = {}
    const plan = setupPlan(state, api)
    state.scenarioFlags.route = plan.route
    state.scenarioFlags.agendaDecks = clone(plan.agendaDecks)
    state.scenarioFlags.ashleighDoomAbility = interviewedAshleigh(state)
    state.scenarioZones.setAside = [...plan.setAside]
    state.scenarioZones.removed = [...plan.removed]
    for (const [id, code] of Object.entries(plan.variants)) {
      state.locationVariants[id] = clone(state.scenario.locationVariants[id]
        .find(location => location.originalCode === code))
    }
    state.agendas = definitionsFor(plan.route, 'a')
    state.scenario.agendas = clone(state.agendas)
    state.agendaIndex = 0
    return plan.locations
  },
  locationRevealed(state, location, api) {
    if (location.id === 'abbeyChurch') {
      for (const id of ['choeurGothique', 'cloister', 'knightsHall', 'chapelOfStAubert', 'abbeyTower']) api.place(id)
    }
  },
  investigatorEntryError(state, location) {
    const code = codeOf(location)
    if (['03296', '03297'].includes(code) && !state.scenarioFlags.foundGuide) return '需要先在回廊找到向导'
    if (['03298', '03299'].includes(code) && !state.scenarioFlags.foundTowerKey) return '需要先在骑士大厅找到塔楼钥匙'
    return null
  },
  investigationError(state, inv, location) {
    const code = codeOf(location)
    if (code === '03296' && (inv.maxSanity || inv.sanity || 0) - (inv.horror || 0) > 3) {
      return '剩余神智必须为3点或更少'
    }
    if (code === '03298' && inv.hand.length) return '必须没有手牌'
    return null
  },
  encounterActions(state, inv) {
    const moves = encounterRules.encounterActions?.(state, inv) || []
    for (const enemy of state.enemies.filter(candidate =>
      codeOf(candidate) === '03301' && candidate.location === inv.location)) {
      moves.push({
        action: 'encounterAction', actionKind: 'parley', rule: 'parleyRiftSeeker',
        enemyId: enemy.id, actions: 1,
        label: '谈判裂缝探求者：在两个密谋上各放1毁灭并受到2点恐惧',
      })
    }
    return moves
  },
  performEncounterAction(state, inv, move, api) {
    if (move.rule !== 'parleyRiftSeeker') {
      return encounterRules.performEncounterAction?.(state, inv, move, api)
    }
    const enemy = state.enemies.find(candidate => candidate.id === move.enemyId
      && codeOf(candidate) === '03301' && candidate.location === inv.location)
    if (!enemy) throw new Error('裂缝探求者不在此处')
    api.horror(inv.seat, 2)
    for (const deckId of ['a', 'c']) placeAgendaDoom(state, deckId, 1, api)
    if (state.enemies.includes(enemy)) api.discardEnemy(enemy)
  },
  enemyAttackResolved(state, enemy, inv, api) {
    encounterRules.enemyAttackResolved?.(state, enemy, inv, api)
    if (codeOf(enemy) !== '03301' || inv.defeated || inv.resigned) return
    const choice = api.choose({
      kind: 'encounter',
      source: enemy.id,
      seat: inv.seat,
      prompt: '裂缝探求者攻击后：选择受到额外伤害与恐惧，或在两个密谋上各放1毁灭。',
      options: [
        { id: 'harm', label: '受到1点额外伤害和1点额外恐惧' },
        { id: 'doom', label: '在两个密谋上各放1点毁灭' },
      ],
    })
    if (choice === 'doom') {
      for (const deckId of ['a', 'c']) placeAgendaDoom(state, deckId, 1, api)
    } else {
      api.damage(inv.seat, 1)
      api.horror(inv.seat, 1)
    }
  },
  agendaReveal(state, agenda, api) {
    advanceAgendaDeck(state, 'a', api)
  },
  actions(state, inv) {
    const moves = []
    const location = state.locations.find(item => item.id === inv.location)
    const code = codeOf(location)
    const decks = state.scenarioFlags.agendaDecks || {}
    if (code === '03283' && Object.values(decks).some(deck => deck.doom > 0)) {
      moves.push({ action: 'scenarioAction', rule: 'shiftAgendaDoom', actions: 2,
        label: '花费2行动，将1个毁灭移到另一密谋并放置2个线索' })
    }
    if (['03292', '03293'].includes(code) && !state.scenarioFlags.choeurGothiqueUsed) {
      moves.push({ action: 'scenarioAction', rule: 'choeurGothiqueHeal',
        label: code === '03292' ? '在“a”密谋放置1毁灭，治愈2点伤害' : '在“c”密谋放置1毁灭，治愈2点恐惧' })
    }
    if (code === '03294' && location.clues === 0 && !state.scenarioFlags.foundGuide) {
      moves.push({ action: 'scenarioAction', actionKind: 'parley', rule: 'findGuide',
        label: '谈判：检定意志（3），寻找向导' })
    }
    if (code === '03295' && location.clues === 0 && !state.scenarioFlags.foundTowerKey) {
      moves.push({ action: 'scenarioAction', actionKind: 'investigate', rule: 'findTowerKey',
        label: '使用敏捷调查骑士大厅，寻找塔楼钥匙' })
    }
    if (code === '03296') moves.push({
      action: 'scenarioAction', rule: 'takeChapelHorror', label: '受到最多3点恐惧',
    })
    if (code === '03298' && inv.hand.length) moves.push({
      action: 'scenarioAction', rule: 'discardTowerCards', label: '弃掉最多3张手牌',
    })
    if (inv.clues >= state.numInvestigators) {
      for (const deckId of ['a', 'c']) moves.push({
        action: 'scenarioAction',
        rule: 'hastenAgenda',
        deckId,
        actions: 0,
        label: `共同花费 ${state.numInvestigators} 线索，在“${deckId}”密谋上放置1毁灭`,
      })
    }
    if (state.scenarioFlags.ashleighDoomAbility && !state.scenarioFlags.ashleighDoomUsed
      && Object.values(state.scenarioFlags.agendaDecks || {}).some(deck => deck.doom > 0)) {
      moves.push({ action: 'scenarioAction', rule: 'ashleighDoom', actions: 0, label: '阿什莉提供的信息：移除1毁灭' })
    }
    return moves
  },
  performAction(state, inv, move, api) {
    const location = state.locations.find(item => item.id === inv.location)
    const code = codeOf(location)
    if (move.rule === 'shiftAgendaDoom') {
      const decks = state.scenarioFlags.agendaDecks
      const sources = Object.values(decks).filter(deck => deck.doom > 0)
      if (code !== '03283' || !sources.length) throw new Error('晋升之门能力当前不可用')
      const sourceId = sources.length === 1 ? sources[0].id : api.choose({
        kind: 'story', source: code, seat: inv.seat, prompt: '选择移出1个毁灭的密谋牌堆。',
        options: sources.map(deck => ({ id: deck.id, label: `“${deck.id}”密谋（${deck.doom}毁灭）` })),
      })
      const source = decks[sourceId]
      const destination = decks[sourceId === 'a' ? 'c' : 'a']
      source.doom--
      if (source.id === 'a') state.doom = source.doom
      placeAgendaDoom(state, destination.id, 1, api)
      location.clues = (location.clues || 0) + 2
    } else if (move.rule === 'choeurGothiqueHeal') {
      if (!['03292', '03293'].includes(code) || state.scenarioFlags.choeurGothiqueUsed) {
        throw new Error('哥特式唱诗台能力当前不可用')
      }
      state.scenarioFlags.choeurGothiqueUsed = true
      placeAgendaDoom(state, code === '03292' ? 'a' : 'c', 1, api)
      if (code === '03292') api.healDamage(inv.seat, 2)
      else api.healHorror(inv.seat, 2)
    } else if (move.rule === 'findGuide') {
      if (code !== '03294' || location.clues > 0 || state.scenarioFlags.foundGuide) {
        throw new Error('回廊能力当前不可用')
      }
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) state.scenarioFlags.foundGuide = true
      })
    } else if (move.rule === 'findTowerKey') {
      if (code !== '03295' || location.clues > 0 || state.scenarioFlags.foundTowerKey) {
        throw new Error('骑士大厅能力当前不可用')
      }
      const difficulty = location.shroud + (location.shroudMod || 0) + (state.fogMod || 0)
      api.test(inv.seat, 'agility', difficulty, result => {
        if (result.success) state.scenarioFlags.foundTowerKey = true
      }, 0, { action: 'investigate', label: '骑士大厅寻找塔楼钥匙' })
    } else if (move.rule === 'takeChapelHorror') {
      if (code !== '03296') throw new Error('圣奥伯特礼拜堂能力当前不可用')
      const amount = Number(api.choose({
        kind: 'harm', source: code, seat: inv.seat, prompt: '选择受到多少点恐惧。',
        options: Array.from({ length: 4 }, (_, value) => ({ id: String(value), label: `${value}点恐惧` })),
      }))
      if (amount) api.horror(inv.seat, amount)
    } else if (move.rule === 'discardTowerCards') {
      if (code !== '03298' || !inv.hand.length) throw new Error('修道院塔楼能力当前不可用')
      const amount = Number(api.choose({
        kind: 'discard', source: code, seat: inv.seat, prompt: '选择弃掉多少张手牌。',
        options: Array.from({ length: Math.min(3, inv.hand.length) + 1 }, (_, value) =>
          ({ id: String(value), label: `${value}张` })),
      }))
      if (amount) api.discardChosen(inv.seat, amount, code)
    } else if (move.rule === 'hastenAgenda') {
      api.payClues(state.numInvestigators)
      placeAgendaDoom(state, move.deckId, 1, api)
      if (move.deckId === 'a') for (const target of active(state)) target.resources += 2
      else for (const target of active(state)) api.drawCards(target.seat, 1)
    } else if (move.rule === 'ashleighDoom') {
      const decks = state.scenarioFlags.agendaDecks
      const candidates = Object.values(decks).filter(deck => deck.doom > 0)
      if (!candidates.length || state.scenarioFlags.ashleighDoomUsed) throw new Error('阿什莉的能力当前不可用')
      const deck = candidates.length === 1 ? candidates[0] : candidates.find(item => item.id === move.deckId)
      if (!deck) throw new Error('必须选择有毁灭标记的密谋牌堆')
      deck.doom--
      if (deck.id === 'a') state.doom = deck.doom
      state.scenarioFlags.ashleighDoomUsed = true
    } else throw new Error(`未知黑星升起行动：${move.rule}`)
  },
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    const hard = ['hard', 'expert'].includes(state.difficulty)
    const tokens = result.drawn || []
    if (tokens.includes('tablet') && (!result.success || (hard && result.value - result.difficulty < 1))) {
      for (const id of ['a', 'c']) placeAgendaDoom(state, id, 1, api)
    }
    if (!result.success && tokens.includes('elderthing')) {
      for (const pile of [state.encounterDeck, state.encounterDiscard]) {
        const index = pile.findIndex(code => ALL_CARDS[code]?.traits?.includes('Byakhee'))
        if (index < 0) continue
        state.encounterDeck.push(pile.splice(index, 1)[0])
        api.drawEncounter(inv.seat)
        break
      }
    }
  },
  checkObjectives(state, api) {
    if (!state.scenarioFlags.openPath) return
    const route = stageCards[state.scenarioFlags.route]
    const location = state.locations.find(item => item.id === route.pathLocation)
    if (!location || location.clues > 0) return
    if (active(state).every(inv => inv.location === route.pathLocation)) api.finish(route.resolution)
  },
  storyResolutionKey(_state, key) {
    return key === 'noResolution' ? 'r3' : key
  },
  resolution(state, key) {
    if (key === 'noResolution') key = 'r3'
    if (!['r1', 'r2', 'r3'].includes(key)) throw new Error('未知黑星升起结局')
    const records = state.campaign.records
    if (key === 'r1') records.youOpenedThePathBelow = true
    if (key === 'r2') records.youOpenedThePathAbove = true
    if (key === 'r3') {
      records.theRealmOfCarcosaMergedWithOurOwnAndHasturRulesOverThemBoth = true
      state.campaign.failed = true
      for (const record of Object.values(state.campaign.investigators)) record.status = 'insane'
      return { award: false }
    }
    const kept = key === 'r1' ? ['cultist', 'cultist', 'tablet', 'tablet']
      : ['cultist', 'cultist', 'elderthing', 'elderthing']
    state.chaosBag = state.chaosBag.filter(token => !['cultist', 'tablet', 'elderthing'].includes(token)).concat(kept)
    state.campaign.chaosBag = [...state.chaosBag]
    if ((state.victoryDisplay || []).some(card => codeOf(card) === '03069b')) {
      records.vipsSlain ||= []
      if (!records.vipsSlain.includes('03069')) records.vipsSlain.push('03069')
    }
    return { award: true }
  },
}
