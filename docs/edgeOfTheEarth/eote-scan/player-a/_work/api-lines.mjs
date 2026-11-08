import fs from 'node:fs'
const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror/src/engine'
const files = ['api-misc.js', 'api-card.js', 'api-clue.js', 'api-enemy.js', 'api-test.js', 'api-mechanics.js', 'combat.js', 'ability-rules.js', 'ability-exec.js', 'encounter.js', 'deck-ops.js', 'actions.js', 'enemies.js', 'harm-threat.js', 'modifiers.js', 'stats.js', 'tests.js', 'turn.js', 'turn-flow.js', 'phases.js', 'effect-state.js', 'setup.js', 'movement.js', 'hidden-rules.js', 'player-mechanics.js', 'look.js']
const names = ['putIntoPlay', 'discoverClue', 'removeDoom', 'addUses', 'setAssetUses', 'addLocationTrait', 'removeLocationTrait', 'setScenarioFlag', 'spendResources', 'gainResources', 'healDamage', 'healHorror', 'discardAsset', 'discardFromHand', 'discardTopOfDeck', 'shuffleDeck', 'moveCard', 'investigatorsAt', 'playCard', 'playCardFromDiscard', 'exhaust', 'damage', 'healAsset', 'enemiesAt', 'engage', 'autoEvadeEnemy', 'disengageAll', 'spawnEncounterEnemy', 'drawEncounter', 'cardFactions', 'cardType', 'cardName', 'locName', 'locationName', 'investigate', 'moveInvestigator', 'cancelCurrentAttack', 'enemyAttackByCard', 'reactionContext', 'playerTools', 'turnBegins', 'upkeepEnd', 'mythosEncounterStep', 'clueDiscovered', 'investigateSuccess', 'assetEnteredPlay', 'testBegins', 'testEnds', 'enemyAttacked', 'harmAssigned', 'assetHarmPlaced', 'defeatEnemy', 'cardDrawn', 'encounterDrawn', 'investigationPhaseStarts']
const out = []
for (const name of names) {
  const hits = []
  for (const f of files) {
    const p = MOD + '/' + f
    if (!fs.existsSync(p)) continue
    const lines = fs.readFileSync(p, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (new RegExp(`\\b${name}\\s*:`).test(line) || new RegExp(`function ${name}\\b`).test(line)) hits.push(`${f}:${i + 1}`)
      else if (new RegExp(`triggerReaction\\([^)]*'${name}'|reactionWindow\\([^)]*'${name}'`).test(line)) hits.push(`${f}:${i + 1}(window)`)
    })
  }
  out.push(`${name} => ${hits.slice(0, 5).join(' , ') || 'NOT FOUND'}`)
}
fs.writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a/_work/api-lines.txt', out.join('\n'), 'utf8')
console.log(out.join('\n'))
