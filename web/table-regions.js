// Region composition is separate from Arkham rules and card interactions.
// Every region receives ready DOM nodes, so game-ui stays the single action
// adapter while layout can change independently.
import { t } from './i18n.js'
import { tableArt } from './table-art.js'
import { tableIcon, placedCardMarkers } from './table-components.js'
import { cardDisplayName } from './catalog.js'
// 第 127 轮：剧本 → 剧本参考卡的卡号表搬到 web/ui-cards.js。
import { UI_CARDS } from './ui-cards.js'

// 毁灭时钟显示「场上毁灭总数」：密谋上的毁灭 + 敌人/地点/支援/威胁区上的毁灭，
// 与当前密谋的阈值比较（Rules Reference, "Act Deck and Agenda Deck"）。
// 议程推进时这些毁灭会全部被移除（引擎 advanceAgenda → clearDoomInPlay）。
const agendaDoomValue = state => state.agendaDoom ?? state.doom ?? 0
const doomClockLabel = (state, agenda) => {
  const doom = agendaDoomValue(state)
  const extra = Math.max(0, (state.totalDoom ?? doom) - doom)
  const threshold = agenda?.doomThreshold ?? '?'
  return extra ? t('table.doomClock.extra', { doom, threshold, extra }) : t('table.doomClock', { doom, threshold })
}

export function createTableRegions(h, { openDetail, openChaosBag }) {
  const section = (className, label, ...children) => h('section', { className, 'aria-label': label }, ...children)
  // 附着卡压在场景/密谋卡下方，只露出上沿，点击查看卡面。
  const attachedStrip = (cards, label, type) => cards.length ? h('div', { className: 'ah-script-attachments', role: 'group', 'aria-label': t('table.attachment.aria', { label }) },
    cards.map(card => {
      const name = cardDisplayName(card) || card.code
      return h('button', { type: 'button', className: 'ah-script-attachment', 'data-map-info': 'attachment',
        'data-card-code': card.code, 'data-attachment-code': card.code, title: t('table.attachment.title', { label, name }), 'aria-label': t('table.attachment.inspect', { name }),
        onclick: event => { event.stopPropagation(); openDetail({ ...card, name: cardDisplayName(card) || name, type: card.type || 'treachery',
          attachedTo: { type, name: label } }) },
        onkeydown: event => event.stopPropagation(),
      }, tableArt(h, card.originalCode || card.code, name), h('span', {}, name))
    })) : null
  const sceneCard = (item, type, label, attached = []) => h('div', {
    className: 'ah-script-card' + (attached.length ? ' has-attachments' : ''), role: 'button', tabindex: 0, 'aria-label': label, title: item?.name || label, 'data-interaction': item ? `${type}:current` : null,
    onclick: () => item && openDetail({ ...item, type, attachments: attached }, { side: item.face || 'front' }),
    onkeydown: event => { if (['Enter', ' '].includes(event.key) && item) { event.preventDefault(); openDetail({ ...item, type, attachments: attached }, { side: item.face || 'front' }) } },
  }, item ? tableArt(h, item.originalCode || item.code, item.name, { landscape: true, face: item.face || 'front' }) : h('span', {}, t('table.script.ended')),
    item ? placedCardMarkers(h, item, { attachmentCount: attached.length }) : null,
    item ? attachedStrip(attached, label, type) : null)
  const referenceCard = state => {
    const code = UI_CARDS.scenarioCards[state.scenario?.id]
    if (!code) return null
    const hard = ['hard', 'expert'].includes(state.difficulty)
    const face = hard ? 'back' : 'front'
    const label = t('table.reference.label', { name: state.scenario?.name?.split(/：| · /).at(-1) || t('table.scenario.generic') })
    const difficulty = hard ? t('table.difficulty.hardPair') : t('table.difficulty.easyPair')
    return h('button', { className: 'ah-reference-card', type: 'button', 'aria-label': label,
      'data-reference-code': code, 'data-reference-face': face,
      title: t('table.reference.title', { difficulty }),
      onclick: () => openDetail({ code, name: label, type: 'scenario' }, { runtime: false, side: face }),
    }, tableArt(h, code, label, { face }), h('span', { className: 'ah-reference-caption' }, t('table.reference.caption')),
    h('small', {}, difficulty))
  }
  const roster = (state, players, activity) => {
    const actingSeat = state.pendingChoice?.seat ?? state.currentSeat
    return h('div', { className: 'ah-command-roster', role: 'list', 'aria-label': t('table.roster.aria') }, state.investigators.map(inv => {
      const player = players.find(p => p.seat === inv.seat)
      const active = state.status === 'playing' && !inv.defeated && !inv.resigned && inv.seat === actingSeat
      const thinking = active && player?.role === 'ai' && activity.processing && !activity.presenting
      const status = inv.defeated ? t('table.status.defeated') : inv.resigned ? t('table.status.resigned')
        : active && player?.role === 'ai' ? (activity.presenting ? t('table.status.aiPresenting') : thinking ? t('table.status.aiThinking') : t('table.status.aiWaiting'))
        : active ? (activity.presenting ? t('table.status.resolving') : activity.processing ? t('table.status.submitting') : state.pendingChoice ? t('table.status.pending') : t('table.status.acting'))
        : (state.turnsTaken || []).includes(inv.seat) ? t('table.status.turnEnded') : t('table.status.idle')
      const id = player?.id || player?.aiId || t('table.seat', { seat: String(inv.seat + 1).padStart(2, '0') })
      const avatar = player?.avatar || '👤'
      return h('div', { className: 'ah-roster-member' + (active ? ' is-active' : '') + (thinking ? ' is-thinking' : ''), role: 'listitem', 'data-seat': inv.seat,
        'aria-current': active ? 'true' : 'false' },
        h('button', { className: 'ah-roster-character', 'data-interaction': `investigator:${inv.seat}`, title: inv.name + ' · ' + status, 'aria-label': inv.name + ' · ' + status,
          onclick: () => openDetail({ ...inv, type: 'investigator' }) },
          h('span', { className: 'ah-roster-portrait', 'aria-hidden': 'true' }, tableArt(h, inv.code, inv.name)),
          h('span', { className: 'ah-roster-identity' }, h('strong', {}, inv.name), h('small', { className: 'ah-roster-status' }, status))),
        h('div', { className: 'ah-roster-player', title: t('table.player.line', { player: player?.name || t('table.player.fallback'), id }) },
          h('span', { className: 'ah-roster-avatar', 'aria-hidden': 'true' }, /^(data:image\/|blob:|https?:\/\/|\/)/i.test(avatar)
            ? h('img', { src: avatar, alt: '' }) : avatar),
          h('span', {}, h('span', { className: 'ah-roster-player-name' }, player?.name || t('table.player.fallback')), h('small', {}, id))))
    }))
  }
  return {
    // 剧本区从左到右：剧本书（密谋/场景）→ 提示卡 → 当前场景/密谋的可执行操作。
    script: (state, act, agenda, players = [], advanceButton = null, activity = {}, scriptActions = null, attachments = {}) => section('ah-table-script' + (scriptActions ? ' has-script-actions' : ''), t('table.region.script'),
      h('div', { className: 'ah-story-group' },
        h('div', { className: 'ah-script-cards ah-story-book', role: 'group', 'aria-label': t('table.script.booksAria') },
          sceneCard(agenda, 'agenda', t('table.script.agenda'), attachments.agenda || []), sceneCard(act, 'act', t('table.script.act'), attachments.act || [])),
        referenceCard(state), scriptActions),
      h('div', { className: 'ah-command-deck' },
      h('div', { className: 'ah-command-resources', role: 'group', 'aria-label': t('table.resources.aria') },
      h('div', { className: 'ah-encounter-deck', role: 'group', 'aria-label': t('table.encounter.aria', { count: state.encounterDeckSize ?? state.encounterDeck?.length ?? 0 }) },
        h('img', { src: '/mods/arkhamhorror/img/backs/back_encounter.webp', alt: t('table.encounter.back') }),
        h('span', {}, t('table.encounter.deck')), h('small', {}, t('table.encounter.summary', { count: state.encounterDeckSize ?? state.encounterDeck?.length ?? 0, discard: state.encounterDiscard?.length || 0 }))),
      h('button', { className: 'ah-chaos-bag', type:'button', 'aria-label': t('table.chaos.aria'), 'aria-haspopup':'dialog', onclick:openChaosBag, title: t('table.chaos.title', { count: state.chaosBag?.length || 0 }) },
        h('img', { src: '/mods/arkhamhorror/img/ui/chaos-bag.webp', alt: '' }),
        h('span', {}, t('table.chaos.label')), h('small', {}, t('table.chaos.count', { count: state.chaosBag?.length || 0 }))),
      h('div', { className: 'ah-script-status' },
        h('span', { className: 'ah-script-clues' }, h('span', { className: 'ah-command-token' }, tableIcon('clue')), t('table.script.clues', { count: state.clues || 0 })),
        h('span', { className: 'ah-script-doom' }, h('span', { className: 'ah-command-token' }, tableIcon('doom')), doomClockLabel(state, agenda)),
        h('div', { className: 'ah-doom-track', 'aria-label': t('table.script.doomProgress') }, Array.from({ length: Math.min(12, agenda?.doomThreshold || 6) }, (_, i) =>
          h('i', { className: i < agendaDoomValue(state) ? 'is-filled' : '' }))))),
      h('div', { className: 'ah-command-team' }, roster(state, players, activity), advanceButton))),
    headerPhases: state => h('nav', { className: 'ah-header-phases', 'aria-label': t('table.phase.aria') }, [
      ['mythos', 'table.phase.mythos', 'table.phase.mythos.detail', 'eye'], ['investigation', 'table.phase.investigation', 'table.phase.investigation.detail', 'clue'],
      ['enemy', 'table.phase.enemy', 'table.phase.enemy.detail', 'sword'], ['upkeep', 'table.phase.upkeep', 'table.phase.upkeep.detail', 'resource'],
    ].map(([id, labelKey, detailKey, icon]) => h('div', { className: `ah-header-phase ah-phase-${id}` + (state.status === 'playing' && state.phase === id ? ' is-current' : ''),
      'aria-current': state.status === 'playing' && state.phase === id ? 'step' : 'false', title: t(detailKey) },
      tableIcon(icon), h('span', {}, h('strong', {}, t(labelKey)), h('small', {}, t(detailKey)))))),
    map: (map, enemies, story) => section('ah-table-map', t('table.region.map'), map, enemies, story),
    player: card => section('ah-table-player', t('table.region.player'), card),
    actions: (controls, choice = false) => section('ah-table-actions' + (choice ? ' has-choice' : ''), t('table.region.actions'), controls),
    timeline: (open, toggle, content) => h('aside', {
      className: 'ah-table-timeline' + (open ? ' is-open' : ''), 'aria-label': t('table.timeline.aria'),
    }, h('button', { className: 'ah-timeline-toggle', 'aria-expanded': open ? 'true' : 'false', onclick: toggle },
      open ? t('table.timeline.collapse') : t('table.timeline.expand')), content),
    // 局势详情是独立弹窗（situation-view.js），不占用牌桌网格。
    body: ({ script, map, player, actions, timeline }) => h('div', { className: 'ah-table-shell' },
      script, h('div', { className: 'ah-table-main' }, map), player, actions, timeline),
  }
}
