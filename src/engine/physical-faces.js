const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key)
const clone=value=>structuredClone(value)
const ENEMY_FIELDS=['name','fight','evade','health','healthPerInvestigator','damage','horror','victory','traits','keywords','prey','spawn','swarming']
const ENEMY_FLAGS=['hunter','massive','retaliate','aloof','alert','elite']
const ASSET_FIELDS=['name','traits','slots','health','sanity','unique','permanent']
const paired=(a,b)=>[a.linkedToCode,a.linkedCardCode].includes(b.code)||[b.linkedToCode,b.linkedCardCode].includes(a.code)

// The normalizer is injected, so missing numeric metadata is never confused
// with an explicitly null stat. Both enemy faces must have explicit stat keys.
export function planPhysicalFace(entity,nextCode,{kind,definitionFor}) {
  if(!['enemy','asset'].includes(kind))throw new TypeError('Invalid physical face kind')
  const current=definitionFor(entity.originalCode||entity.code),next=definitionFor(nextCode)
  if(!current||!next||current.type!==kind||next.type!==kind||current.code!==next.code&&!paired(current,next))throw new TypeError('Unrelated or cross-kind face replacement')
  if(kind==='enemy')for(const key of ['fight','evade','health']){
    if(!own(next,key)||next[key]!==null&&!Number.isFinite(next[key]))throw new TypeError(`Next enemy face needs explicit ${key}`)
  }
  const fields=kind==='enemy'?ENEMY_FIELDS:ASSET_FIELDS
  const set={code:nextCode,originalCode:nextCode},remove=[]
  for(const key of fields){
    if(own(next,key))set[key]=clone(next[key])
    else remove.push(key)
  }
  if(kind==='enemy')for(const key of ENEMY_FLAGS)set[key]=next[key]===true
  return {kind,from:entity.originalCode||entity.code,to:nextCode,set,remove}
}

// Which in-play channel currently owns this physical object ('enemy' | 'asset'),
// or null when it is not in play at all. Shared by apply and probe so the two
// can never disagree about whether the object is a legal physical source.
function inPlayKind(state,entity) {
  if(!entity||!state)return null
  if((state.enemies||[]).includes(entity))return 'enemy'
  if((state.storyAssets||[]).includes(entity))return 'asset'
  if((state.investigators||[]).some(inv=>inv.assets?.includes(entity)))return 'asset'
  return null
}

// Probe variant of applyPhysicalFace for callers that must keep their own
// "no matching face" semantics. Returns null instead of throwing whenever the
// source is out of play or the replacement is not a real same-kind pair, so a
// card-driven flip never turns "unknown next face" into an engine exception.
export function physicalFacePlanIfAny(state,entity,nextCode,deps) {
  const kind=inPlayKind(state,entity)
  if(!kind)return null
  try{return planPhysicalFace(entity,nextCode,{...deps,kind})}catch{return null}
}

// Replace printed characteristics in the same physical object. Counts, id,
// exhaustion, controller, location, attachments and every external id reference
// remain untouched. No play/enter/leave/spawn/revelation hook is simulated.
export function applyPhysicalFace(state,entity,nextCode,deps) {
  const kind=inPlayKind(state,entity)
  if(!kind)throw new TypeError('Physical source is not currently in play')
  const plan=planPhysicalFace(entity,nextCode,{...deps,kind})
  if(plan.from===plan.to)return {entity,changed:false,from:plan.from,to:plan.to}
  for(const key of plan.remove)delete entity[key]
  Object.assign(entity,plan.set)
  if(kind==='enemy')entity.printedAloof=entity.aloof
  // Main should inject an actual auto-engagement recheck for a ready waking
  // enemy, then its one generic faceChanged event. Do not replay old windows.
  deps.afterApplied?.(entity,{kind,from:plan.from,to:plan.to})
  return {entity,changed:true,from:plan.from,to:plan.to}
}


export function normalizedFace(state,code,{printed,enemyDefinition}) {
 const raw=printed(code)
 if(!raw)return null
 if(raw.type!=='enemy')return raw
 const def=enemyDefinition(code)||raw
 const health=def.health===null?null:def.healthPerInvestigator?def.healthPerInvestigator*state.numInvestigators:def.health+(def.healthPerPlayerBonus||0)*state.numInvestigators
 return {...raw,...def,type:'enemy',code,health}
}
