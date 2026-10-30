import { tableIcon } from './table-components.js'
import { renderRulesText } from './card-text.js'
import { campaignPresentation } from './campaign-presentation.js'
import { recordValueText } from './campaign-records.js'
import { cardDisplayName } from './catalog.js'
import { t } from './i18n.js'
export function renderStoryReader(h,s,state,render,action,game,checkpointAction=()=>null) {
  const journal=s.state.campaignStory || {entries:[]}, entries=journal.entries
  const key=`${s.sessionId}:${journal.currentId}`
  if(state.arkhamStoryContext!==key){state.arkhamStoryContext=key;state.arkhamStorySelected=journal.currentId}
  const selected=entries.find(e=>e.id===state.arkhamStorySelected) || entries.at(-1)
  const labels={intro:t('story.reader.kind.intro'),result:t('story.reader.kind.result'),interlude:t('story.reader.kind.interlude')}
  const statusLabels={killed:t('story.reader.status.killed'),insane:t('story.reader.status.insane'),active:t('story.reader.status.active')}
  const recordLabels=game?.clientData?.campaigns?.find(c=>c.id===s.state.campaign.id)?.recordLabels || {}
  const recordCardNames=s.state.campaign?.recordCardNames || {}
  const restart=checkpointAction(s,selected)
  return h('section',{className:'ah-hub-pane ah-story-reader','aria-label':t('story.reader.aria')},
    h('header',{},h('small',{},t('story.reader.eyebrow')),h('h2',{},t('story.reader.title'))),
    !selected?h('p',{},t('story.reader.empty')):h('div',{className:'ah-story-layout'},
      h('nav',{'aria-label':t('story.reader.chapterNav')},entries.map(entry=>h('button',{'aria-current':entry.id===selected.id?'page':null,onclick:()=>{state.arkhamStorySelected=entry.id;render()}},tableIcon(entry.kind==='result'?'star':'book'),h('span',{},h('small',{},entry.kind==='result' ? entry.resolutionTitle || labels.result : labels[entry.kind]),entry.title)))),
      h('article',{className:'ah-story-page','data-story-id':selected.id},
        h('img',{className:'ah-story-illustration ah-office-decor',src:campaignPresentation(s.state.campaign.id,selected.scenarioId || '').assets.storyDefault,alt:'','aria-hidden':'true'}),
        h('div',{className:'ah-story-masthead'},
          h('small',{},selected.kind==='result'?t('story.reader.resultEyebrow',{title:selected.resolutionTitle || labels.result}):labels[selected.kind]),
          restart),
        h('h1',{},selected.title),
        (selected.sections || [{paragraphs:selected.paragraphs}]).map(section=>h('section',{className:'ah-story-section'},
          section.title?h('h2',{},section.title):null,
          section.paragraphs.map(p=>h('p',{className:'ah-story-prose'},renderRulesText(h,p,{links:false}))))),
        selected.kind==='result'?h('section',{className:'ah-story-consequences','aria-label':t('story.reader.consequencesAria')},h('h3',{},t('story.reader.consequencesTitle')),
          h('div',{},t('story.reader.victoryLine',{victory:selected.victory || 0,rounds:selected.rounds || 0})),
          Object.entries(selected.records || {}).filter(([key])=>recordLabels[key]).map(([key,value])=>h('p',{},`${recordLabels[key]}：${recordValueText(value,recordCardNames)}`)),
          selected.investigators?.map(inv=>h('article',{},h('strong',{},cardDisplayName(s.state.investigatorDefs?.[inv.code]) || s.state.investigators.find(i=>i.seat===inv.seat)?.name || t('story.investigator')),
            h('span',{},`+${inv.xpAwarded || 0} XP`),h('span',{},t('story.reader.physicalTrauma',{amount:(inv.traumaAfter?.physical||0)-(inv.traumaBefore?.physical||0)})),h('span',{},t('story.reader.mentalTrauma',{amount:(inv.traumaAfter?.mental||0)-(inv.traumaBefore?.mental||0)})),
            h('b',{},statusLabels[inv.status] || inv.status)))):null,
        h('footer',{},
          (s.state.legalMoves || []).filter(m=>m.action==='hubContinue').map(m=>action(s,m,t('story.reader.continue')))))))
}
