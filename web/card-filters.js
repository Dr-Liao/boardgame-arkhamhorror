// Card provenance is independent of the campaign being played. Keep the old
// monthly packs together with their campaign, while retaining exact pack filters.
// 系列/扩展包名是界面文案（不是卡牌内容数据）：表里只存 key，在 cardSource() 调用期再 t()，
// 模块顶层不调用 t()（否则导入时就把默认语言固化下来）。
import { t } from './i18n.js'
const SERIES = [
  ['core','filter.series.core','core rcore core_2026'],
  ['dwl','filter.series.dwl','dwl tmm tece bota uau wda litas'],
  ['ptc','filter.series.ptc','ptc eotp tuo apot tpm bsr dca'],
  ['tfa','filter.series.tfa','tfa tof tbb hote tcoa tdoy sha'],
  ['tcu','filter.series.tcu','tcu tsn wos fgg uad icc bbt'],
  ['tde','filter.series.tde','tde sfk tsh dsm pnr wgd woc'],
  ['tic','filter.series.tic','tic itd def hhg lif lod itm'],
  ['eoe','filter.series.eoe','eoep eoec'], ['tsk','filter.series.tsk','tskp tskc'],
  ['fhv','filter.series.fhv','fhvp fhvc'], ['tdc','filter.series.tdc','tdcp tdcc'],
  ['rtnotz','filter.series.rtnotz','rtnotz'], ['rtdwl','filter.series.rtdwl','rtdwl'],
  ['rtptc','filter.series.rtptc','rtptc'], ['rttfa','filter.series.rttfa','rttfa'], ['rttcu','filter.series.rttcu','rttcu'],
  ['starter','filter.series.starter','nat har win jac ste tom car and mar mig'],
]
const packSeries = new Map(SERIES.flatMap(([id,key,packs])=>packs.split(' ').map(pack=>[pack,{id,key}])))
const packNameKeys = {core:'filter.pack.core',rcore:'filter.pack.rcore',core_2026:'filter.pack.core_2026'}
export function cardSource(card) {
  const pack = card.pack || card.packCode || ''
  const series = packSeries.get(pack), seriesName = series ? t(series.key) : ''
  return { pack, packName:(packNameKeys[pack] ? t(packNameKeys[pack]) : '') || (series?.id===pack ? seriesName : '') || card.packName || pack || t('filter.source.unknown'),
    id:card.campaignCode || series?.id || pack || 'unknown',
    name:card.campaignName || seriesName || card.packName || pack || t('filter.source.unknown') }
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
export function renderCardFilters(h,{cards=[],filters,scope,onChange,count,options,searchLabel}) {
  const classes={guardian:t('filter.class.guardian'),seeker:t('filter.class.seeker'),rogue:t('filter.class.rogue'),mystic:t('filter.class.mystic'),survivor:t('filter.class.survivor'),neutral:t('filter.class.neutral'),mythos:t('filter.class.mythos')}
  const unique=values=>[...new Map(values).entries()]
  const sources=options?.packs ? options.packs.map(pack=>cardSource({pack:pack.code,packName:pack.name})) : cards.map(cardSource)
  const select=(key,label,choices)=>h('label',{},label+' ',h('select',{
    'aria-label':key==='sort'?t('filter.sortAria'):t('filter.selectAria',{label}),'data-focus-key':`${scope}:${key}`,
    onchange:event=>onChange({...filters,[key]:event.target.value,...(key==='campaign'?{pack:''}:{})}),
  },choices.map(([value,name])=>h('option',{value,selected:(filters[key] || '')===value},name))))
  return h('div',{className:'ah-card-filters','data-filter-scope':scope},
    h('div',{className:'ah-office-filters'},
      h('input',{value:filters.search || '',type:'text','aria-label':searchLabel || t('filter.search'),placeholder:t('filter.searchPlaceholder'),'data-focus-key':`${scope}:search`,
        oninput:event=>{
          const cursor=event.target.selectionStart
          onChange({...filters,search:event.target.value})
          queueMicrotask(()=>{
            const input=document.querySelector(`[data-filter-scope="${scope}"] input`)
            input?.focus({preventScroll:true});input?.setSelectionRange(cursor,cursor)
          })
        }}),
      [['','filter.type.all'],['asset','filter.type.asset'],['event','filter.type.event'],['skill','filter.type.skill']].map(([value,labelKey])=>h('button',{
        'aria-pressed':String((filters.type || '')===value),'data-focus-key':`${scope}:type:${value}`,
        onclick:()=>onChange({...filters,type:value}),
      },t(labelKey)))),
    h('div',{className:'ah-builder-tools'},
      options?.types ? select('type',t('filter.field.type'),[['',t('filter.option.allTypes')],...options.types.map(type=>[type.code,options.typeLabels?.[type.code]||type.name||type.code])]) : null,
      select('klass',t('filter.field.klass'),[['',t('filter.option.allClasses')],...(options?.classes ? options.classes.map(c=>[c.code,classes[c.code]||c.name||c.code]) : unique(cards.flatMap(c=>factions(c).map(f=>[f,classes[f] || f]))))]),
      select('cost',t('filter.cost'),[['',t('filter.option.any')],...['0','1','2','3','4+'].map(v=>[v,v])]),
      select('xp',t('filter.field.xp'),[['',t('filter.option.anyXp')],...['0','1','2','3','4','5+'].map(v=>[v,`${v} XP`])]),
      select('campaign',t('filter.field.campaign'),[['',t('filter.option.allCampaigns')],...unique(sources.map(s=>[s.id,s.name]))]),
      select('pack',t('filter.field.pack'),[['',t('filter.option.allPacks')],...unique(sources.filter(s=>!filters.campaign || s.id===filters.campaign).map(s=>[s.pack,s.packName]))]),
      select('sort',t('filter.field.sort'),[['',t('filter.option.default')],['cost',t('filter.cost')],['name',t('filter.option.name')]]),
      h('button',{'data-focus-key':`${scope}:clear`,onclick:()=>onChange({})},t('filter.clear')),
      h('small',{role:options?null:'status',title:t('filter.countNote')},t('filter.count',{count,total:options?.total??cards.length}))))
}
