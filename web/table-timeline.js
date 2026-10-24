import { t } from './i18n.js'
import { renderRulesText, symbolToken } from './card-text.js'
// 时间线里的行动标签：模块顶层只存 key，生成条目/渲染时再 t()（导入时求值会固化语言）。
const MOVE_KEYS = { draw:'table.move.draw',resource:'table.move.resource',move:'table.move.move',play:'table.move.play',fight:'table.move.fight',evade:'table.move.evade',investigate:'table.move.investigate',endTurn:'table.move.endTurn',ability:'table.move.ability',engage:'table.move.engage',resign:'table.move.resign' }
// 剧情事件的 event.text 只写一句「翻开…的背面」，卡面正文放在 presentation.text。
// 时间线是玩家回看推进文本的主要入口，这里补上正文；已写进 event.text 的段落不重复。
function timelineDetail(event) {
  const presentation = event.presentation
  if (presentation?.kind !== 'story' || typeof presentation.text !== 'string') return ''
  const detail = presentation.text.trim()
  return detail && !event.text.includes(detail) ? detail : ''
}
export function timelineEntries(session) {
  const entries = []
  for (const event of session.events || []) {
    if (event.type === 'info' && typeof event.text === 'string') {
      const detail = timelineDetail(event)
      entries.push({ id: event.seq, text: detail ? `${event.text} ${detail}` : event.text, phase: event.presentation?.phase })
    }
    else if (event.type === 'presentation' && event.kind === 'chaos') entries.push({ id: event.seq, text: t('table.timeline.chaos', { name: event.name || t('table.investigator'), token: symbolToken(event.token) }) })
    else if (event.type === 'presentation' && event.kind === 'test') entries.push({ id: event.seq, text: t('table.timeline.test', {
      name: event.name || t('table.investigator'),
      source: event.source?.name || t('table.test.generic'),
      result: event.success ? t('table.result.success') : t('table.result.failure'),
      value: event.value,
      difficulty: event.difficulty,
    }) })
    else if (event.type === 'move' && event.move?.action !== 'choose') {
      const name = session.state.investigators?.find(i => i.seat === event.seat)?.name || session.players?.[event.seat]?.name || t('table.investigator')
      const label = event.move?.label || (MOVE_KEYS[event.move?.action] ? t(MOVE_KEYS[event.move?.action]) : '')
      if (label) entries.push({ id: event.seq, text: t('table.timeline.move', { name, action: label }) })
    }
  }
  return entries.length ? entries : (session.state.log || []).map((text, id) => ({ id, text }))
}
export function timelineCardIndex(session) {
  const st=session.state, names=new Map()
  const identity=card=>card.originalCode||card.code||card.id
  const add=(card,priority=0)=>{
    if(!card||!identity(card))return
    for(const name of new Set([card.name,card.nameZh,card.nameEn].filter(name=>typeof name==='string'&&name.trim().length>=2))) {
      if(!names.has(name))names.set(name,new Map())
      const group=names.get(name),id=identity(card),old=group.get(id)
      if(!old||priority>old.priority)group.set(id,{card,priority})
    }
  }
  for(const [code,card] of Object.entries(st.cards||{}))add({...card,code:card.code||code})
  for(const card of Object.values(st.investigatorDefs||{}))add(card)
  const known=card=>typeof card==='string'?st.cards?.[card]:{...st.cards?.[card.code],...card}
  for(const inv of st.investigators||[]) {
    add({...st.investigatorDefs?.[inv.code],...inv,type:'investigator'},2)
    for(const card of [...(inv.hand||[]),...(inv.assets||[]),...(inv.threat||[]),...(inv.discard||[])])add(known(card),1)
  }
  for(const loc of st.locations||[])add({...loc,type:'location'},2)
  for(const card of [...(st.enemies||[]),...(st.storyAssets||[]),...(st.encounterDiscard||[]),...(st.victoryDisplay||[])])add(known(card),2)
  for(const card of (st.acts||[]).slice(0,(st.actIndex||0)+1))add({...card,type:'act'},2)
  for(const card of (st.agendas||[]).slice(0,(st.agendaIndex||0)+1))add({...card,type:'agenda'},2)
  return names
}

const nameGroups=new WeakMap()
export function timelineCardParts(text,index,event={}) {
  const cue=event.presentation||event, source=cue.source||{}, move=event.move||{}
  const references=[cue.code,source.code,source.id,move.cardId,move.assetId,move.enemyId,move.locationId].filter(Boolean)
  let groups=nameGroups.get(index)
  if(!groups){
    groups=new Map()
    for(const name of [...index.keys()].sort((a,b)=>b.length-a.length)){
      if(!groups.has(name[0]))groups.set(name[0],[])
      groups.get(name[0]).push(name)
    }
    nameGroups.set(index,groups)
  }
  const parts=[]
  let plain='',offset=0
  while(offset<text.length) {
    const name=(groups.get(text[offset])||[]).find(name=>text.startsWith(name,offset)
      && (!/^[\x00-\x7f]+$/.test(name)||(!/[\w]/.test(text[offset-1]||'')&&!/[\w]/.test(text[offset+name.length]||''))))
    if(!name){plain+=text[offset++];continue}
    const cards=[...index.get(name).values()]
    const explicit=cards.filter(({card})=>references.some(ref=>[card.code,card.originalCode,card.id].includes(ref)))
    const priority=Math.max(...cards.map(item=>item.priority))
    const matches=explicit.length?explicit:cards.filter(item=>item.priority===priority)
    // Never silently open the wrong level/version of an ambiguous card name.
    if(matches.length!==1){plain+=name;offset+=name.length;continue}
    if(plain){parts.push({text:plain});plain=''}
    parts.push({text:name,card:matches[0].card});offset+=name.length
  }
  if(plain)parts.push({text:plain})
  return parts
}

export function renderTableLog(h, session, inspect) {
  const entries = timelineEntries(session)
  const index=timelineCardIndex(session),events=new Map((session.events||[]).map(event=>[event.seq,event]))
  return h('div', { className: 'ah-log-wrap' }, h('div', { className: 'ah-log', 'aria-label': t('table.log.aria') },
    entries.length ? entries.slice().reverse().map(event => h('div', { className: 'ah-log-line' + (event.phase ? ' is-' + event.phase : ''), 'data-event-seq': event.id },
      timelineCardParts(event.text,index,events.get(event.id)).map(part=>part.card&&inspect?h('button',{
        className:'ah-log-card-link',type:'button','data-timeline-card':part.card.originalCode||part.card.code||part.card.id,
        'aria-label':t('table.log.inspect', { name: part.text }),title:t('table.log.inspect', { name: part.text }),
        onclick:()=>inspect(part.card),
      },renderRulesText(h,part.text,{links:false})):renderRulesText(h,part.text,{links:false}))))
      : h('div', { className: 'ah-log-line' }, t('table.log.empty'))))
}
