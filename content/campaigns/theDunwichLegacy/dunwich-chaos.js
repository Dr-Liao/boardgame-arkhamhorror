import { ALL_CARDS } from '../../../src/cards/cards-data.js'

const original = card => card?.originalCode || card?.code
const hardSide = state => ['hard', 'expert'].includes(state.difficulty)
const cardCost = code => Math.max(0, Number(ALL_CARDS[code]?.cost) || 0)
const fromTopCost = (inv, count, api) => {
  const before = inv.discard.length
  api.discardTop(inv.seat, count)
  return inv.discard.slice(before).reduce((sum, code) => sum + cardCost(code), 0)
}
const location = (state, inv) => state.locations.find(loc => loc.id === inv.location)
const brood = state => state.enemies.filter(enemy => enemy.code === '02255')
const fx = (delta, extra = {}) => ({ delta, ...extra })

export function dunwichChaosToken(id, state, inv, token, api) {
  if (!['skull', 'cultist', 'tablet', 'elderthing'].includes(token)) return null
  const hard = hardSide(state), here = location(state, inv)
  if (id === 'extracurricularActivity') {
    if (token === 'skull') return fx(hard ? -2 : -1)
    if (token === 'cultist') return fx(inv.discard.length >= 10 ? hard ? -5 : -3 : -1)
    return fx(-fromTopCost(inv, hard ? 3 : 2, api))
  }
  if (id === 'theHouseAlwaysWins') {
    if (token === 'skull') {
      const cost = hard ? 3 : 2
      if (inv.resources >= cost && api.choose({ kind: 'chaos', source: '02062', seat: inv.seat,
        prompt: `是否支付 ${cost} 资源，将骷髅标记视为 0？`,
        options: [{ id: 'pay', label: `支付 ${cost} 资源` }, { id: 'keep', label: `保留 -${cost}` }] }) === 'pay') {
        inv.resources -= cost
        return fx(0)
      }
      return fx(-cost)
    }
    if (token === 'cultist') return fx(-3)
    if (hard && token === 'tablet') inv.resources = Math.max(0, inv.resources - 3)
    return fx(-2)
  }
  if (id === 'theMiskatonicMuseum') {
    if (token === 'skull') return fx(state.enemies.some(e => e.code === '02141' && e.location === inv.location)
      ? hard ? -4 : -3 : hard ? -2 : -1)
    if (token === 'cultist') return fx(hard ? -3 : -1)
    if (token === 'tablet') {
      if (hard) { const horror = state.enemies.find(e => e.code === '02141' && e.location === inv.location); if (horror) api.attack(horror, inv) }
      else if (inv.clues) { api.spendClues(inv.seat, 1); here.clues++ }
      return fx(hard ? -4 : -2)
    }
    return fx(hard ? -5 : -3)
  }
  if (id === 'theEssexCountyExpress') {
    if (token === 'skull') return fx(-(state.agendaIndex + 1 + Number(hard)))
    if (token === 'cultist') return fx(hard ? 0 : -1, { drawAnother: hard })
    if (token === 'tablet') {
      const cultists = state.enemies.filter(e => e.traits?.some(t => t.toLowerCase() === 'cultist'))
      const min = Math.min(...cultists.map(enemy => locationDistance(state, inv.location, enemy.location)))
      const nearest = cultists.filter(enemy => locationDistance(state, inv.location, enemy.location) === min)
      const chosen = !hard && nearest.length > 1 ? api.choose({ kind: 'target', source: '02159', seat: inv.seat,
        prompt: '选择一名最近的异教徒放置毁灭。', options: nearest.map(enemy => ({ id: enemy.id, label: enemy.name })) }) : nearest[0]?.id
      for (const enemy of hard ? cultists : nearest.filter(enemy => enemy.id === chosen)) enemy.doom = (enemy.doom || 0) + 1
      return fx(hard ? -4 : -2)
    }
    return fx(-3)
  }
  if (id === 'bloodOnTheAltar') {
    if (token === 'skull') {
      const count = state.locations.filter(loc => !state.scenarioZones.underLocations[loc.id]).length
      return fx(-Math.min(count, hard ? Infinity : 4))
    }
    if (token === 'cultist') return fx(hard ? -4 : -2)
    if (token === 'tablet') return fx(hard ? -3 : -2,
      { drawAnother: hard || original(here) === '02214' })
    if (hard && token === 'elderthing') state.doom++
    return fx(-3)
  }
  if (id === 'undimensionedAndUnseen') {
    if (token === 'skull') return fx(-brood(state).length * (hard ? 2 : 1))
    if (token === 'cultist') return fx(0, { drawAnother: true })
    if (token === 'tablet') {
      const marked = brood(state).filter(enemy => enemy.clues > 0)
      const choice = api.choose({ kind: 'chaos', source: '02236', seat: inv.seat,
        prompt: '石板标记：移除一只子嗣上的全部线索，或承受检定惩罚。',
        options: [...marked.map(enemy => ({ id: enemy.id, label: `移除「${enemy.name}」上的 ${enemy.clues} 个线索` })),
          { id: 'penalty', label: hard ? '本次检定自动失败' : '本标记修正为 -4' }] })
      const target = marked.find(enemy => enemy.id === choice)
      if (target) { target.clues = 0; return fx(0) }
      return hard ? fx(0, { autoFail: true }) : fx(-4)
    }
    if (state.skillTest?.source?.code === '02255'
      && ['攻击', '躲避'].includes(state.skillTest.source.label)) {
      const target = brood(state).find(enemy => state.skillTest.source.enemyId ? enemy.id === state.skillTest.source.enemyId : enemy.location === inv.location)
      if (target) api.attack(target, inv)
    }
    return fx(hard ? -5 : -3)
  }
  if (id === 'whereDoomAwaits') {
    const altered = here?.traits?.some(trait => trait.toLowerCase() === 'altered')
    if (token === 'skull') return fx(altered ? hard ? -5 : -3 : hard ? -2 : -1)
    if (token === 'cultist') return fx(0, { drawAnother: true, cancelCommitted: true })
    if (token === 'tablet') return state.agendaIndex >= 1 && hard ? fx(0, { autoFail: true })
      : fx(state.agendaIndex >= 1 ? -4 : hard ? -3 : -2)
    return fx(-fromTopCost(inv, hard ? 3 : 2, api))
  }
  if (id === 'lostInTimeAndSpace') {
    if (token === 'skull') {
      const count = state.locations.filter(loc => loc.traits?.some(trait => trait.toLowerCase() === 'extradimensional')).length
      return fx(-Math.min(count, hard ? Infinity : 5))
    }
    if (token === 'cultist') return fx(0, { drawAnother: true })
    if (token === 'tablet') return fx(hard ? -5 : -3)
    return fx(-(here?.shroud || 0) * (hard ? 2 : 1))
  }
  return null
}

export function dunwichChaosAfterTest(id, state, inv, result, api) {
  const tokens = result.drawn.filter(token => !result.cancelledTokens?.includes(token))
  const has = token => tokens.includes(token), hard = hardSide(state)
  if (id === 'extracurricularActivity' && has('skull') && !result.success) api.discardTop(inv.seat, hard ? 5 : 3)
  if (id === 'theHouseAlwaysWins') {
    if (has('cultist')) inv.resources = Math.max(0, inv.resources + (hard ? result.success ? 0 : -3 : result.success ? 3 : 0))
    if (has('tablet') && !hard && !result.success) inv.resources = Math.max(0, inv.resources - 3)
  }
  if (id === 'theMiskatonicMuseum') {
    if (has('cultist') && !result.success) {
      const horror = state.enemies.find(e => e.code === '02141')
      if (horror) horror.location = inv.location
      else {
        const pile = [state.encounterDeck, state.encounterDiscard].find(cards => cards.includes('02141'))
        if (pile) pile.splice(pile.indexOf('02141'), 1)
        const summoned = api.spawn('02141', inv.location)
        if (summoned && state.scenarioZones.void) {
          const resources = state.scenarioZones.void.resources + 1
          summoned.shadowResources = resources
          summoned.fight += resources; summoned.evade += resources; summoned.health += resources
          summoned.massive = resources >= 3
          delete state.scenarioZones.void
        }
      }
    }
    if (has('elderthing') && !result.success && inv.assets.length) {
      const choice = api.choose({ kind: 'discard-asset', source: '02118', seat: inv.seat,
        prompt: '选择弃掉一张受你控制的支援卡。',
        options: inv.assets.map(asset => ({ id: asset.id, label: asset.name || ALL_CARDS[asset.code]?.nameZh || asset.code })) })
      api.discardAsset(inv.seat, choice)
    }
  }
  if (id === 'theEssexCountyExpress') {
    if (has('cultist') && !result.success && state.phase === 'investigation' && state.currentSeat === inv.seat) inv.actionsLeft = 0
    if (has('elderthing') && !result.success) for (let i = 0, n = hard ? Math.max(1, result.difficulty - result.value) : 1;
      i < n && inv.hand.length; i++) {
      const chosen = api.choose({ kind: 'card', source: '02159', seat: inv.seat,
        prompt: '古神标记：选择一张手牌弃掉。',
        options: inv.hand.map((code, index) => ({ id: String(index), label: ALL_CARDS[code]?.nameZh || code })) })
      inv.discard.push(inv.hand.splice(Number(chosen), 1)[0])
    }
  }
  if (id === 'bloodOnTheAltar') {
    if (has('cultist') && !result.success) location(state, inv).clues++
    if (has('elderthing') && !hard && !result.success) state.doom++
  }
  if (id === 'undimensionedAndUnseen') {
    if (has('cultist') && !result.success) { api.horror(inv.seat, 1); if (hard) api.damage(inv.seat, 1) }
  }
  if (id === 'lostInTimeAndSpace') {
    if (has('cultist') && (hard || !result.success)) {
      const destination = api.drawEncounterLocation(inv.seat)
      if (destination) api.moveInvestigator(inv.seat, destination.id)
    }
    if (has('tablet')) { const yog = state.enemies.find(e => e.code === '02323'); if (yog) api.attack(yog, inv) }
    if (has('elderthing') && !result.success && location(state, inv)?.traits?.some(t => t.toLowerCase() === 'extradimensional')) {
      const removed = inv.location, cardCode = original(location(state, inv))
      api.remove(removed)
      state.encounterDiscard.push(cardCode)
    }
  }
}

function locationDistance(state, start, target) {
  if (start === target) return 0
  const queue = [start], distance = new Map([[start, 0]])
  for (let i = 0; i < queue.length; i++) {
    const loc = state.locations.find(item => item.id === queue[i])
    for (const next of loc?.connections || []) {
      if (next === target) return distance.get(queue[i]) + 1
      if (!distance.has(next)) { distance.set(next, distance.get(queue[i]) + 1); queue.push(next) }
    }
  }
  return Infinity
}
