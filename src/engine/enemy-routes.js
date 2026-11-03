import { barrierCount } from './edge-barriers.js'

// Feed this helper the FINAL prey/target choice selected by the existing
// hunterStep target policy, before considering barriers. Do not reselect prey
// to make a blocked route easier. Physical cannot-enter rules always apply.
export function hunterRouteCandidates(state,enemy,targetIds,deps) {
  const targets=new Set(targetIds)
  if(!targets.size||targets.has(enemy.location))return {destinations:[],ignoresBarriers:false}
  for(const key of ['connections','canEnter'])if(typeof deps?.[key]!=='function')throw new TypeError(`Hunter route missing ${key}`)
  function search(ignoreBarriers) {
    let best=Infinity
    const firstSteps=new Set(),queue=[{id:enemy.location,first:null,distance:0}]
    // Same cell can be reached through more than one shortest FIRST edge.
    // Retain each pair, otherwise tied legal routes can disappear.
    const distance=new Map([[enemy.location,0]])
    const seen=new Set()
    for(let cursor=0;cursor<queue.length;cursor++) {
      const row=queue[cursor]
      if(row.distance>best)continue
      if(targets.has(row.id)) {best=row.distance;if(row.first)firstSteps.add(row.first);continue}
      for(const next of deps.connections(row.id)) {
        if(!state.locations.some(loc=>loc.id===next)||!deps.canEnter(enemy,next))continue
        if(!ignoreBarriers&&barrierCount(state,row.id,next)>0)continue
        const d=row.distance+1,first=row.first||next
        if(next===enemy.location||d>best||d>(distance.get(next)??Infinity))continue
        const key=JSON.stringify([next,first,d])
        if(seen.has(key))continue
        seen.add(key);distance.set(next,d);queue.push({id:next,first,distance:d})
      }
    }
    return [...firstSteps]
  }
  if(deps.ignoreBarriers)return {destinations:search(true),ignoresBarriers:true}
  const open=search(false)
  return open.length?{destinations:open,ignoresBarriers:false}:{destinations:search(true),ignoresBarriers:true}
}

