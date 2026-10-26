// 局势：独立的调查档案弹窗。只读展示当前牌桌快照，不提交任何行动；
// 与混乱袋一样作为宿主 overlay 渲染，牌桌布局不再为它预留抽屉。
import { groupedChaosTokens } from './chaos-bag-view.js'
import { tableArt, retainTableArt } from './table-art.js'
import { tableIcon } from './table-components.js'
import { cardSymbol } from './card-text.js'
import { cardDisplayName } from './catalog.js'
// 第 127 轮：「书籍行动」调查员表在 web/ui-cards.js。
import { UI_CARDS } from './ui-cards.js'
// 第 4 步 P5：万象无终的公开剧本状态（幽灵牌堆 / 塔罗 / 裂口 / 火盆 / 看守人 / 遗留记忆）。
import { renderTcuCampaignPanel, tcuCampaignModel } from './tcu-ui.js'
// 界面词典：模块顶层只存 key，渲染期再调用 t()（docs/localization.md §8.2/§8.7）。
import { t } from './i18n.js'

const IMG = '/mods/arkhamhorror/img/'
const PHASES = [
  ['mythos', 'situation.phase.mythos.name', 'situation.phase.mythos.desc', 'eye'],
  ['investigation', 'situation.phase.investigation.name', 'situation.phase.investigation.desc', 'clue'],
  ['enemy', 'situation.phase.enemy.name', 'situation.phase.enemy.desc', 'sword'],
  ['upkeep', 'situation.phase.upkeep.name', 'situation.phase.upkeep.desc', 'resource'],
]
const STAGES = [['ST.1', 'situation.stage.begin'], ['ST.2', 'situation.stage.commit'], ['ST.3', 'situation.stage.reveal'],
  ['ST.4', 'situation.stage.effect'], ['ST.5', 'situation.stage.calculate'], ['ST.6', 'situation.stage.determine'],
  ['ST.7', 'situation.stage.resolve'], ['ST.8', 'situation.stage.end']]
const SKILLS = [['willpower', 'situation.skill.willpower'], ['intellect', 'situation.skill.intellect'], ['combat', 'situation.skill.combat'], ['agility', 'situation.skill.agility']]
const DIFFICULTY = { easy: 'hub.difficulty.easy', standard: 'hub.difficulty.standard', hard: 'hub.difficulty.hard', expert: 'hub.difficulty.expert' }
const CLASS_NAME = { guardian: 'situation.class.guardian', seeker: 'situation.class.seeker', mystic: 'situation.class.mystic', rogue: 'situation.class.rogue', survivor: 'situation.class.survivor', neutral: 'situation.class.neutral' }
const OUTCOME = { victory: 'situation.outcome.victory', survived: 'situation.outcome.survived', defeat: 'situation.outcome.defeat' }
const separator = () => t('situation.listSeparator')

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
      cp ? t('situation.header.campaign', { name: cp.name, index: (cp.scenarioIndex || 0) + 1, count: cp.scenarioCount || 3 }) : null,
      DIFFICULTY[st.difficulty] ? t('situation.difficultySuffix', { difficulty: t(DIFFICULTY[st.difficulty]) }) : null,
      over ? (OUTCOME[st.outcome] ? t(OUTCOME[st.outcome]) : t('situation.status.over')) : t('situation.status.playing'),
    ].filter(Boolean).join(' · ')
    return h('header', { className: 'ah-situ-head' },
      h('div', { className: 'ah-situ-round', title: t('situation.header.roundAria') }, h('small', {}, t('situation.header.round')), h('strong', {}, String(st.round || 1))),
      h('div', { className: 'ah-situ-title' },
        h('small', {}, t('situation.title')),
        h('h2', {}, st.scenario?.name?.split('：').at(-1) || st.scenario?.name || t('card.type.scenario')),
        h('p', {}, meta)),
      dismiss)
  }

  const phasePanel = st => {
    const playing = st.status === 'playing'
    const seat = st.pendingChoice?.seat ?? st.currentSeat
    const actor = st.investigators.find(inv => inv.seat === seat)
    const stage = st.skillTest ? STAGES.findIndex(([id]) => id === st.skillTest.stage) : -1
    const actions = Math.max(0, actor?.actionsLeft || 0)
    return h('section', { className: 'ah-situ-panel ah-situ-phase', role: 'region', 'aria-label': t('situation.phase.railAria') },
      h('h3', {}, tableIcon('star'), t('situation.phase.title')),
      h('ol', { className: 'ah-situ-phases' }, PHASES.map(([id, labelKey, detailKey, icon]) => {
        const current = playing && st.phase === id
        return h('li', { className: 'ah-situ-phase-step is-' + id + (current ? ' is-current' : ''), 'aria-current': current ? 'step' : null },
          h('span', { className: 'ah-situ-medal' }, tableIcon(icon)), h('strong', {}, t(labelKey)), h('small', {}, t(detailKey)))
      })),
      actor && playing ? h('div', { className: 'ah-situ-acting' },
        h('span', { className: 'ah-situ-acting-portrait' }, tableArt(h, actor.code, actor.name)),
        h('div', {},
          h('small', {}, st.pendingChoice ? t('situation.acting.waiting') : t('situation.acting.current')),
          h('strong', {}, actor.name),
          st.pendingChoice ? h('span', { className: 'ah-situ-acting-note' }, t('situation.acting.pending'))
            : pips(actions, Math.max(3, actions), 'action', t('situation.acting.remainingActions', { count: actions })))) : null,
      stage >= 0 ? h('div', { className: 'ah-situ-test' },
        h('small', {}, t('situation.test.committed', { count: st.skillTest.committed?.length || 0 })),
        h('ol', {}, STAGES.map(([id, labelKey], i) => {
          const label = t(labelKey)
          return h('li', { className: i < stage ? 'is-done' : i === stage ? 'is-current' : '', title: id + ' ' + label },
            h('span', {}, String(i + 1)), h('small', {}, label))
        }))) : null,
      h('small', { className: 'ah-rules-note' }, t('situation.rulesNote')))
  }

  const scene = (item, type, label, extra) => h('div', { className: 'ah-situ-scene is-' + type },
    h('button', { type: 'button', className: 'ah-situ-scene-card', disabled: !item, 'aria-label': t('situation.scene.viewAria', { label }),
      onclick: () => item && openDetail({ ...item, type }, { side: item.face || 'front' }) },
    item ? tableArt(h, item.originalCode || item.code, item.name, { landscape: true, face: item.face || 'front' }) : h('span', {}, t('situation.scene.ended'))),
    h('small', {}, label), h('strong', {}, item?.name || '—'), extra)

  const scenarioPanel = (st, leave) => {
    const act = st.acts?.[st.actIndex], agenda = st.agendas?.[st.agendaIndex]
    const doom = st.agendaDoom ?? st.doom ?? 0, threshold = agenda?.doomThreshold
    const extraDoom = Math.max(0, (st.totalDoom ?? doom) - doom)
    const objective = act?.objective, costsClues = ['clues', 'actClues'].includes(objective?.type)
    const required = costsClues ? (objective.perInvestigator || 0) * (st.numInvestigators || st.investigators.length) : null
    const clues = objective?.type === 'actClues' ? st.actClues || 0
      : st.investigators.filter(inv => !inv.defeated && !inv.resigned).reduce((sum, inv) => sum + (inv.clues || 0), 0)
    const bag = st.chaosBag || [], chaos = st.chaos || {}
    const encounter = st.encounterDeckSize ?? st.encounterDeck?.length ?? 0
    return h('section', { className: 'ah-situ-panel ah-situ-scenario', role: 'region', 'aria-label': t('situation.scenario.title') },
      h('h3', {}, tableIcon('book'), t('situation.scenario.title')),
      h('div', { className: 'ah-situ-scenes' },
        scene(agenda, 'agenda', t('card.type.agenda'), h('div', { className: 'ah-situ-progress is-doom' },
          h('span', {}, tableIcon('doom'), extraDoom
            ? t('situation.doom.withExtra', { doom, threshold: threshold ?? '?', extra: extraDoom })
            : t('situation.doom.progress', { doom, threshold: threshold ?? '?' })),
          h('span', { className: 'ah-situ-progress-track', 'aria-hidden': 'true' },
            Array.from({ length: Math.min(12, threshold || 6) }, (_, i) => h('i', { className: i < doom ? 'is-filled' : '' }))))),
        scene(act, 'act', t('card.type.act'), h('div', { className: 'ah-situ-progress is-clue' + (costsClues && clues >= required ? ' is-ready' : '') },
          h('span', {}, tableIcon('clue'), costsClues ? t('situation.clue.progress', { clues, required }) : t('situation.objective.complete')),
          costsClues ? h('span', { className: 'ah-situ-progress-track', 'aria-hidden': 'true' },
            Array.from({ length: Math.min(12, required || 0) }, (_, i) => h('i', { className: i < clues ? 'is-filled' : '' }))) : null))),
      h('div', { className: 'ah-situ-supplies' },
        h('button', { type: 'button', className: 'ah-situ-bag', 'aria-label': t('situation.bag.openAria'), 'aria-haspopup': 'dialog', onclick: () => leave(openChaosBag) },
          h('img', { src: IMG + 'ui/chaos-bag.webp', alt: '' }),
          h('span', { className: 'ah-situ-bag-copy' },
            h('strong', {}, t('chaos.bag.name')),
            h('small', {}, t('situation.bag.summary', {
              total: bag.length, revealed: chaos.revealed?.length || 0,
              sealed: chaos.sealed?.length || 0, removed: chaos.removed?.length || 0,
            })),
            h('span', { className: 'ah-situ-bag-tokens' }, groupedChaosTokens(bag).map(item =>
              h('span', { className: 'ah-situ-bag-token', title: t('situation.bag.tokenTitle', { label: item.label, count: item.count }) },
                item.src ? h('img', { src: item.src, alt: item.label, draggable: false }) : h('b', {}, item.label),
                item.count > 1 ? h('i', {}, '×' + item.count) : null))))),
        h('div', { className: 'ah-situ-encounter' },
          h('img', { src: IMG + 'backs/back_encounter.webp', alt: t('situation.encounter.backAlt') }),
          h('span', {}, h('strong', {}, t('situation.encounter.title')),
            h('small', {}, t('situation.encounter.summary', { count: encounter, discard: st.encounterDiscard?.length || 0 }))))))
  }

  const investigator = (s, inv, actingSeat) => {
    const st = s.state
    const player = s.players.find(p => p.seat === inv.seat) || s.players[inv.seat] || {}
    const out = inv.defeated || inv.resigned
    const active = st.status === 'playing' && !out && inv.seat === actingSeat
    const status = inv.defeated ? t('situation.investigator.status.defeated')
      : inv.resigned ? t('situation.investigator.status.resigned')
        : active ? (st.pendingChoice ? t('situation.investigator.status.choosing') : t('situation.investigator.status.acting'))
          : (st.turnsTaken || []).includes(inv.seat) ? t('situation.investigator.status.done') : t('situation.investigator.status.waiting')
    const klassKey = CLASS_NAME[String(inv.klass).toLowerCase()]
    const klass = st.classNames?.[inv.klass] || (klassKey ? t(klassKey) : null) || inv.klass || ''
    const location = st.locations?.find(loc => loc.id === inv.location)
    const engaged = (inv.engaged || []).map(id => st.enemies.find(enemy => enemy.id === id)?.name || id)
    const trauma = st.campaign?.trauma?.[inv.seat] || {}
    const hand = inv.handSize ?? inv.hand?.length ?? 0
    const deck = inv.deckSize ?? inv.deck?.length ?? 0
    const avatar = player.avatar || ''
    return h('article', { className: 'ah-situ-inv' + (active ? ' is-active' : '') + (out ? ' is-out' : ''), 'data-seat': inv.seat,
      style: { '--ah-class': st.classColors?.[inv.klass] || '#a58c56' }, 'aria-label': t('situation.investigator.aria', { name: inv.name, status }) },
      h('div', { className: 'ah-situ-inv-head' },
        h('button', { type: 'button', className: 'ah-situ-portrait', 'aria-label': t('situation.investigator.cardAria', { name: inv.name }),
          onclick: () => openDetail({ ...inv, type: 'investigator' }) }, tableArt(h, inv.code, inv.name)),
        h('div', { className: 'ah-situ-inv-id' },
          h('strong', {}, inv.name),
          h('small', {}, klass),
          h('span', { className: 'ah-situ-player' },
            h('span', { className: 'ah-situ-avatar', 'aria-hidden': 'true' }, /^(data:image\/|blob:|https?:\/\/|\/)/i.test(avatar) ? h('img', { src: avatar, alt: '' }) : (avatar || '👤')),
            player.name || (player.role === 'ai' ? t('situation.player.ai') : t('situation.player.human')))),
        h('span', { className: 'ah-situ-ribbon' }, status)),
      location ? h('div', { className: 'ah-situ-inv-loc' }, tableIcon('eye'), t('situation.investigator.atLocation', { location: location.name })) : null,
      h('div', { className: 'ah-situ-meters' },
        meter('health', 'health', t('situation.stat.health'), (inv.maxHealth || 0) - (inv.damage || 0), inv.maxHealth),
        meter('sanity', 'sanity', t('situation.stat.sanity'), (inv.maxSanity || 0) - (inv.horror || 0), inv.maxSanity)),
      h('div', { className: 'ah-situ-tokens' },
        token('resource', 'resource', t('situation.token.resources'), inv.resources ?? 0),
        token('clue', 'clue', t('situation.token.clues'), inv.clues ?? 0),
        token('action', 'action', t('situation.token.actions'), inv.actionsLeft ?? 0),
        UI_CARDS.tomeInvestigators.includes(inv.code) ? token('tome', 'book', t('situation.token.tome'), inv.tomeActionUsed ? 0 : 1) : null),
      h('div', { className: 'ah-situ-skills' }, SKILLS.map(([skill, labelKey]) => {
        const label = t(labelKey)
        return h('span', { className: 'ah-situ-skill', 'data-skill': skill, title: label },
          cardSymbol(h, skill), h('b', {}, String(effStat(s, inv, skill))), h('small', {}, label))
      })),
      h('div', { className: 'ah-situ-decks' },
        h('span', { className: 'ah-situ-deck' }, h('img', { src: IMG + 'backs/back_player.webp', alt: '' }),
          h('span', {}, h('b', {}, t('situation.deck.library', { count: deck })), h('small', {}, t('situation.deck.discard', { count: inv.discard?.length || 0 })))),
        h('span', { className: 'ah-situ-hand' },
          h('span', { className: 'ah-situ-fan', 'aria-hidden': 'true' }, Array.from({ length: Math.min(hand, 5) }, () => h('img', { src: IMG + 'backs/back_player.webp', alt: '' }))),
          h('span', {}, h('b', {}, t('situation.hand.count', { count: hand })), inv.seat === mySeat(s) ? null : h('small', {}, t('situation.hand.private'))))),
      engaged.length ? h('div', { className: 'ah-situ-engaged' }, tableIcon('sword'), t('situation.engaged', { names: engaged.join(separator()) })) : null,
      trauma.physical || trauma.mental ? h('div', { className: 'ah-situ-trauma' }, t('situation.trauma', { physical: trauma.physical || 0, mental: trauma.mental || 0 })) : null)
  }

  // 结算值可能是 `rN`（第 N 个结局）或 `noResolution`（协议值）；只有前者转成可读编号。
  const endingText = value => {
    const raw = String(value ?? '')
    const ending = /^r(\d+)$/.exec(raw)
    return ending ? t('situation.result.ending', { number: ending[1] }) : raw
  }

  const resultTitle = (st, result) => {
    const id = `${result.visitId || `${result.scenarioId}:${result.scenarioIndex}`}:result`
    const title = st.campaignStory?.entries?.find(entry => entry.id === id)?.resolutionTitle
    return title || (result.resolution
      ? endingText(result.resolution).replace('noResolution', t('situation.result.noResolution'))
      : t('situation.result.pending'))
  }

  const campaignPanel = st => {
    const cp = st.campaign
    if (!cp) return null
    const total = cp.scenarioCount || 3, index = cp.scenarioIndex || 0, results = cp.scenarioResults || []
    return h('section', { className: 'ah-situ-panel ah-campaign-panel', role: 'region', 'aria-label': t('situation.campaign.aria') },
      h('h3', {}, tableIcon('book'), t('situation.campaign.title', { name: cp.name })),
      h('div', { className: 'ah-campaign-scenario' }, st.scenario?.name || ''),
      h('ol', { className: 'ah-campaign-track' }, Array.from({ length: total }, (_, i) => {
        const result = results.find(item => item.scenarioIndex === i)
        return h('li', { className: result ? 'is-done' : i === index ? 'is-current' : '', 'aria-current': i === index ? 'step' : null },
          h('span', { className: 'ah-situ-medal' }, String(i + 1)),
          h('small', {}, result ? resultTitle(st, result) : i === index ? t('situation.campaign.current') : t('situation.campaign.locked')))
      })),
      h('div', { className: 'ah-situ-tokens' },
        token('xp', 'star', t('situation.campaign.xp'), cp.xp || 0),
        token('victory', 'shield', t('situation.campaign.totalVictory'), cp.victory || 0),
        token('victory-now', 'star', t('situation.campaign.scenarioVictory'), st.victory || 0)),
      cp.finished ? h('div', { className: 'ah-campaign-outcome is-' + cp.result },
        cp.result === 'victory' ? t('situation.campaign.outcome.victory')
          : cp.result === 'survived' ? t('situation.campaign.outcome.survived') : t('situation.campaign.outcome.defeat')) : null,
      st.resolution ? h('p', { className: 'ah-campaign-resolution' },
        results.length ? resultTitle(st, results.at(-1)) : endingText(st.resolution)) : null,
      cp.phase === 'interlude' ? h('p', { className: 'ah-campaign-note' }, t('situation.campaign.interludeNote')) : null,
      suppliesPanel(cp),
      tfaStatusPanel(st),
      carcosaStatusPanel(st),
      renderTcuCampaignPanel(h, tcuCampaignModel(st)),
      h('ul', { className: 'ah-campaign-records' }, Object.values(cp.investigators || {}).map(record => {
        const trauma = cp.trauma?.[record.seat] || {}
        const status = record.status === 'killed' ? t('situation.record.status.killed')
          : record.status === 'insane' ? t('situation.record.status.insane') : t('situation.record.status.active')
        return h('li', { 'data-campaign-seat': record.seat, className: 'is-' + (record.status || 'active') },
          h('strong', {}, record.name),
          h('span', { className: 'ah-campaign-xp' }, t('situation.record.xp', { xp: record.xp, spent: record.spentXp })),
          trauma.physical || trauma.mental ? h('small', {}, t('situation.record.trauma', { physical: trauma.physical || 0, mental: trauma.mental || 0 })) : null,
          h('span', { className: 'ah-campaign-status' }, status))
      })),
      ...results.map(result => h('details', { className: 'ah-campaign-result' },
        h('summary', {}, t('situation.result.summary', { index: result.scenarioIndex + 1, title: resultTitle(st, result), victory: result.victory })),
        ...result.investigators.map(record => h('div', {},
          t('situation.result.investigator', {
            name: cardDisplayName(st.investigatorDefs?.[record.code]) || record.code,
            xp: record.xpAwarded,
            physical: record.traumaAfter.physical,
            mental: record.traumaAfter.mental,
          }))))))
  }

  // 补给品是公开信息：直接读战役投影里的 supplies，标签随 campaign.supplyLabels 下发。
  const suppliesPanel = cp => {
    const supplies = cp.supplies || {}
    const labels = cp.supplyLabels || {}
    const entries = Object.entries(supplies).filter(([, list]) => Array.isArray(list) && list.length)
    if (!entries.length) return null
    const grouped = list => {
      const counts = new Map()
      for (const name of list) counts.set(name, (counts.get(name) || 0) + 1)
      return [...counts]
    }
    return h('div', { className: 'ah-campaign-supplies', role: 'group', 'aria-label': t('situation.supplies.title') },
      h('h4', {}, tableIcon('supply'), t('situation.supplies.title')),
      h('ul', {}, entries.sort(([left], [right]) => Number(left) - Number(right)).map(([seat, list]) => {
        const record = cp.investigators?.[seat]
        return h('li', { 'data-supply-seat': seat },
          h('strong', {}, record?.name || t('situation.seat', { number: Number(seat) + 1 })),
          h('span', {}, grouped(list).map(([name, count]) =>
            `${labels[name] || name}${count > 1 ? `×${count}` : ''}`).join(separator())))
      })))
  }

  // 失落的时代独有的公开剧本状态：复仇合计、伊格之怒、深度、石柱、漆黑、探索牌库与遗物位置。
  const tfaStatusPanel = st => {
    const cp = st.campaign
    if (cp?.id !== 'theForgottenAge') return null
    const flags = st.scenarioFlagsPublic || {}
    const exploration = st.exploration || { deck: 0, discard: [] }
    const relic = st.relicOfAges
    const holder = relic?.seat != null
      ? (st.investigators || []).find(inv => inv.seat === relic.seat)?.name : null
    const place = relic?.location != null
      ? (st.locations || []).find(location => location.id === relic.location)?.name : null
    const threads = st.threadsOfFate
    const alejandro = threads?.alejandro
    const alejandroPlace = alejandro?.location != null
      ? (st.locations || []).find(location => location.id === alejandro.location)?.name : null
    const preyNames = (threads?.prey || []).map(id => (st.enemies || []).find(enemy => enemy.id === id)?.name).filter(Boolean)
    const destinationNames = (threads?.destinations || [])
      .map(id => (st.locations || []).find(location => location.id === id)?.name || id)
    const depths = st.depths
    const rows = [
      [t('situation.tfa.vengeance'), String(st.vengeance ?? 0), 'sword'],
      [t('situation.tfa.yigsFury'), String(st.yigsFury ?? 0), 'doom'],
      ...(flags.depthLevel != null ? [[t('situation.tfa.depthLabel'), t('situation.tfa.depth', { level: flags.depthLevel }), 'action']] : []),
      ...(depths ? [[t('situation.tfa.pursuit'), t('situation.tfa.cards', { count: depths.pursuit.length }), 'sword']] : []),
      ...(depths && depths.childrenOfValusia.length
        ? [[t('situation.tfa.childrenOfValusia'), t('situation.tfa.cards', { count: depths.childrenOfValusia.length }), 'sword']] : []),
      ...(depths && depths.agendaAttachments.length
        ? [[t('situation.tfa.agendaAttachments'), t('situation.tfa.cards', { count: depths.agendaAttachments.length }), 'doom']] : []),
      ...(flags.pillars != null ? [[t('situation.tfa.pillars'), t('situation.tfa.marks', { count: flags.pillars }), 'star']] : []),
      ...(st.timeline && (st.timeline.ancient || st.timeline.modern)
        ? [[t('situation.tfa.timelineLabel'), t('situation.tfa.timeline', { ancient: st.timeline.ancient, modern: st.timeline.modern }), 'action']] : []),
      ...(flags.deepDark ? [[t('situation.tfa.deepDark'), t('situation.tfa.places', { count: flags.deepDark }), 'eye']] : []),
      [t('situation.tfa.explorationLabel'), t('situation.tfa.exploration', { deck: exploration.deck, discard: exploration.discard.length }), 'clue'],
      ...(relic ? [[t('situation.tfa.relic'), holder ? t('situation.tfa.carriedBy', { name: holder })
        : place ? t('situation.tfa.atLocation', { location: place }) : t('situation.tfa.notInPlay'), 'book']] : []),
      ...(alejandro
        ? [[t('situation.tfa.alejandro'), alejandro.enemyId ? t('situation.tfa.takenByEnemy')
          : alejandroPlace ? t('situation.tfa.atLocation', { location: alejandroPlace }) : t('situation.tfa.unknown'), 'book']]
        : []),
      ...(preyNames.length ? [[t('situation.tfa.itaquaPrey'), preyNames.join(separator()), 'sword']] : []),
      ...(destinationNames.length ? [[t('situation.tfa.itaquaDestinations'), destinationNames.join(separator()), 'action']] : []),
    ]
    return h('div', { className: 'ah-campaign-tfa', role: 'group', 'aria-label': t('situation.tfa.aria') },
      h('h4', {}, tableIcon('tarot'), t('situation.tfa.title')),
      h('ul', {}, rows.map(([label, value, icon]) => h('li', {},
        h('span', {}, tableIcon(icon), label), h('strong', {}, value)))))
  }

  // 卡尔克萨之路的公开剧本状态：疑惑/确信、黑星升起的两套密谋与「道路」、
  // 苍白面具的地下墓穴牌库、邪秽誓约的钥匙。数据来自 campaign-view.js 的公开投影，
  // 不含未翻开牌序或未揭示地点身份。
  const carcosaStatusPanel = st => {
    const cp = st.campaign
    if (cp?.id !== 'thePathToCarcosa') return null
    const records = cp.records || {}
    const doubt = Number(records.doubt || 0), conviction = Number(records.conviction || 0)
    const bsr = st.blackStarsRise
    const pallid = st.thePallidMask
    const oath = st.theUnspeakableOath
    const rows = []
    if (doubt || conviction) {
      rows.push([t('situation.carcosa.doubtConviction'),
        t('situation.carcosa.doubtConvictionValue', { doubt, conviction }), 'star'])
    }
    if (bsr) {
      rows.push([t('situation.carcosa.route'), bsr.route === 'below' ? t('situation.carcosa.routeBelow')
        : bsr.route === 'above' ? t('situation.carcosa.routeAbove') : t('situation.carcosa.unknown'), 'action'])
      rows.push([t('situation.carcosa.path'),
        bsr.openPath ? t('situation.carcosa.pathOpen') : t('situation.carcosa.pathClosed'), 'book'])
      for (const [id, labelKey] of [['a', 'situation.carcosa.deckA'], ['c', 'situation.carcosa.deckC']]) {
        const deck = bsr.decks?.[id]
        if (!deck) continue
        if (deck.removed) rows.push([t(labelKey), t('situation.carcosa.deckRemoved'), 'doom'])
        else {
          const name = deck.current ? (cardName({ state: st }, deck.current) || deck.current) : t('situation.carcosa.unknown')
          rows.push([t(labelKey), t('situation.carcosa.deckValue', {
            card: name, doom: deck.doom, index: Math.min(deck.index + 1, deck.size || 1), size: deck.size || 1,
          }), 'doom'])
        }
      }
    }
    if (pallid) {
      rows.push([t('situation.carcosa.catacombs'),
        t('situation.carcosa.catacombsValue', { count: pallid.catacombs }), 'clue'])
      rows.push([t('situation.carcosa.tomb'), pallid.tombRevealed
        ? t('situation.carcosa.tombRevealed', { name: pallid.tombName || t('situation.carcosa.unknown') })
        : t('situation.carcosa.tombHidden'), 'eye'])
    }
    if (oath) {
      rows.push([t('situation.carcosa.keys'), t('situation.carcosa.keysValue', { count: oath.keysFound }), 'action'])
    }
    if (!rows.length) return null
    return h('div', { className: 'ah-campaign-tfa ah-campaign-carcosa', role: 'group', 'aria-label': t('situation.carcosa.aria') },
      h('h4', {}, tableIcon('eye'), t('situation.carcosa.title')),
      h('ul', {}, rows.map(([label, value, icon]) => h('li', {},
        h('span', {}, tableIcon(icon), label), h('strong', {}, value)))))
  }

  const storyPanel = s => {
    const assets = s.state.storyAssets || []
    if (!assets.length) return null
    return h('section', { className: 'ah-situ-panel ah-situ-story', role: 'region', 'aria-label': t('situation.story.title') },
      h('h3', {}, tableIcon('tarot'), t('situation.story.title')),
      h('div', { className: 'ah-situ-story-cards' }, assets.map(asset => {
        const code = typeof asset === 'string' ? asset : asset.code
        const name = (typeof asset === 'object' && asset.name) || cardName(s, code) || code
        // 剧情卡也可能是规则代号（如 frozenInFear），卡图按原卡号取。
        const artCode = (typeof asset === 'object' && asset.originalCode) || s.state.cards?.[code]?.originalCode || code
        const clues = Number(asset?.clues || 0)
        const clueText = clues ? t('situation.story.clues', { count: clues }) : ''
        return h('button', { type: 'button', className: 'ah-situ-story-card', 'aria-label': t('situation.story.viewAria', { name, clues: clueText }), onclick: () => openCard(s, asset) },
          tableArt(h, artCode, name), h('small', {}, name),
          ...(clues ? [h('small', { className: 'ah-situ-story-clues' }, `🔍 ${clues}`)] : []))
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
    const dismiss = h('button', { type: 'button', className: 'ah-situ-close', 'aria-label': t('situation.closeAria'), onclick: close }, t('common.close'))
    return h('div', { className: 'bg-backdrop ah-situ-backdrop', onclick: close },
      h('section', { className: 'ah-situ-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('situation.title'), tabindex: -1,
        onclick: event => event.stopPropagation(), onkeydown: trapFocus },
        header(st, dismiss),
        sync ? h('p', { className: 'ah-sync-message ah-situ-sync', role: 'status' }, sync) : null,
        st.pendingChoice ? h('div', { className: 'ah-situ-alert' }, tableIcon('hand'),
          h('span', {}, h('strong', {}, t('situation.pending.title')), t('situation.pending.body', { name: actor?.name || t('card.type.investigator') })),
          h('button', { type: 'button', onclick: close }, t('situation.pending.go'))) : null,
        h('div', { className: 'ah-situ-grid' }, phasePanel(st), scenarioPanel(st, leave)),
        h('section', { className: 'ah-situ-panel ah-situ-team', role: 'region', 'aria-label': t('situation.team.aria') },
          h('h3', {}, tableIcon('ally'), t('situation.team.title'),
            h('small', {}, t('situation.team.standing', { standing, total: st.investigators.length }))),
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
