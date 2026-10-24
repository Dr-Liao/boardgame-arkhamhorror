// Region composition is separate from Arkham rules and card interactions.
// Every region receives ready DOM nodes, so game-ui stays the single action
// adapter while layout can change independently.
import { tableArt } from './table-art.js'
import { tableIcon, placedCardMarkers } from './table-components.js'
import { cardDisplayName } from './catalog.js'
// 第 127 轮：剧本 → 剧本参考卡的卡号表搬到 web/ui-cards.js。
import { UI_CARDS } from './ui-cards.js'

// Only doom on the current agenda counts toward its threshold; doom sitting on
// enemies/locations/assets is a separate pool and is shown as a side note.
const agendaDoomValue = state => state.agendaDoom ?? state.doom ?? 0
const doomClockLabel = (state, agenda) => {
  const doom = agendaDoomValue(state)
  const extra = Math.max(0, (state.totalDoom ?? doom) - doom)
  return `毁灭 ${doom}/${agenda?.doomThreshold ?? '?'}${extra ? ` · 场上 +${extra}` : ''}`
}

export function createTableRegions(h, { openDetail, openChaosBag }) {
  const section = (className, label, ...children) => h('section', { className, 'aria-label': label }, ...children)
  // 附着卡压在场景/密谋卡下方，只露出上沿，点击查看卡面。
  const attachedStrip = (cards, label) => cards.length ? h('div', { className: 'ah-script-attachments', role: 'group', 'aria-label': `${label}的附属卡` },
    cards.map(card => {
      const name = cardDisplayName(card) || card.code
      return h('button', { type: 'button', className: 'ah-script-attachment', 'data-map-info': 'attachment',
        'data-card-code': card.code, 'data-attachment-code': card.code, title: `附着于${label} · ${name}`, 'aria-label': `查看附属卡 ${name}`,
        onclick: event => { event.stopPropagation(); openDetail({ ...card, name: cardDisplayName(card) || name, type: card.type || 'treachery',
          attachedTo: { type: label === '当前密谋' ? 'agenda' : 'act', name: label } }) },
        onkeydown: event => event.stopPropagation(),
      }, tableArt(h, card.originalCode || card.code, name), h('span', {}, name))
    })) : null
  const sceneCard = (item, type, label, attached = []) => h('div', {
    className: 'ah-script-card' + (attached.length ? ' has-attachments' : ''), role: 'button', tabindex: 0, 'aria-label': label, title: item?.name || label, 'data-interaction': item ? `${type}:current` : null,
    onclick: () => item && openDetail({ ...item, type, attachments: attached }, { side: item.face || 'front' }),
    onkeydown: event => { if (['Enter', ' '].includes(event.key) && item) { event.preventDefault(); openDetail({ ...item, type, attachments: attached }, { side: item.face || 'front' }) } },
  }, item ? tableArt(h, item.originalCode || item.code, item.name, { landscape: true, face: item.face || 'front' }) : h('span', {}, '已结束'),
    item ? placedCardMarkers(h, item, { attachmentCount: attached.length }) : null,
    item ? attachedStrip(attached, label) : null)
  const referenceCard = state => {
    const code = UI_CARDS.scenarioCards[state.scenario?.id]
    if (!code) return null
    const hard = ['hard', 'expert'].includes(state.difficulty)
    const face = hard ? 'back' : 'front'
    const label = (state.scenario?.name?.split(/：| · /).at(-1) || '剧本') + ' · 提示卡'
    return h('button', { className: 'ah-reference-card', type: 'button', 'aria-label': label,
      'data-reference-code': code, 'data-reference-face': face,
      title: '查看混乱标记效果 · ' + (hard ? '困难 / 专家' : '简单 / 普通'),
      onclick: () => openDetail({ code, name: label, type: 'scenario' }, { runtime: false, side: face }),
    }, tableArt(h, code, label, { face }), h('span', { className: 'ah-reference-caption' }, '剧本提示'),
    h('small', {}, hard ? '困难 / 专家' : '简单 / 普通'))
  }
  const roster = (state, players, activity) => {
    const actingSeat = state.pendingChoice?.seat ?? state.currentSeat
    return h('div', { className: 'ah-command-roster', role: 'list', 'aria-label': '当前调查员' }, state.investigators.map(inv => {
      const player = players.find(p => p.seat === inv.seat)
      const active = state.status === 'playing' && !inv.defeated && !inv.resigned && inv.seat === actingSeat
      const thinking = active && player?.role === 'ai' && activity.processing && !activity.presenting
      const status = inv.defeated ? '已倒下' : inv.resigned ? '已撤退'
        : active && player?.role === 'ai' ? (activity.presenting ? 'AI 行动演出中' : thinking ? 'AI 思考中…' : 'AI 等待继续')
        : active ? (activity.presenting ? '行动结算中' : activity.processing ? '正在提交行动…' : state.pendingChoice ? '处理中' : '行动中')
        : (state.turnsTaken || []).includes(inv.seat) ? '回合已结束' : '待命'
      const id = player?.id || player?.aiId || `座位 ${String(inv.seat + 1).padStart(2, '0')}`
      const avatar = player?.avatar || '👤'
      return h('div', { className: 'ah-roster-member' + (active ? ' is-active' : '') + (thinking ? ' is-thinking' : ''), role: 'listitem', 'data-seat': inv.seat,
        'aria-current': active ? 'true' : 'false' },
        h('button', { className: 'ah-roster-character', 'data-interaction': `investigator:${inv.seat}`, title: inv.name + ' · ' + status, 'aria-label': inv.name + ' · ' + status,
          onclick: () => openDetail({ ...inv, type: 'investigator' }) },
          h('span', { className: 'ah-roster-portrait', 'aria-hidden': 'true' }, tableArt(h, inv.code, inv.name)),
          h('span', { className: 'ah-roster-identity' }, h('strong', {}, inv.name), h('small', { className: 'ah-roster-status' }, status))),
        h('div', { className: 'ah-roster-player', title: `${player?.name || '玩家'} · ${id}` },
          h('span', { className: 'ah-roster-avatar', 'aria-hidden': 'true' }, /^(data:image\/|blob:|https?:\/\/|\/)/i.test(avatar)
            ? h('img', { src: avatar, alt: '' }) : avatar),
          h('span', {}, h('span', { className: 'ah-roster-player-name' }, player?.name || '玩家'), h('small', {}, id))))
    }))
  }
  return {
    // 剧本区从左到右：剧本书（密谋/场景）→ 提示卡 → 当前场景/密谋的可执行操作。
    script: (state, act, agenda, players = [], advanceButton = null, activity = {}, scriptActions = null, attachments = {}) => section('ah-table-script' + (scriptActions ? ' has-script-actions' : ''), '剧本区',
      h('div', { className: 'ah-story-group' },
        h('div', { className: 'ah-script-cards ah-story-book', role: 'group', 'aria-label': '剧本书：左页密谋，右页场景' },
          sceneCard(agenda, 'agenda', '当前密谋', attachments.agenda || []), sceneCard(act, 'act', '当前场景', attachments.act || [])),
        referenceCard(state), scriptActions),
      h('div', { className: 'ah-command-deck' },
      h('div', { className: 'ah-command-resources', role: 'group', 'aria-label': '混乱袋与剧本标记' },
      h('div', { className: 'ah-encounter-deck', role: 'group', 'aria-label': `遭遇牌堆 ${state.encounterDeckSize ?? state.encounterDeck?.length ?? 0} 张` },
        h('img', { src: '/mods/arkhamhorror/img/backs/back_encounter.webp', alt: '遭遇牌背' }),
        h('span', {}, '遭遇牌堆'), h('small', {}, `${state.encounterDeckSize ?? state.encounterDeck?.length ?? 0} 张 · 弃牌 ${state.encounterDiscard?.length || 0}`)),
      h('button', { className: 'ah-chaos-bag', type:'button', 'aria-label':'查看混乱袋', 'aria-haspopup':'dialog', onclick:openChaosBag, title: `查看混乱袋 · ${state.chaosBag?.length || 0} 个标记` },
        h('img', { src: '/mods/arkhamhorror/img/ui/chaos-bag.webp', alt: '' }),
        h('span', {}, '混乱袋'), h('small', {}, `${state.chaosBag?.length || 0} 个标记`)),
      h('div', { className: 'ah-script-status' },
        h('span', { className: 'ah-script-clues' }, h('span', { className: 'ah-command-token' }, tableIcon('clue')), `线索 ${state.clues || 0}`),
        h('span', { className: 'ah-script-doom' }, h('span', { className: 'ah-command-token' }, tableIcon('doom')), doomClockLabel(state, agenda)),
        h('div', { className: 'ah-doom-track', 'aria-label': '毁灭进度' }, Array.from({ length: Math.min(12, agenda?.doomThreshold || 6) }, (_, i) =>
          h('i', { className: i < agendaDoomValue(state) ? 'is-filled' : '' }))))),
      h('div', { className: 'ah-command-team' }, roster(state, players, activity), advanceButton))),
    headerPhases: state => h('nav', { className: 'ah-header-phases', 'aria-label': '回合阶段' }, [
      ['mythos', '神话阶段', '放毁灭，抽遭遇牌', 'eye'], ['investigation', '调查阶段', '移动和执行行动', 'clue'],
      ['enemy', '敌军阶段', '猎手移动，敌人攻击', 'sword'], ['upkeep', '整备阶段', '重整，抽牌拿资源', 'resource'],
    ].map(([id, label, detail, icon]) => h('div', { className: `ah-header-phase ah-phase-${id}` + (state.status === 'playing' && state.phase === id ? ' is-current' : ''),
      'aria-current': state.status === 'playing' && state.phase === id ? 'step' : 'false', title: detail },
      tableIcon(icon), h('span', {}, h('strong', {}, label), h('small', {}, detail))))),
    map: (map, enemies, story) => section('ah-table-map', '地点地图', map, enemies, story),
    player: card => section('ah-table-player', '玩家区', card),
    actions: (controls, choice = false) => section('ah-table-actions' + (choice ? ' has-choice' : ''), '上下文动作栏', controls),
    timeline: (open, toggle, content) => h('aside', {
      className: 'ah-table-timeline' + (open ? ' is-open' : ''), 'aria-label': '局势时间线',
    }, h('button', { className: 'ah-timeline-toggle', 'aria-expanded': open ? 'true' : 'false', onclick: toggle },
      open ? '收起时间线' : '展开时间线'), content),
    // 局势详情是独立弹窗（situation-view.js），不占用牌桌网格。
    body: ({ script, map, player, actions, timeline }) => h('div', { className: 'ah-table-shell' },
      script, h('div', { className: 'ah-table-main' }, map), player, actions, timeline),
  }
}
