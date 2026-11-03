import { ALL_CARDS } from '../cards/cards-data.js'
export function wouldAddToVictory(enemy,enemyDef=()=>null) {
 const def=enemyDef(enemy.code),code=enemy.originalCode||def?.originalCode||enemy.code
 return Object.hasOwn(ALL_CARDS[code]||{},'victory')||enemy.victory>0||(enemy.vengeance||def?.vengeance||0)>0||!!enemy.uniqueCultist
}
