// Read-only graph query. Unreachable enemies remain candidates only when the
// printed fallback explicitly permits them.
export function nearestEnemies(state,from,{predicate=()=>true,fallback=false}={}) {
 const origin=typeof from==='string'?from:from?.location
 const pool=state.enemies.filter(enemy=>!enemy.defeated&&!enemy.removedFromGame&&predicate(enemy))
 const distance=new Map([[origin,0]]),queue=[origin]
 for(const id of queue)for(const next of state.locations.find(loc=>loc.id===id)?.connections||[]){
  if(distance.has(next)||!state.locations.some(loc=>loc.id===next))continue
  distance.set(next,distance.get(id)+1);queue.push(next)
 }
 const best=Math.min(...pool.map(enemy=>distance.get(enemy.location)??Infinity))
 return Number.isFinite(best)?pool.filter(enemy=>distance.get(enemy.location)===best):fallback?pool:[]
}

export function isEnemyUnengaged(state,enemy,engagedWith) {
 return state.enemies.includes(enemy)&&!state.investigators.some(inv=>!inv.defeated&&!inv.resigned&&engagedWith(state,inv).includes(enemy))
}
