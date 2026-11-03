const plainZone = zone => typeof zone === 'string' && /^[a-z][A-Za-z0-9]{0,63}$/.test(zone)
  && !['constructor', 'prototype'].includes(zone)
const enemyCode = enemy => enemy.originalCode || enemy.code

// These are counters, unlike printed enemy.damage/horror/fight/evade/health.
// Keys deliberately live in the shared key ledger and are not cleared here.
export function clearEnemyTokensForZone(enemy) {
  for (const field of ['damageTaken', 'doom', 'clues', 'resources', 'uses']) {
    if (Object.hasOwn(enemy, field)) enemy[field] = 0
  }
  if (Object.hasOwn(enemy, 'tokens')) enemy.tokens = {}
  if (Object.hasOwn(enemy, 'markers')) enemy.markers = []
}

export function createEnemyZoneApi(state, deps) {
  // mechanicState is the existing optional extension accessor. Do not initialize
  // state for a read; existing games must preserve their previous replay hashes.
  const all = () => deps.mechanicState(state)?.enemyZones || {}
  const validateZone = zone => { if (!plainZone(zone)) throw new TypeError('Invalid enemy zone') }
  const records = (zone, create = false) => {
    validateZone(zone)
    if (!create) return all()[zone] || []
    const data = deps.mechanicState(state, true)
    data.enemyZones ||= {}
    return data.enemyZones[zone] ||= []
  }
  const contains = id => Object.values(all()).some(zone => zone.some(record => record.enemy.id === id))
  const store = (enemy, zone, { clearTokens = true, ready = true } = {}) => {
    validateZone(zone)
    if (!enemy?.id || state.enemies.some(e => e.id === enemy.id) || contains(enemy.id)
      || state.victoryDisplay?.some(card => card.id === enemy.id)) return null
    const lastLocation = enemy.location || null
    if (clearTokens) clearEnemyTokensForZone(enemy)
    if (ready) enemy.exhausted = false // Reset out of play, not a Ready reaction.
    enemy.engagedSeat = null
    enemy.defeated = false
    delete enemy.defeatedBy
    delete enemy.lastDamageSource
    enemy.location = null
    records(zone, true).push({ enemy, lastLocation })
    return enemy.id
  }
  return {
    list: zone => records(zone).map(record => record.enemy),
    get: (zone, id) => records(zone).find(record => record.enemy.id === id)?.enemy || null,
    contains,
    isInactive: id => contains(id) && !state.enemies.some(enemy => enemy.id === id),
    enter(enemyOrId, zone, options = {}) {
      validateZone(zone)
      const enemy = state.enemies.find(e => e.id === (typeof enemyOrId === 'string' ? enemyOrId : enemyOrId?.id))
      if (!enemy || contains(enemy.id)) return null
      // Parent extracts one common leave-play operation from existing cleanup.
      // It releases seals, disposes player attachments, disengages and removes
      // from active enemies. It must honor preserveKeys for effect -> depths.
      deps.leavePlay(enemy, { reason: 'zone', preserveKeys: options.preserveKeys !== false,
        responsibleSeat: options.responsibleSeat ?? null })
      return store(enemy, zone, options)
    },
    // Internal only: defeat cleanup has ALREADY happened. Do not publish this
    // method to card APIs; the accepted defeat dispatcher is its sole caller.
    storeDeparted: store,
    restore(zone, id, { location, engageSeat = null, exhausted = false } = {}) {
      const pile = records(zone), index = pile.findIndex(record => record.enemy.id === id)
      const record = pile[index]
      if (!record || typeof exhausted !== 'boolean' || !deps.locationExists(location) || (engageSeat != null
        && (!state.investigators[engageSeat] || state.investigators[engageSeat].defeated || state.investigators[engageSeat].resigned))
        || !deps.canEnter(record.enemy, location)) return null
      pile.splice(index, 1)
      const enemy = record.enemy
      enemy.location = location
      enemy.engagedSeat = null
      enemy.exhausted = exhausted
      // Must reuse THIS object/id and existing id sequence. Callback runs the
      // real spawn/entry hooks and one intended engagement, without Revelation.
      deps.enterExisting(enemy, { location, engageSeat, exhausted, revelation: false, reason: 'spawnFromZone' })
      return enemy
    },
  }
}

export function validateEnemyZones(state, data) {
  if (data == null) return
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Invalid enemy zones save')
  const ids = new Set([...(state.enemies || []).map(enemy => enemy.id), ...(state.victoryDisplay || []).map(card => card.id)])
  for (const [zone, records] of Object.entries(data)) {
    if (!plainZone(zone) || !Array.isArray(records)) throw new TypeError('Invalid enemy zone save')
    for (const record of records) {
      if (!record || Object.keys(record).some(key => !['enemy', 'lastLocation'].includes(key))
        || !record.enemy || typeof record.enemy.id !== 'string' || !enemyCode(record.enemy)
        || record.enemy.location !== null || record.enemy.engagedSeat !== null
        || ids.has(record.enemy.id) || record.lastLocation != null && typeof record.lastLocation !== 'string') {
        throw new TypeError('Invalid or duplicated out-of-play enemy')
      }
      ids.add(record.enemy.id)
    }
  }
}

// For holder validation only. Combat/target enumeration must remain active-only.
export function enemyForKeyHolder(state, id) {
  return state.enemies.find(enemy => enemy.id === id)
    || Object.values(state.scenarioFlags?.mechanics?.enemyZones || {}).flat().find(record => record.enemy.id === id)?.enemy
    || null
}

