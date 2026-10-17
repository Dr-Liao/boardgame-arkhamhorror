import { renderRulesText, symbolToken } from './card-text.js'
export function timelineEntries(session) {
  const entries = []
  for (const event of session.events || []) {
    if (event.type === 'info' && typeof event.text === 'string') entries.push({ id: event.seq, text: event.text, phase: event.presentation?.phase })
    else if (event.type === 'presentation' && event.kind === 'chaos') entries.push({ id: event.seq, text: `${event.name || '调查员'}抽取混乱标记：${symbolToken(event.token)}` })
    else if (event.type === 'presentation' && event.kind === 'test') entries.push({ id: event.seq, text: `${event.name || '调查员'} · ${event.source?.name || '技能检定'}：${event.success ? '成功' : '失败'}（${event.value} / 难度 ${event.difficulty}）` })
    else if (event.type === 'move' && event.move?.action !== 'choose') {
      const name = session.state.investigators?.find(i => i.seat === event.seat)?.name || session.players?.[event.seat]?.name || '调查员'
      const label = event.move?.label || ({ draw:'抽牌',resource:'获得资源',move:'移动',play:'打出卡牌',fight:'攻击',evade:'躲避',investigate:'调查',endTurn:'结束行动',ability:'使用能力',engage:'交战',resign:'撤退' })[event.move?.action]
      if (label) entries.push({ id: event.seq, text: `${name} · ${label}` })
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
  return h('div', { className: 'ah-log-wrap' }, h('div', { className: 'ah-log', 'aria-label': '游戏事件时间线' },
    entries.length ? entries.slice().reverse().map(event => h('div', { className: 'ah-log-line' + (event.phase ? ' is-' + event.phase : ''), 'data-event-seq': event.id },
      timelineCardParts(event.text,index,events.get(event.id)).map(part=>part.card&&inspect?h('button',{
        className:'ah-log-card-link',type:'button','data-timeline-card':part.card.originalCode||part.card.code||part.card.id,
        'aria-label':'查看'+part.text+'详情',title:'查看'+part.text+'详情',
        onclick:()=>inspect(part.card),
      },renderRulesText(h,part.text,{links:false})):renderRulesText(h,part.text,{links:false}))))
      : h('div', { className: 'ah-log-line' }, '调查即将开始')))
}
