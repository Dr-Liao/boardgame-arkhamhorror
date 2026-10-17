// Card provenance is independent of the campaign being played. Keep the old
// monthly packs together with their campaign, while retaining exact pack filters.
const SERIES = [
  ['core','基础 · 夜之狂热','core rcore core_2026'],
  ['dwl','敦威治遗产','dwl tmm tece bota uau wda litas'],
  ['ptc','卡尔克萨之路','ptc eotp tuo apot tpm bsr dca'],
  ['tfa','失落的时代','tfa tof tbb hote tcoa tdoy sha'],
  ['tcu','万象无终','tcu tsn wos fgg uad icc bbt'],
  ['tde','食梦者','tde sfk tsh dsm pnr wgd woc'],
  ['tic','印斯茅斯阴谋','tic itd def hhg lif lod itm'],
  ['eoe','地球边缘','eoep eoec'], ['tsk','绯红密钥','tskp tskc'],
  ['fhv','铁杉谷盛宴','fhvp fhvc'], ['tdc','沉没之城','tdcp tdcc'],
  ['rtnotz','重返夜之狂热','rtnotz'], ['rtdwl','重返敦威治遗产','rtdwl'],
  ['rtptc','重返卡尔克萨之路','rtptc'], ['rttfa','重返失落的时代','rttfa'], ['rttcu','重返万象无终','rttcu'],
  ['starter','调查员起始包','nat har win jac ste tom car and mar mig'],
]
const packSeries = new Map(SERIES.flatMap(([id,name,packs])=>packs.split(' ').map(pack=>[pack,{id,name}])))
const packNames = {core:'基础包',rcore:'修订基础包',core_2026:'基础包（2026）'}
export function cardSource(card) {
  const pack = card.pack || card.packCode || ''
  const series = packSeries.get(pack)
  return { pack, packName:packNames[pack] || (series?.id===pack ? series.name : '') || card.packName || pack || '未标注来源',
    id:card.campaignCode || series?.id || pack || 'unknown',
    name:card.campaignName || series?.name || card.packName || pack || '未标注来源' }
}
const factions = card=>card.factions || [card.klass,card.klass2,card.klass3,card.faction2,card.faction3].filter(Boolean)
export function filterCards(cards, filters={}) {
  const query=(filters.search || '').trim().toLowerCase()
  return cards.filter(card=>{
    const source=cardSource(card)
    return (!filters.type || card.type===filters.type)
      && (!filters.klass || factions(card).includes(filters.klass))
      && (!filters.cost || (filters.cost==='4+' ? typeof card.cost==='number' && card.cost>=4 : String(card.cost)===filters.cost))
      && (!filters.xp || (typeof card.xp==='number' && (filters.xp==='5+' ? card.xp>=5 : String(card.xp)===filters.xp)))
      && (!filters.campaign || source.id===filters.campaign)
      && (!filters.pack || source.pack===filters.pack)
      && (!query || [card.name,card.nameZh,card.nameEn,card.code,...factions(card),card.type,card.cost,card.xp,
        ...(card.traits || []),...(card.traitsZh || []),source.name,source.packName].join(' ').toLowerCase().includes(query))
  }).sort((a,b)=>filters.sort==='cost' ? (Number(a.cost)||0)-(Number(b.cost)||0) || String(a.name).localeCompare(String(b.name),'zh')
    : filters.sort==='name' ? String(a.name).localeCompare(String(b.name),'zh') : 0)
}
export function renderCardFilters(h,{cards=[],filters,scope,onChange,count,options,searchLabel='搜索卡牌'}) {
  const classes={guardian:'守护者',seeker:'探求者',rogue:'流浪者',mystic:'潜修者',survivor:'生存者',neutral:'中立',mythos:'神话'}
  const unique=values=>[...new Map(values).entries()]
  const sources=options?.packs ? options.packs.map(pack=>cardSource({pack:pack.code,packName:pack.name})) : cards.map(cardSource)
  const select=(key,label,choices)=>h('label',{},label+' ',h('select',{
    'aria-label':key==='sort'?'卡牌排序':'筛选'+label,'data-focus-key':`${scope}:${key}`,
    onchange:event=>onChange({...filters,[key]:event.target.value,...(key==='campaign'?{pack:''}:{})}),
  },choices.map(([value,name])=>h('option',{value,selected:(filters[key] || '')===value},name))))
  return h('div',{className:'ah-card-filters','data-filter-scope':scope},
    h('div',{className:'ah-office-filters'},
      h('input',{value:filters.search || '',type:'text','aria-label':searchLabel,placeholder:'搜索卡号、名称、职业或特性…','data-focus-key':`${scope}:search`,
        oninput:event=>{
          const cursor=event.target.selectionStart
          onChange({...filters,search:event.target.value})
          queueMicrotask(()=>{
            const input=document.querySelector(`[data-filter-scope="${scope}"] input`)
            input?.focus({preventScroll:true});input?.setSelectionRange(cursor,cursor)
          })
        }}),
      [['','全部'],['asset','资产'],['event','事件'],['skill','技能']].map(([value,label])=>h('button',{
        'aria-pressed':String((filters.type || '')===value),'data-focus-key':`${scope}:type:${value}`,
        onclick:()=>onChange({...filters,type:value}),
      },label))),
    h('div',{className:'ah-builder-tools'},
      options?.types ? select('type','类型',[['','全部类型'],...options.types.map(t=>[t.code,options.typeLabels?.[t.code]||t.name||t.code])]) : null,
      select('klass','职业',[['','所有职业'],...(options?.classes ? options.classes.map(c=>[c.code,classes[c.code]||c.name||c.code]) : unique(cards.flatMap(c=>factions(c).map(f=>[f,classes[f] || f]))))]),
      select('cost','费用',[['','不限'],...['0','1','2','3','4+'].map(v=>[v,v])]),
      select('xp','经验',[['','不限经验'],...['0','1','2','3','4','5+'].map(v=>[v,`${v} XP`])]),
      select('campaign','战役',[['','所有战役 / 系列'],...unique(sources.map(s=>[s.id,s.name]))]),
      select('pack','扩展包',[['','所有扩展包'],...unique(sources.filter(s=>!filters.campaign || s.id===filters.campaign).map(s=>[s.pack,s.packName]))]),
      select('sort','排序',[['','默认'],['cost','费用'],['name','名称']]),
      h('button',{'data-focus-key':`${scope}:clear`,onclick:()=>onChange({})},'清除筛选'),
      h('small',{role:options?null:'status',title:'经验按卡面等级筛选；实际升级消耗以结算为准。'},`${count} / ${options?.total??cards.length} 种卡牌`)))
}
