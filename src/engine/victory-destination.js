import { registeredEntry } from './ability.js'
import { ALL_CARDS } from '../cards/cards-data.js'
// Printed Victory 0 is a keyword and still sends the card to the victory display.
export const hasPrintedVictory = code => Object.hasOwn(ALL_CARDS[code] || {}, 'victory')

export function grantedEnemyVictory(state, enemy) {
  const act = state?.acts?.[state.actIndex]
  const rule = registeredEntry(act?.originalCode || act?.code)?.actRule?.grantsVictory
  const traits = enemy.traits || ALL_CARDS[enemy.originalCode || enemy.code]?.traits || []
  if (!rule || !traits.some(trait => String(trait).toLowerCase() === String(rule.trait).toLowerCase())) return null
  return rule.points ?? 0
}

export function wouldAddToVictory(enemy,enemyDef=()=>null,state=null) {
 const def=enemyDef(enemy.code),code=enemy.originalCode||def?.originalCode||enemy.code
 return enemy.enemyLocation===true||hasPrintedVictory(code)||enemy.victory>0||grantedEnemyVictory(state,enemy)!=null||(enemy.vengeance||def?.vengeance||0)>0||!!enemy.uniqueCultist
}
