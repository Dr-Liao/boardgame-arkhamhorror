import { tableIcon } from './table-components.js'
import { renderRulesText } from './card-text.js'
import { campaignPresentation } from './campaign-presentation.js'
import { recordValueText } from './campaign-records.js'
export function renderStoryReader(h,s,state,render,action,game,checkpointAction=()=>null) {
  const journal=s.state.campaignStory || {entries:[]}, entries=journal.entries
  const key=`${s.sessionId}:${journal.currentId}`
  if(state.arkhamStoryContext!==key){state.arkhamStoryContext=key;state.arkhamStorySelected=journal.currentId}
  const selected=entries.find(e=>e.id===state.arkhamStorySelected) || entries.at(-1)
  const labels={intro:'导入',result:'结算',interlude:'幕间'}
  const recordLabels=game?.clientData?.campaigns?.find(c=>c.id===s.state.campaign.id)?.recordLabels || {}
  const recordCardNames=s.state.campaign?.recordCardNames || {}
  return h('section',{className:'ah-hub-pane ah-story-reader','aria-label':'战役故事'},
    h('header',{},h('small',{},'ARKHAM / 已发生的故事'),h('h2',{},'调查纪事')),
    !selected?h('p',{},'选定案件后，导入故事将在这里展开。'):h('div',{className:'ah-story-layout'},
      h('nav',{'aria-label':'故事章节'},entries.map(entry=>h('button',{'aria-current':entry.id===selected.id?'page':null,onclick:()=>{state.arkhamStorySelected=entry.id;render()}},tableIcon(entry.kind==='result'?'star':'book'),h('span',{},h('small',{},entry.kind==='result' ? entry.resolutionTitle || labels.result : labels[entry.kind]),entry.title)))),
      h('article',{className:'ah-story-page','data-story-id':selected.id},
        h('img',{className:'ah-story-illustration ah-office-decor',src:campaignPresentation(s.state.campaign.id,selected.scenarioId || '').assets.storyDefault,alt:'','aria-hidden':'true'}),
        h('small',{},selected.kind==='result'?'本关结算 · ' + (selected.resolutionTitle || '结算'):labels[selected.kind]),h('h1',{},selected.title),
        (selected.sections || [{paragraphs:selected.paragraphs}]).map(section=>h('section',{className:'ah-story-section'},
          section.title?h('h2',{},section.title):null,
          section.paragraphs.map(p=>h('p',{className:'ah-story-prose'},renderRulesText(h,p,{links:false}))))),
        selected.kind==='result'?h('section',{className:'ah-story-consequences','aria-label':'本次结算结果'},h('h3',{},'这次调查留下了什么'),
          h('div',{},`胜利点 ${selected.victory || 0} · ${selected.rounds || 0} 回合`),
          Object.entries(selected.records || {}).filter(([key])=>recordLabels[key]).map(([key,value])=>h('p',{},`${recordLabels[key]}：${recordValueText(value,recordCardNames)}`)),
          selected.investigators?.map(inv=>h('article',{},h('strong',{},s.state.investigatorDefs?.[inv.code]?.nameZh || s.state.investigators.find(i=>i.seat===inv.seat)?.name || '调查员'),
            h('span',{},`+${inv.xpAwarded || 0} XP`),h('span',{},`肉体创伤 +${(inv.traumaAfter?.physical||0)-(inv.traumaBefore?.physical||0)}`),h('span',{},`精神创伤 +${(inv.traumaAfter?.mental||0)-(inv.traumaBefore?.mental||0)}`),
            h('b',{},({killed:'阵亡',insane:'永久疯狂',active:'仍在役'})[inv.status] || inv.status)))):null,
        h('footer',{},
          checkpointAction(s,selected),
          (s.state.legalMoves || []).filter(m=>m.action==='hubContinue').map(m=>action(s,m,'继续，进入关间准备'))))))
}
