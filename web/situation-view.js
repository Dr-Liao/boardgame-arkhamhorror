// 局势：独立的调查档案弹窗。只读展示当前牌桌快照，不提交任何行动；
// 与混乱袋一样作为宿主 overlay 渲染，牌桌布局不再为它预留抽屉。
import { groupedChaosTokens } from './chaos-bag-view.js'
import { tableArt, retainTableArt } from './table-art.js'
import { tableIcon } from './table-components.js'
import { cardSymbol } from './card-text.js'

const IMG = '/mods/arkhamhorror/img/'
const PHASES = [
  ['mythos', '神话阶段', '毁灭 · 遭遇', 'eye'], ['investigation', '调查阶段', '移动 · 行动', 'clue'],
  ['enemy', '敌军阶段', '猎手 · 攻击', 'sword'], ['upkeep', '整备阶段', '重整 · 补给', 'resource'],
]
const STAGES = [['ST.1', '开始'], ['ST.2', '投入'], ['ST.3', '揭示'], ['ST.4', '效果'], ['ST.5', '计算'], ['ST.6', '判定'], ['ST.7', '结算'], ['ST.8', '结束']]
const SKILLS = [['willpower', '意志'], ['intellect', '智识'], ['combat', '战斗'], ['agility', '敏捷']]
const DIFFICULTY = { easy: '简单', standard: '普通', hard: '困难', expert: '专家' }
const CLASS_NAME = { guardian: '守卫者', seeker: '探求者', mystic: '秘术师', rogue: '游荡者', survivor: '幸存者', neutral: '中立' }
const OUTCOME = { victory: '调查队获胜', survived: '调查队幸存', defeat: '调查队失败' }

export function createSituationView(h, { render, effStat, openDetail, openCard, openChaosBag, cardName, mySeat }) {
  let sessionId = null, cached = null, cachedKey = ''
  const forget = () => { sessionId = null; cached = null; cachedKey = '' }
  const close = () => {
    forget(); render()
    queueMicrotask(() => document.querySelector('[data-situation-toggle]')?.focus({ preventScroll: true }))
  }

  const token = (kind, icon, label, value) => h('div', { className: 'ah-situ-token is-' + kind, title: `${label} ${value}` },
    h('span', { className: 'ah-situ-token-face' }, tableIcon(icon), h('strong', {}, String(value))), h('small', {}, label))

  const meter = (kind, icon, label, current, max) => {
    const total = Math.max(0, Number(max) || 0), left = Math.max(0, Math.min(total, Number(current) || 0))
    return h('div', { className: 'ah-situ-meter is-' + kind + (left <= Math.ceil(total / 3) ? ' is-low' : ''), title: `${label} ${left}/${total}` },
      h('span', { className: 'ah-situ-meter-label' }, tableIcon(icon), label),
      h('span', { className: 'ah-situ-meter-track', 'aria-hidden': 'true' },
        Array.from({ length: Math.min(total, 15) }, (_, i) => h('i', { className: i < left ? 'is-filled' : '' }))),
      h('strong', {}, `${left}/${total}`))
  }

  const pips = (filled, total, icon, label) => h('span', { className: 'ah-situ-pips', role: 'img', 'aria-label': label },
    Array.from({ length: total }, (_, i) => h('i', { className: i < filled ? 'is-filled' : '' }, icon ? tableIcon(icon) : null)))

  const header = (st, dismiss) => {
    const cp = st.campaign
    const over = st.status !== 'playing'
    const meta = [
      cp ? `${cp.name} · 第 ${(cp.scenarioIndex || 0) + 1}/${cp.scenarioCount || 3} 关` : null,
      DIFFICULTY[st.difficulty] ? DIFFICULTY[st.difficulty] + '难度' : null,
      over ? (OUTCOME[st.outcome] || '对局结束') : '调查进行中',
    ].filter(Boolean).join(' · ')
    return h('header', { className: 'ah-situ-head' },
      h('div', { className: 'ah-situ-round', title: '当前回合' }, h('small', {}, '回合'), h('strong', {}, String(st.round || 1))),
      h('div', { className: 'ah-situ-title' },
        h('small', {}, '调查局势 · CASE STATUS'),
        h('h2', {}, st.scenario?.name?.split('：').at(-1) || st.scenario?.name || '剧本'),
        h('p', {}, meta)),
      dismiss)
  }

  const phasePanel = st => {
    const playing = st.status === 'playing'
    const seat = st.pendingChoice?.seat ?? st.currentSeat
    const actor = st.investigators.find(inv => inv.seat === seat)
    const stage = st.skillTest ? STAGES.findIndex(([id]) => id === st.skillTest.stage) : -1
    const actions = Math.max(0, actor?.actionsLeft || 0)
    return h('section', { className: 'ah-situ-panel ah-situ-phase', role: 'region', 'aria-label': '阶段轨' },
      h('h3', {}, tableIcon('star'), '回合流程'),
      h('ol', { className: 'ah-situ-phases' }, PHASES.map(([id, label, detail, icon]) => {
        const current = playing && st.phase === id
        return h('li', { className: 'ah-situ-phase-step is-' + id + (current ? ' is-current' : ''), 'aria-current': current ? 'step' : null },
          h('span', { className: 'ah-situ-medal' }, tableIcon(icon)), h('strong', {}, label), h('small', {}, detail))
      })),
      actor && playing ? h('div', { className: 'ah-situ-acting' },
        h('span', { className: 'ah-situ-acting-portrait' }, tableArt(h, actor.code, actor.name)),
        h('div', {},
          h('small', {}, st.pendingChoice ? '等待回答' : '当前行动'),
          h('strong', {}, actor.name),
          st.pendingChoice ? h('span', { className: 'ah-situ-acting-note' }, '待决选择处理中')
            : pips(actions, Math.max(3, actions), 'action', `剩余 ${actions} 行动`))) : null,
      stage >= 0 ? h('div', { className: 'ah-situ-test' },
        h('small', {}, `技能检定 · 已投入 ${st.skillTest.committed?.length || 0} 张`),
        h('ol', {}, STAGES.map(([id, label], i) => h('li', { className: i < stage ? 'is-done' : i === stage ? 'is-current' : '', title: id + ' ' + label },
          h('span', {}, String(i + 1)), h('small', {}, label))))) : null,
      h('small', { className: 'ah-rules-note' }, '简化模式 · 当前仅开放部分 Core 卡牌与《夜之狂热》流程'))
  }

  const scene = (item, type, label, extra) => h('div', { className: 'ah-situ-scene is-' + type },
    h('button', { type: 'button', className: 'ah-situ-scene-card', disabled: !item, 'aria-label': `查看当前${label}`,
      onclick: () => item && openDetail({ ...item, type }, { side: item.face || 'front' }) },
    item ? tableArt(h, item.originalCode || item.code, item.name, { landscape: true, face: item.face || 'front' }) : h('span', {}, '已结束')),
    h('small', {}, label), h('strong', {}, item?.name || '—'), extra)

  const scenarioPanel = (st, leave) => {
    const act = st.acts?.[st.actIndex], agenda = st.agendas?.[st.agendaIndex]
    const doom = st.totalDoom ?? st.doom ?? 0, threshold = agenda?.doomThreshold
    const objective = act?.objective, costsClues = ['clues', 'actClues'].includes(objective?.type)
    const required = costsClues ? (objective.perInvestigator || 0) * (st.numInvestigators || st.investigators.length) : null
    const clues = objective?.type === 'actClues' ? st.actClues || 0
      : st.investigators.filter(inv => !inv.defeated && !inv.resigned).reduce((sum, inv) => sum + (inv.clues || 0), 0)
    const bag = st.chaosBag || [], chaos = st.chaos || {}
    const encounter = st.encounterDeckSize ?? st.encounterDeck?.length ?? 0
    return h('section', { className: 'ah-situ-panel ah-situ-scenario', role: 'region', 'aria-label': '剧本进度' },
      h('h3', {}, tableIcon('book'), '剧本进度'),
      h('div', { className: 'ah-situ-scenes' },
        scene(agenda, 'agenda', '密谋', h('div', { className: 'ah-situ-progress is-doom' },
          h('span', {}, tableIcon('doom'), `毁灭 ${doom}/${threshold ?? '?'}`),
          h('span', { className: 'ah-situ-progress-track', 'aria-hidden': 'true' },
            Array.from({ length: Math.min(12, threshold || 6) }, (_, i) => h('i', { className: i < doom ? 'is-filled' : '' }))))),
        scene(act, 'act', '场景', h('div', { className: 'ah-situ-progress is-clue' + (costsClues && clues >= required ? ' is-ready' : '') },
          h('span', {}, tableIcon('clue'), costsClues ? `线索 ${clues}/${required}` : '完成卡面目标'),
          costsClues ? h('span', { className: 'ah-situ-progress-track', 'aria-hidden': 'true' },
            Array.from({ length: Math.min(12, required || 0) }, (_, i) => h('i', { className: i < clues ? 'is-filled' : '' }))) : null))),
      h('div', { className: 'ah-situ-supplies' },
        h('button', { type: 'button', className: 'ah-situ-bag', 'aria-label': '查看混乱袋', 'aria-haspopup': 'dialog', onclick: () => leave(openChaosBag) },
          h('img', { src: IMG + 'ui/chaos-bag.webp', alt: '' }),
          h('span', { className: 'ah-situ-bag-copy' },
            h('strong', {}, '混乱袋'),
            h('small', {}, `袋内 ${bag.length} · 揭示 ${chaos.revealed?.length || 0} · 封印 ${chaos.sealed?.length || 0} · 移除 ${chaos.removed?.length || 0}`),
            h('span', { className: 'ah-situ-bag-tokens' }, groupedChaosTokens(bag).map(item =>
              h('span', { className: 'ah-situ-bag-token', title: `${item.label} ×${item.count}` },
                item.src ? h('img', { src: item.src, alt: item.label, draggable: false }) : h('b', {}, item.label),
                item.count > 1 ? h('i', {}, '×' + item.count) : null))))),
        h('div', { className: 'ah-situ-encounter' },
          h('img', { src: IMG + 'backs/back_encounter.webp', alt: '遭遇牌背' }),
          h('span', {}, h('strong', {}, '遭遇牌堆'), h('small', {}, `${encounter} 张 · 弃牌 ${st.encounterDiscard?.length || 0}`)))))
  }

  const investigator = (s, inv, actingSeat) => {
    const st = s.state
    const player = s.players.find(p => p.seat === inv.seat) || s.players[inv.seat] || {}
    const out = inv.defeated || inv.resigned
    const active = st.status === 'playing' && !out && inv.seat === actingSeat
    const status = inv.defeated ? '已倒下' : inv.resigned ? '已撤退' : active ? (st.pendingChoice ? '处理选择' : '行动中')
      : (st.turnsTaken || []).includes(inv.seat) ? '回合结束' : '待命'
    const klass = st.classNames?.[inv.klass] || CLASS_NAME[String(inv.klass).toLowerCase()] || inv.klass || ''
    const location = st.locations?.find(loc => loc.id === inv.location)
    const engaged = (inv.engaged || []).map(id => st.enemies.find(enemy => enemy.id === id)?.name || id)
    const trauma = st.campaign?.trauma?.[inv.seat] || {}
    const hand = inv.handSize ?? inv.hand?.length ?? 0
    const deck = inv.deckSize ?? inv.deck?.length ?? 0
    const avatar = player.avatar || ''
    return h('article', { className: 'ah-situ-inv' + (active ? ' is-active' : '') + (out ? ' is-out' : ''), 'data-seat': inv.seat,
      style: { '--ah-class': st.classColors?.[inv.klass] || '#a58c56' }, 'aria-label': `${inv.name} · ${status}` },
      h('div', { className: 'ah-situ-inv-head' },
        h('button', { type: 'button', className: 'ah-situ-portrait', 'aria-label': `查看${inv.name}的调查员卡`,
          onclick: () => openDetail({ ...inv, type: 'investigator' }) }, tableArt(h, inv.code, inv.name)),
        h('div', { className: 'ah-situ-inv-id' },
          h('strong', {}, inv.name),
          h('small', {}, klass),
          h('span', { className: 'ah-situ-player' },
            h('span', { className: 'ah-situ-avatar', 'aria-hidden': 'true' }, /^(data:image\/|blob:|https?:\/\/|\/)/i.test(avatar) ? h('img', { src: avatar, alt: '' }) : (avatar || '👤')),
            player.name || (player.role === 'ai' ? 'AI 队友' : '玩家'))),
        h('span', { className: 'ah-situ-ribbon' }, status)),
      location ? h('div', { className: 'ah-situ-inv-loc' }, tableIcon('eye'), '位于 ' + location.name) : null,
      h('div', { className: 'ah-situ-meters' },
        meter('health', 'health', '生命', (inv.maxHealth || 0) - (inv.damage || 0), inv.maxHealth),
        meter('sanity', 'sanity', '理智', (inv.maxSanity || 0) - (inv.horror || 0), inv.maxSanity)),
      h('div', { className: 'ah-situ-tokens' },
        token('resource', 'resource', '资源', inv.resources ?? 0),
        token('clue', 'clue', '线索', inv.clues ?? 0),
        token('action', 'action', '行动', inv.actionsLeft ?? 0),
        inv.code === '01002' ? token('tome', 'book', '书籍行动', inv.tomeActionUsed ? 0 : 1) : null),
      h('div', { className: 'ah-situ-skills' }, SKILLS.map(([skill, label]) => h('span', { className: 'ah-situ-skill', 'data-skill': skill, title: label },
        cardSymbol(h, skill), h('b', {}, String(effStat(s, inv, skill))), h('small', {}, label)))),
      h('div', { className: 'ah-situ-decks' },
        h('span', { className: 'ah-situ-deck' }, h('img', { src: IMG + 'backs/back_player.webp', alt: '' }),
          h('span', {}, h('b', {}, '牌库 ' + deck), h('small', {}, '弃 ' + (inv.discard?.length || 0)))),
        h('span', { className: 'ah-situ-hand' },
          h('span', { className: 'ah-situ-fan', 'aria-hidden': 'true' }, Array.from({ length: Math.min(hand, 5) }, () => h('img', { src: IMG + 'backs/back_player.webp', alt: '' }))),
          h('span', {}, h('b', {}, '手牌（' + hand + '）'), inv.seat === mySeat(s) ? null : h('small', {}, '手牌内容未公开')))),
      engaged.length ? h('div', { className: 'ah-situ-engaged' }, tableIcon('sword'), '交战：' + engaged.join('、')) : null,
      trauma.physical || trauma.mental ? h('div', { className: 'ah-situ-trauma' }, `创伤 · 肉体 ${trauma.physical || 0} / 精神 ${trauma.mental || 0}`) : null)
  }

  const resultTitle = (st, result) => {
    const id = `${result.visitId || `${result.scenarioId}:${result.scenarioIndex}`}:result`
    const title = st.campaignStory?.entries?.find(entry => entry.id === id)?.resolutionTitle
    return title || String(result.resolution || '待结算').replace(/^r(\d+)$/, '结局 $1')
      .replace('noResolution', '未达成结局')
  }

  const campaignPanel = st => {
    const cp = st.campaign
    if (!cp) return null
    const total = cp.scenarioCount || 3, index = cp.scenarioIndex || 0, results = cp.scenarioResults || []
    return h('section', { className: 'ah-situ-panel ah-campaign-panel', role: 'region', 'aria-label': '战役进度' },
      h('h3', {}, tableIcon('book'), '战役 · ' + cp.name),
      h('div', { className: 'ah-campaign-scenario' }, st.scenario?.name || ''),
      h('ol', { className: 'ah-campaign-track' }, Array.from({ length: total }, (_, i) => {
        const result = results.find(item => item.scenarioIndex === i)
        return h('li', { className: result ? 'is-done' : i === index ? 'is-current' : '', 'aria-current': i === index ? 'step' : null },
          h('span', { className: 'ah-situ-medal' }, String(i + 1)),
          h('small', {}, result ? resultTitle(st, result) : i === index ? '进行中' : '未开启'))
      })),
      h('div', { className: 'ah-situ-tokens' },
        token('xp', 'star', '经验', cp.xp || 0),
        token('victory', 'shield', '累计胜利点', cp.victory || 0),
        token('victory-now', 'star', '本关胜利点', st.victory || 0)),
      cp.finished ? h('div', { className: 'ah-campaign-outcome is-' + cp.result }, cp.result === 'victory' ? '战役胜利' : cp.result === 'survived' ? '献祭后幸存' : '战役失败') : null,
      st.resolution ? h('p', { className: 'ah-campaign-resolution' },
        results.length ? resultTitle(st, results.at(-1)) : String(st.resolution).replace(/^r(\d+)$/, '结局 $1')) : null,
      cp.phase === 'interlude' ? h('p', { className: 'ah-campaign-note' }, '关间准备：逐位确认牌组、保留经验或购买已开放卡牌；完成后开始下一关。') : null,
      h('ul', { className: 'ah-campaign-records' }, Object.values(cp.investigators || {}).map(record => {
        const trauma = cp.trauma?.[record.seat] || {}
        const status = record.status === 'killed' ? '死亡' : record.status === 'insane' ? '疯狂' : '在役'
        return h('li', { 'data-campaign-seat': record.seat, className: 'is-' + (record.status || 'active') },
          h('strong', {}, record.name),
          h('span', { className: 'ah-campaign-xp' }, `${record.xp} XP（已花费 ${record.spentXp}）`),
          trauma.physical || trauma.mental ? h('small', {}, `创伤 肉体${trauma.physical || 0}/精神${trauma.mental || 0}`) : null,
          h('span', { className: 'ah-campaign-status' }, status))
      })),
      ...results.map(result => h('details', { className: 'ah-campaign-result' },
        h('summary', {}, `第 ${result.scenarioIndex + 1} 关 · ${resultTitle(st, result)} · 胜利点 ${result.victory}`),
        ...result.investigators.map(record => h('div', {},
          `${st.investigatorDefs?.[record.code]?.nameZh || record.code}：本关 +${record.xpAwarded} XP；肉体创伤 ${record.traumaAfter.physical}，精神创伤 ${record.traumaAfter.mental}`)))))
  }

  const storyPanel = s => {
    const assets = s.state.storyAssets || []
    if (!assets.length) return null
    return h('section', { className: 'ah-situ-panel ah-situ-story', role: 'region', 'aria-label': '剧情卡' },
      h('h3', {}, tableIcon('tarot'), '剧情卡'),
      h('div', { className: 'ah-situ-story-cards' }, assets.map(asset => {
        const code = typeof asset === 'string' ? asset : asset.code
        const name = (typeof asset === 'object' && asset.name) || cardName(s, code) || code
        return h('button', { type: 'button', className: 'ah-situ-story-card', 'aria-label': '查看剧情卡 ' + name, onclick: () => openCard(s, asset) },
          tableArt(h, code, name), h('small', {}, name))
      })))
  }

  const trapFocus = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
    if (event.key !== 'Tab') return
    const items = [...event.currentTarget.querySelectorAll('button:not([disabled]),summary,[href],[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.getClientRects().length)
    if (!items.length) return
    const first = items[0], last = items.at(-1), current = document.activeElement
    if (event.shiftKey && (current === first || current === event.currentTarget)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && current === last) { event.preventDefault(); first.focus() }
  }

  const build = (s, sync) => {
    const st = s.state
    const leave = action => { forget(); action() }
    const actingSeat = st.pendingChoice?.seat ?? st.currentSeat
    const actor = st.investigators.find(inv => inv.seat === actingSeat)
    const standing = st.investigators.filter(inv => !inv.defeated && !inv.resigned).length
    const dismiss = h('button', { type: 'button', className: 'ah-situ-close', 'aria-label': '关闭局势详情', onclick: close }, '关闭')
    return h('div', { className: 'bg-backdrop ah-situ-backdrop', onclick: close },
      h('section', { className: 'ah-situ-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '调查局势', tabindex: -1,
        onclick: event => event.stopPropagation(), onkeydown: trapFocus },
        header(st, dismiss),
        sync ? h('p', { className: 'ah-sync-message ah-situ-sync', role: 'status' }, sync) : null,
        st.pendingChoice ? h('div', { className: 'ah-situ-alert' }, tableIcon('hand'),
          h('span', {}, h('strong', {}, '待决选择'), `${actor?.name || '调查员'} 需要作出选择，请回到牌桌下方处理。`),
          h('button', { type: 'button', onclick: close }, '前往处理')) : null,
        h('div', { className: 'ah-situ-grid' }, phasePanel(st), scenarioPanel(st, leave)),
        h('section', { className: 'ah-situ-panel ah-situ-team', role: 'region', 'aria-label': '队伍条' },
          h('h3', {}, tableIcon('ally'), '调查队', h('small', {}, `${standing}/${st.investigators.length} 名仍在调查`)),
          h('div', { className: 'ah-situ-roster' }, st.investigators.map(inv => investigator(s, inv, actingSeat)))),
        campaignPanel(st),
        storyPanel(s)))
  }

  return {
    get opened() { return sessionId !== null },
    open(id) { sessionId = id; render() },
    reset: forget,
    render(session, { blocked = false, sync = null } = {}) {
      if (!sessionId) return null
      if (!session || session.sessionId !== sessionId) { forget(); return null }
      if (blocked) return null
      const key = JSON.stringify([sessionId, session.state.revision, sync, (session.players || []).map(p => [p.name, p.avatar])])
      const scroll = cached?.querySelector('.ah-situ-modal')?.scrollTop || 0
      const focused = cached?.contains(document.activeElement) ? document.activeElement : null
      if (cached && cachedKey === key) {
        const node = cached
        queueMicrotask(() => { if (node.isConnected) { node.querySelector('.ah-situ-modal').scrollTop = scroll; focused?.focus({ preventScroll: true }) } })
        return node
      }
      const first = !cached
      const next = build(session, sync)
      if (cached) retainTableArt(cached, next)
      cached = next; cachedKey = key
      queueMicrotask(() => {
        if (!next.isConnected) return
        next.querySelector('.ah-situ-modal').scrollTop = scroll
        if (first || focused) next.querySelector('.ah-situ-close')?.focus({ preventScroll: true })
      })
      return next
    },
  }
}
