const ICONS = new Set(['willpower','intellect','combat','agility','wild','wildMinus'])
const integer = n => Number.isSafeInteger(n) && n >= 0

// Count printed icon occurrences, not their contribution to a skill test.
// Source SkillIconCost n mempty counts WildIcon and WildMinusIcon as occurrences.
export function printedIconCount(definition) {
  return Object.entries(definition?.icons || {}).reduce((sum,[kind,count]) =>
    sum + (ICONS.has(kind) && Number.isSafeInteger(count) ? Math.abs(count) : 0), 0)
}

export function createDiscardCostApi(state, deps) {
  const counts = cost => {
    const value = { ordinary: cost.discardHand ?? 0, icons: cost.discardHandIcons ?? 0,
      assets: cost.discardControlledAsset ?? 0 }
    return Object.values(value).every(integer) ? value : null
  }
  const handRows = (inv,cost) => {
    const ordinary = new Set(deps.discardableHandCards(inv,cost.discardHandIcon).map(row=>row.index))
    return deps.discardableHandCards(inv).map(row=>({ ...row,
      icons: printedIconCount(deps.printedCard(row.code)), ordinary: ordinary.has(row.index) }))
  }
  const assetRows = (inv,cost,source) => {
    const reserved = new Set((cost.discardSelf || cost.exileSelf) && inv.assets.some(a=>a.id===source?.id) ? [source.id] : [])
    return [...new Map(inv.assets.filter(a=>!reserved.has(a.id) && deps.canDiscardControlledAsset(state,inv,a))
      .map(asset=>[asset.id,asset])).values()]
  }
  // The cheapest k ordinary discards leave the greatest possible icon total.
  // Thus this is an exact feasibility check without exponential subset search.
  const feasible = (rows,ordinary,icons) => {
    const eligible=rows.filter(row=>row.ordinary).sort((a,b)=>a.icons-b.icons)
    if(eligible.length<ordinary)return false
    const retained=rows.reduce((sum,row)=>sum+row.icons,0)-eligible.slice(0,ordinary).reduce((sum,row)=>sum+row.icons,0)
    return retained>=icons
  }
  const available = (inv,cost,source) => {
    const need=counts(cost)
    return !!need && feasible(handRows(inv,cost),need.ordinary,need.icons)
      && assetRows(inv,cost,source).length>=need.assets
  }
  return {available,pay(inv,cost,source,events) {
    if(!available(inv,cost,source))return false
    const need=counts(cost)
    for(let remaining=need.ordinary;remaining>0;remaining--){
      const rows=handRows(inv,cost),choices=rows.filter(row=>row.ordinary&&feasible(rows.filter(other=>other.index!==row.index),remaining-1,need.icons))
      const id=deps.choose({kind:'discard',source:{type:'cost',kind:'discardHand',code:source?.code},seat:inv.seat,canSkip:false,prompt:'支付费用：弃掉一张手牌。',options:choices.map(row=>({id:String(row.index),cardCode:row.code,label:deps.cardName(row.code)}))})
      const row=choices.find(row=>String(row.index)===id)
      if(!row||!discardOneHandCardAsCost(state,inv,row.index,row.code,events,deps))throw new Error('Mandatory hand payment failed')
    }
    for(let remaining=need.icons;remaining>0;){
      const choices=handRows(inv,cost).filter(row=>row.icons>0)
      const id=deps.choose({kind:'discard',source:{type:'cost',kind:'discardHandIcons',code:source?.code},seat:inv.seat,canSkip:false,prompt:`支付费用：还需至少${remaining}个技能图标。`,options:choices.map(row=>({id:String(row.index),cardCode:row.code,label:`${deps.cardName(row.code)}（${row.icons}图标）`}))})
      const row=choices.find(row=>String(row.index)===id)
      if(!row||!discardOneHandCardAsCost(state,inv,row.index,row.code,events,deps))throw new Error('Mandatory printed-icon payment failed')
      remaining-=row.icons
    }
    for(let remaining=need.assets;remaining>0;remaining--){
      const choices=assetRows(inv,cost,source)
      const id=deps.choose({kind:'discard-asset',source:{type:'cost',kind:'discardControlledAsset',code:source?.code},seat:inv.seat,canSkip:false,prompt:'支付费用：弃掉你控制的一个支援。',options:choices.map(asset=>({id:asset.id,cardCode:asset.code,label:deps.cardName(asset.code)}))})
      if(!choices.some(asset=>asset.id===id)||!discardControlledAssetAsCost(state,inv,id,events,deps))throw new Error('Mandatory controlled-asset payment failed')
    }
    return true
  }}
}
export function discardOneHandCardAsCost(state,inv,index,expectedCode,events,deps) {
  if(inv.hand[index]!==expectedCode || !deps.discardableHandCards(inv).some(row=>row.index===index))return false
  const [code]=inv.hand.splice(index,1)
  deps.discardPlayerCards(state,inv,code)
  deps.afterHandDiscard(state,inv,code,events,deps.reactionWindow,deps.cardName)
  return true
}
export function discardControlledAssetAsCost(state,inv,assetId,events,deps) {
  const asset=inv.assets.find(asset=>asset.id===assetId)
  if(!deps.canDiscardControlledAsset(state,inv,asset))return false
  const result=deps.leaveAsset(state,inv,asset,events,{reason:'discard'})
  if(result===false || inv.assets.some(current=>current.id===assetId))return false
  if(!asset.removedFromGame && !asset.returnedToHand){
    const owner=state.investigators[asset.ownerSeat??inv.seat]||inv
    deps.discardPlayerCards(state,owner,asset.code)
  }
  return true
}
