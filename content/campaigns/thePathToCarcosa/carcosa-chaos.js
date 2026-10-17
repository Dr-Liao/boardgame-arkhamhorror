const hardSide = state => ['hard', 'expert'].includes(state.difficulty)
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const fx = (delta, extra = {}) => ({ delta, ...extra })

export function carcosaChaosToken(id, state, inv, token, api) {
  if (!['skull', 'cultist', 'tablet', 'elderthing'].includes(token)) return null
  const hard = hardSide(state)
  if (id === 'curtainCall') {
    if (token === 'skull') return fx(-Math.max(1, inv.horror + Number(hard)))
    if (token === 'cultist') return fx(hard ? -3 : -1)
    if (token === 'tablet') return fx(hard ? -4 : -2)
    return fx(hard ? -5 : -3)
  }
  if (id === 'theLastKing') {
    if (token === 'skull') return fx(hard ? -2 : -1, { drawAnother: true })
    if (token === 'cultist') return fx(hard ? -4 : -2)
    if (token === 'tablet') return fx(hard ? -4 : -2)
    return fx(-(here(state, inv)?.shroud || 0) - Number(hard))
  }
  if (id === 'echoesOfThePast') {
    if (token === 'skull') return fx(-(state.enemies.filter(enemy => enemy.doom > 0).length + Number(hard)))
    if (token === 'cultist') return fx(hard ? -4 : -2)
    if (token === 'tablet') return fx(hard ? -3 : -1)
    return fx(hard ? -5 : -3)
  }
  if (id === 'theUnspeakableOath') {
    if (token === 'skull') return fx(-(Math.max(1, state.scenarioFlags?.keysFound || 0) + Number(hard)))
    if (token === 'cultist') return fx(hard ? -4 : -2)
    if (token === 'tablet') return fx(0, { drawAnother: true })
    return fx(hard ? -5 : -3)
  }
  if (id === 'aPhantomOfTruth') {
    if (token === 'skull') return fx(-(state.agendaIndex + 1 + Number(hard)))
    if (token === 'cultist') return fx(hard ? -4 : -2)
    if (token === 'tablet') return fx(hard ? -3 : -1)
    return fx(hard ? -5 : -3)
  }
  if (id === 'thePallidMask') {
    if (token === 'skull') return fx(-(state.locations.length + Number(hard)))
    if (token === 'cultist') return fx(0, { drawAnother: true })
    if (token === 'tablet') return fx(hard ? -4 : -2)
    return fx(hard ? -5 : -3)
  }
  if (id === 'blackStarsRise') {
    const opposingDoom = Number(state.scenarioFlags?.opposingAgendaDoom || 0)
    if (token === 'skull') return fx(-(opposingDoom + 1 + Number(hard)))
    if (token === 'cultist') return fx(hard ? -4 : -2)
    if (token === 'tablet') return fx(hard ? -3 : -1)
    return fx(hard ? -5 : -3)
  }
  if (id === 'dimCarcosa') {
    const total = Number(state.campaign.records.doubt || 0) + Number(state.campaign.records.conviction || 0)
    if (token === 'skull') return fx(-(Math.max(1, total) + Number(hard)))
    if (token === 'cultist') return fx(hard ? -4 : -2)
    if (token === 'tablet') return fx(hard ? -4 : -2)
    return fx(hard ? -6 : -4)
  }
  return null
}

export function carcosaChaosAfterTest(id, state, inv, result, api) {
  const tokens = result.drawn.filter(token => !result.cancelledTokens?.includes(token))
  const has = token => tokens.includes(token)
  const hard = hardSide(state)
  if (id === 'curtainCall' && !result.success) {
    const location = here(state, inv)
    if (has('cultist')) location.horror = (location.horror || 0) + 1
    if (has('tablet')) api.horror(inv.seat, 1)
    if (has('elderthing')) hard ? api.horror(inv.seat, 2) : (location.horror = (location.horror || 0) + 1)
  }
  if (id === 'theLastKing' && !result.success) {
    if (has('skull')) {
      const target = state.enemies.find(enemy =>
        enemy.traits?.some(trait => ['Lunatic', 'Possessed'].includes(trait)))
      if (target) target.doom = (target.doom || 0) + 1
    }
    if (has('cultist')) inv.clues = Math.max(0, inv.clues - (hard ? 2 : 1))
    if (has('tablet')) api.horror(inv.seat, hard ? 2 : 1)
    if (has('elderthing') && hard) api.damage(inv.seat, 1)
  }
  if (id === 'echoesOfThePast' && !result.success) {
    if (has('cultist')) state.doom++
    if (has('tablet')) api.horror(inv.seat, 1)
  }
  if (id === 'theUnspeakableOath' && !result.success) {
    if (has('cultist')) api.horror(inv.seat, 1)
    if (has('elderthing')) api.damage(inv.seat, hard ? 2 : 1)
  }
  if (id === 'aPhantomOfTruth' && !result.success) {
    if (has('cultist')) inv.resources = Math.max(0, inv.resources - (hard ? 3 : 1))
    if (has('elderthing')) api.horror(inv.seat, 1)
  }
  if (id === 'thePallidMask' && !result.success) {
    if (has('tablet')) api.horror(inv.seat, 1)
    if (has('elderthing')) api.damage(inv.seat, 1)
  }
  if (id === 'blackStarsRise' && !result.success && has('elderthing')) state.doom++
  if (id === 'dimCarcosa' && !result.success) {
    if (has('cultist')) api.horror(inv.seat, 1)
    if (has('tablet')) for (const target of active(state)) api.horror(target.seat, hard ? 2 : 1)
  }
}
