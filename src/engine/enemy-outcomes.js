const plainZone=zone=>typeof zone==='string'&&/^[a-z][A-Za-z0-9]{0,63}$/.test(zone)&&!['constructor','prototype'].includes(zone)
export function createEnemyOutcomeApi(state, deps) {
  const acceptedDefeat = context => context?.kind === 'defeat' && context.phase === 'when' && context.accepted === true
  return {
    // Called at the TOP of defeatEnemy, and before any successful-evade outcome.
    // The old wouldDefeat window belongs to investigators; do not reuse it.
    begin(kind, enemy, { seat = null, source = null } = {}) {
      if (!['defeat', 'evade'].includes(kind) || !state.enemies.includes(enemy)) return null
      const context = { kind, phase: 'would', enemy, seat, sourceSeat: seat, source,
        location: enemy.location, replaced: false, cancelled: false }
      return deps.interrupt(kind === 'defeat' ? 'enemyWouldBeDefeated' : 'enemyWouldBeEvaded', context) || context
    },
    replace(context, { healAllDamage = false, ready = false, doom = 0 } = {}) {
      if (context?.phase !== 'would' || context.replaced || context.cancelled || !state.enemies.includes(context.enemy)
        || !Number.isSafeInteger(doom) || doom < 0) return false
      context.replaced = true
      if (healAllDamage) context.enemy.damageTaken = 0
      if (ready) deps.readyEnemy(context.enemy)
      if (doom) deps.placeDoomOnCard(context.enemy, doom)
      return true
    },
    // begin accepted normal-defeat window only AFTER the common leave cleanup.
    accepted(context) {
      if (!context || context.replaced || context.cancelled || context.kind !== 'defeat') return false
      context.accepted = true; context.phase = 'when'; context.destinations = []
      return true
    },
    destination(context, destination, { sourceId = null } = {}) {
      if (!acceptedDefeat(context) || context.destinationCommitted
        || !destination || !['enemyZone', 'scenarioDeck'].includes(destination.kind)
        || !plainZone(destination.id)) return false
      const candidate = { ...destination, sourceId }
      if (!context.destinations.some(item => JSON.stringify(item) === JSON.stringify(candidate))) context.destinations.push(candidate)
      return true
    },
    takeClues(context, seat, count = 'all') {
      if (!acceptedDefeat(context) || !state.investigators[seat] || state.investigators[seat].defeated || state.investigators[seat].resigned
        || count !== 'all' && (!Number.isSafeInteger(count) || count < 0)) return 0
      const amount = Math.min(context.enemy.clues || 0, count === 'all' ? Infinity : count)
      context.enemy.clues = (context.enemy.clues || 0) - amount
      state.investigators[seat].clues += amount
      deps.syncClues()
      if (amount) deps.cluesGained?.(seat, amount)
      return amount
    },
    // Returns false for ordinary addVictory/discard. True replaces ONLY that
    // destination; the caller must STILL run defeatEnemy/defeatAtLocation afters.
    commitDestination(context) {
      if (!acceptedDefeat(context) || context.destinationCommitted || !context.destinations.length) return false
      // These declarations replace DISCARDING only. addVictory currently owns
      // both Victory placement and ordinary discard, so query before calling it.
      // The dependency is mandatory and must use the same pure predicate as
      // addVictory, including printed Victory0, vengeance and uniqueCultist.
      if (deps.wouldAddToVictory(context.enemy)) return false
      const candidates = context.destinations
      const index = candidates.length === 1 ? 0 : deps.chooseDestination(context, candidates)
      const target = candidates[index]
      if (!target) throw new Error('Invalid defeat destination selection')
      if (target.kind === 'enemyZone') {
        if (!deps.zones.storeDeparted(context.enemy, target.id, target)) throw new Error('Enemy destination would duplicate entity')
      } else {
        // Existing encounter piles may use bound rule aliases such as
        // ghoulMinion. Preserve a drawable code; originalCode is metadata.
        const code = deps.encounterCodeFor?.(context.enemy) || context.enemy.code
        deps.scenarioDecks.put(target.id, [code], { shuffle: target.shuffle !== false })
      }
      context.destinationCommitted = true
      return true
    },
  }
}

