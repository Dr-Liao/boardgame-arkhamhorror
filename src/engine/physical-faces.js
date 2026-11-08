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

// 支援双面翻面（P2，七循环）：同一张印刷卡的 Unbroken/Broken 两面在卡表里是两个卡号，
// 可能没有 linkedToCode 元数据，因此调用方可以显式提供成对卡号（pairs）来声明这次翻面合法。
// 所有印刷字段替换仍走 planPhysicalFace(...,{kind:'asset'})：实例 id / 横置 / 控制权 / 附属
// 保持不动；本函数只负责「这一对卡号是否被声明为同一张卡的两面」与定义注入。
const normalizeFacePairs = pairs => {
  if(pairs==null)return []
  if(!Array.isArray(pairs))throw new TypeError('Asset face pairs must be an array')
  return pairs.map(pair=>{
    const [a,b]=Array.isArray(pair)?pair:[pair?.a??pair?.unbrokenCode,pair?.b??pair?.brokenCode]
    if(typeof a!=='string'||!a||typeof b!=='string'||!b||a===b)throw new TypeError('Invalid asset face pair')
    return [a,b]
  })
}

export function planAssetFaceFlip(entity,nextCode,{definitionFor,pairs=null}={}) {
  if(!entity||typeof entity!=='object')throw new TypeError('Asset face flip requires an in-play entity')
  if(typeof nextCode!=='string'||!nextCode)throw new TypeError('Asset face flip requires the next face code')
  if(typeof definitionFor!=='function')throw new TypeError('Asset face flip requires definitionFor')
  const pairList=normalizeFacePairs(pairs)
  const from=entity.originalCode||entity.code
  if(typeof from!=='string'||!from)throw new TypeError('Asset face flip requires a source card code')
  const declaredPair=pairList.some(([a,b])=>(a===from&&b===nextCode)||(a===nextCode&&b===from))
  if(pairList.length&&!declaredPair)throw new TypeError('Asset faces are not a declared pair')
  // 显式成对声明时补上 linked 元数据，之后完全复用通用的同卡双面替换逻辑；
  // 未提供 pairs 时按印刷 linkedToCode/linkedCardCode 判定（既有敌人换面同一口径）。
  const definition=code=>{
    const def=definitionFor(code)
    if(!def||!declaredPair)return def
    const other=code===from?nextCode:from
    return {...def,linkedToCode:def.linkedToCode||other,linkedCardCode:def.linkedCardCode||other}
  }
  return planPhysicalFace(entity,nextCode,{kind:'asset',definitionFor:definition})
}
