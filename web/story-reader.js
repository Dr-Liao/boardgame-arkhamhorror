import { tableIcon } from './table-components.js'
import { renderRulesText } from './card-text.js'
import { campaignPresentation } from './campaign-presentation.js'
import { recordValueText } from './campaign-records.js'
import { cardDisplayName } from './catalog.js'
import { t } from './i18n.js'

// 纪事的章节目录会随战役推进不断加长（最多几十条），目录本身是限高滚动区，
// 下面负责两件事：把当前条目滚进视野；画一条常驻的细滚动指示条。
// 复用模块级引用判断「是不是重新进入页签」：同一页签重绘时旧 nav 仍在文档里。
let readerNav = null
let alignedEntryKey = null
let activeRail = null

function placeChapter(nav, item, center) {
  const navBox = nav.getBoundingClientRect(), itemBox = item.getBoundingClientRect()
  // scroll 为当前滚动量；itemStart 是条目相对滚动内容起点的偏移。
  const shift = (scroll, size, itemStart, itemSize, viewSize) => {
    const start = scroll + itemStart, end = start + itemSize
    const target = center ? start - (viewSize - itemSize) / 2
      : start < scroll ? start : end > scroll + viewSize ? end - viewSize : null
    return target == null ? scroll : Math.max(0, Math.min(target, size - viewSize))
  }
  if (nav.scrollHeight - nav.clientHeight > 1) {
    nav.scrollTop = shift(nav.scrollTop, nav.scrollHeight, itemBox.top - navBox.top, itemBox.height, nav.clientHeight)
  }
  if (nav.scrollWidth - nav.clientWidth > 1) {
    nav.scrollLeft = shift(nav.scrollLeft, nav.scrollWidth, itemBox.left - navBox.left, itemBox.width, nav.clientWidth)
  }
}

// Chrome/Edge 在 Windows 11 的 overlay 滚动条静止时会完全隐藏，目录本身看起来没有
// 可滚动的提示。系统用经典滚动条时（nav 已经为滚动条让出宽度）不重复画。
function paintRail(rail) {
  const { nav, track, thumb } = rail || {}
  if (!nav?.isConnected || !track?.isConnected || !thumb) return
  const layout = track.parentElement?.getBoundingClientRect()
  const box = nav.getBoundingClientRect(), style = getComputedStyle(nav)
  const native = nav.offsetWidth - nav.clientWidth
    - (parseFloat(style.borderLeftWidth) || 0) - (parseFloat(style.borderRightWidth) || 0)
  const vertical = nav.scrollHeight - nav.clientHeight > 1
  const horizontal = nav.scrollWidth - nav.clientWidth > 1
  if (!layout || native > 0 || (!vertical && !horizontal)) { track.style.display = 'none'; return }
  track.style.display = 'block'
  const boxStyle = (left, top, width, height) => {
    track.style.left = `${left}px`; track.style.top = `${top}px`
    track.style.width = `${width}px`; track.style.height = `${height}px`
  }
  const thumbStyle = (left, top, width, height, transform) => {
    thumb.style.left = `${left}px`; thumb.style.top = `${top}px`
    thumb.style.width = `${width}px`; thumb.style.height = `${height}px`
    thumb.style.transform = transform
  }
  if (vertical) {
    // 竖条贴在目录右缘外侧的栏间距里，不压住章节按钮。
    const view = box.height, size = Math.max(28, view * (view / nav.scrollHeight))
    boxStyle(box.right - layout.left + 2, box.top - layout.top, 8, view)
    thumbStyle(1, 0, 6, size, `translateY(${(nav.scrollTop / (nav.scrollHeight - nav.clientHeight)) * (view - size)}px)`)
  } else {
    const view = box.width, size = Math.max(28, view * (view / nav.scrollWidth))
    boxStyle(box.left - layout.left, box.bottom - layout.top + 3, view, 6)
    thumbStyle(0, 1, size, 4, `translateX(${(nav.scrollLeft / (nav.scrollWidth - nav.clientWidth)) * (view - size)}px)`)
  }
}

function mountRail(nav, track) {
  if (!nav || !track || typeof requestAnimationFrame !== 'function' || typeof nav.addEventListener !== 'function') return
  const rail = { nav, track, thumb: track.firstElementChild, frame: 0 }
  nav.addEventListener('scroll', () => {
    if (rail.frame) return
    rail.frame = requestAnimationFrame(() => { rail.frame = 0; paintRail(rail) })
  }, { passive: true })
  activeRail = rail
  requestAnimationFrame(() => paintRail(rail))
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('resize', () => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => paintRail(activeRail))
  })
}

// 等大厅把新树挂进文档、并完成它自己的滚动位置恢复之后再定位；
// 在下一帧执行既能看到最终布局，也不会被滚动恢复覆盖。
function revealChapterWhenMounted(nav, item, center) {
  if (typeof requestAnimationFrame !== 'function' || typeof nav?.getBoundingClientRect !== 'function') return
  requestAnimationFrame(() => {
    if (nav.isConnected && item?.isConnected) placeChapter(nav, item, center)
  })
}

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
  // 重新进入页签时居中当前条目；只是换选条目时只在条目跑出可视区时补滚，避免目录跳动。
  const opened=!readerNav || !readerNav.isConnected
  const selectedKey=`${s.sessionId}:${selected?.id}`
  const realign=!!selected && (opened || alignedEntryKey!==selectedKey)
  alignedEntryKey=selectedKey
  let currentButton=null
  const nav=selected?h('nav',{'aria-label':t('story.reader.chapterNav')},entries.map(entry=>{
    const button=h('button',{'aria-current':entry.id===selected.id?'page':null,onclick:()=>{state.arkhamStorySelected=entry.id;render()}},tableIcon(entry.kind==='result'?'star':'book'),h('span',{},h('small',{},entry.kind==='result' ? entry.resolutionTitle || labels.result : labels[entry.kind]),entry.title))
    if(entry.id===selected.id) currentButton=button
    return button
  })):null
  const track=nav?h('span',{className:'ah-story-nav-scroll','aria-hidden':'true'},h('i')):null
  readerNav=nav
  if(realign) revealChapterWhenMounted(nav,currentButton,opened)
  if(nav) mountRail(nav,track)
  return h('section',{className:'ah-hub-pane ah-story-reader','aria-label':t('story.reader.aria')},
    h('header',{},h('small',{},t('story.reader.eyebrow')),h('h2',{},t('story.reader.title'))),
    !selected?h('p',{},t('story.reader.empty')):h('div',{className:'ah-story-layout'},
      nav,track,
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
