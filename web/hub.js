import { renderRulesText } from './card-text.js'
import { registerDeckRules, validateDeckRules, cardAllowedByScope, campaignCycle, normalizeCardPoolScope, CARD_POOL_SCOPE_LABELS, CARD_POOL_RESTRICTION_ENABLED } from './deck-rules.js'
import { parseArkhamDbInput, loadArkhamDbDeck, planArkhamDbImport } from './arkhamdb-import.js'
import { listLocalDecks, saveLocalDeck, deleteLocalDeck } from './deck-library.js'
import { tableArt } from './table-art.js'
import { tableIcon, classIcon } from './table-components.js'
import { cardDisplayName, cardDisplayText, cardDisplayTraits } from './catalog.js'
import { t } from './i18n.js'
import { renderStoryReader } from './story-reader.js'
import { cardSource, filterCards, renderCardFilters } from './card-filters.js'
import { campaignPresentation, presentationAttributes } from './campaign-presentation.js'
import { renderSupplyPicker, supplyPickerModel } from './supply-picker.js'
import { captureScrollState, restoreScrollWhenMounted } from './scroll-state.js'
import { installCardZoom } from './card-zoom.js'
import { recordValueText, recordChangeText } from './campaign-records.js'
import { modePanelModel } from './hub-mode-view.js'
import { departureLanes } from './departure-lanes.js'
// 第 4 步 P5：万象无终的待决选择面板（塔罗抽牌 / 序章选人）也走大厅这一层——
// 这两个选择发生在进入剧本之前的准备阶段，uiState 还是 campaignHub / scenarioSetup。
import {
  hauntedChoiceModel, renderHauntedChoice, renderStoryInvestigatorPicker, renderTarotPicker,
  storyInvestigatorPickerModel, tarotPickerModel,
} from './tcu-ui.js'
// 界面文案统一走 web/i18n.js 的 t()（缺失时回退 zh-CN 源文案），见 docs/localization.md §8.7 第三步。
// 模块顶层不能调用 t()（导入时求值会把语言固定在加载瞬间）；数据表只存 key，渲染期再取文案。
const STAGE_KEYS = {
  campaignHub: 'hub.stage.campaignHub', scenarioSetup: 'hub.stage.scenarioSetup',
  inScenario: 'hub.stage.inScenario', scenario: 'hub.stage.inScenario',
  scenarioResult: 'hub.stage.scenarioResult', interlude: 'hub.stage.interlude',
  campaignResult: 'hub.stage.campaignResult',
}
const stageLabel = value => t(STAGE_KEYS[value] || STAGE_KEYS.inScenario)
const DIFFICULTY_KEYS = { easy: 'hub.difficulty.easy', standard: 'hub.difficulty.standard', hard: 'hub.difficulty.hard', expert: 'hub.difficulty.expert' }
const difficultyLabel = value => DIFFICULTY_KEYS[value] ? t(DIFFICULTY_KEYS[value]) : value
const CLASS_KEYS = {
  guardian: 'hub.class.guardian', seeker: 'hub.class.seeker', rogue: 'hub.class.rogue',
  mystic: 'hub.class.mystic', survivor: 'hub.class.survivor', neutral: 'hub.class.neutral',
}
const classLabel = value => CLASS_KEYS[value] ? t(CLASS_KEYS[value]) : value
// 选调查员时的扩展包署名：核心包沿用档案口径，其余循环复用卡牌筛选的系列表，
// 所以新增循环（失落的时代、万象无终……）不必在两张表里各写一遍中文名。
const PACK_KEYS = { core: 'hub.pack.core' }
function packLabel(pack, englishName = '') {
  if (!pack) return t('hub.investigator.fallbackName')
  if (PACK_KEYS[pack]) return t(PACK_KEYS[pack])
  const series = cardSource({ pack, packName: englishName }).packName
  return series && series !== pack ? series : englishName || pack
}
const OUTCOME_KEYS = { noResolution: 'hub.outcome.noResolution', defeat: 'hub.outcome.defeat', survived: 'hub.outcome.survived', victory: 'hub.outcome.victory' }
const outcomeName = value => OUTCOME_KEYS[value] ? t(OUTCOME_KEYS[value])
  : String(value ?? t('hub.outcome.pending')).replace(/^r(\d+)$/, (_, number) => t('hub.outcome.resolution', { number }))
const PACK_STATUS_KEYS = {
  playable: 'hub.packStatus.playable', verified: 'hub.packStatus.verified',
  development: 'hub.packStatus.development', 'catalog-only': 'hub.packStatus.catalogOnly',
}
const packStatusLabel = value => PACK_STATUS_KEYS[value] ? t(PACK_STATUS_KEYS[value]) : value
// Arkham-only campaign shell. The hall provides transport and generic modal hosting.
export function createHubUI({ h, api, render, state, startGame, loadSavedSession, renderOnlineSetup,
  rememberSession, leave, submitMove, refreshSession, catalogOpen, rulebookOpen, inspectCard, canAct = () => true,
  openFeedback }) {
  installCardZoom(h)
  // 页签在每次渲染时按当前语言生成，onLocaleChange 后重绘即可切换（无需重新加载模块）。
  const tabLabels = () => [
    ['departure', t('hub.tab.departure')],
    ['overview', t('hub.tab.overview')], ['scenarios', t('hub.tab.scenarios')], ['investigators', t('hub.tab.investigators')],
    ['deck', t('hub.tab.deck')], ['upgrades', t('hub.tab.upgrades')], ['supplies', t('hub.tab.supplies')], ['records', t('hub.tab.records')],
    ['story', t('hub.tab.story')],
  ]
  const TAB_ICONS = { departure: 'action', overview: 'clue', scenarios: 'eye', investigators: 'shield',
    deck: 'book', upgrades: 'star', supplies: 'supply', records: 'leaf', story: 'book' }
  // 局外页面的反馈入口：宿主注入 openFeedback 时才出现，旧版大厅下自动隐藏。
  const feedbackEntry = () => typeof openFeedback === 'function'
    ? h('button', { className: 'bg-btn secondary ah-feedback-entry', title: t('hub.feedback'), 'aria-label': t('hub.feedback'),
      onclick: () => openFeedback() }, t('hub.feedback.button'))
    : null
  // 补给品是失落的时代的战役机制；标了 supplyLabels 的战役才会多出这一页。
  const supportsSupplies = campaign => Object.keys(campaign?.supplyLabels || {}).length > 0
  const game = () => state.catalog.find(item => item.id === 'arkhamhorror')
  const legal = (s, action) => (s.state.legalMoves || []).filter(move => move.action === action)
  // Seat preparation is simultaneous: the server lists every seat that may act now.
  const actingSeats = s => s.actingSeats ?? [s.state.pendingChoice?.seat ?? s.state.currentSeat]
  const acting = (s, seat) => actingSeats(s).includes(seat)
  const locked = s => state.busy || !actingSeats(s).some(seat => canAct(s, seat))
  const resultStory = (s, result) => {
    const id = `${result.visitId || `${result.scenarioId}:${result.scenarioIndex}`}:result`
    return s.state.campaignStory?.entries?.find(entry => entry.id === id)
  }
  const resultName = (s, result) => resultStory(s, result)?.resolutionTitle || outcomeName(result.resolution)
  const nameOf = (g, code) => cardDisplayName(state.session?.state.cards?.[code]) || cardDisplayName(g.clientData?.deckBuilder?.cardPool.find(card => card.code === code)) || t('hub.cardFallback')
  const art = (code, name) => tableArt(h, code, name)
  // 关卡内页面的插图必须带上已选关卡：不传 scenarioId 时只能拿到战役封面。
  const decor = (name, className = '', scenarioId = '') => {
    const campaignId = state.session?.state?.campaign?.id || state.setup?.form?.campaignId
    const assets = campaignPresentation(campaignId, scenarioId).assets
    const key = ({ manor: 'hubHero', desk: 'hubDesk', casefile: 'casefile', scene: 'storyDefault' })[name] || name
    return h('img', { className: 'ah-office-decor ' + className, src: assets[key], alt: '', draggable: 'false', 'aria-hidden': 'true' })
  }
  const portrait = inv => h('div', { className: 'ah-office-portrait' }, art(inv.code, inv.name))
  const playerBadge = (s, seat) => {
    const player = s.players.find(item => item.seat === seat)
    const name = player?.name || t('hub.player.name', { seat: seat + 1 }), avatar = player?.avatar || '👤'
    return h('span', { className: 'ah-office-player', 'data-player-seat': seat },
      h('span', { className: 'ah-office-player-avatar', 'aria-hidden': 'true' }, /^(data:image\/|blob:|https?:\/\/|\/)/i.test(avatar)
        ? h('img', { src: avatar, alt: '' }) : avatar), h('span', {}, name))
  }
  const recordDeckReady = record => record?.status === 'active' && record.startingDeckReady !== false
    && (record.deckSize ?? record.deck?.length ?? 0) > 0
  // 双线战役的座位记录可能只在 parts[line] 快照里（首次整备时 currentPart 为空），
  // 出发准备/席位确认必须按「座位所属线」取记录，不能只看顶层。
  const recordForSeat = (s, seat) => {
    const campaign = s.state.campaign
    const lane = campaign.seatParts?.[seat]
    const laneRecords = lane && campaign.parts?.[lane]?.investigators
    const list = Array.isArray(laneRecords) ? laneRecords
      : laneRecords && typeof laneRecords === 'object' ? Object.values(laneRecords) : []
    const fromPart = list.find(record => record?.seat === seat) || null
    const top = campaign.investigators?.[seat] || null
    // 当前线的权威记录在顶层。并行时 currentPart 为空，两条线的记录都在 parts。
    if (lane && lane !== (campaign.currentPart ?? null)) return fromPart || top
    return top || fromPart
  }
  const seatPrepared = (s, inv) => {
    const record = recordForSeat(s, inv.seat)
    // Teammates expose only deckSize; their private deck must stay hidden.
    return !!s.state.hubSeatDone?.[inv.seat] && recordDeckReady(record) && !record.upgradeDraft
  }
  const canDepart = s => s.state.uiState === 'scenarioSetup' && s.state.hubReady && !s.state.pendingChoice
    && !(legal(s, 'hubBeginScenario')[0]?.disabled)
    && s.state.campaign.leadConfirmed !== false && s.players.some(p => p.seat === s.state.campaign.leadSeat && p.role === 'human')
    && s.state.investigators.every(inv => seatPrepared(s, inv)) && legal(s, 'hubBeginScenario').length > 0
  // 幕间叙事：当前剧情节点的纪事条目（含结算过程中已经到达的段落）。
  const currentFlowStory = s => {
    const nodeId = s.state.campaign?.flow?.nodeId
    if (!nodeId) return null
    return (s.state.campaignStory?.entries || []).filter(entry => entry.nodeId === nodeId).at(-1) || null
  }
  const interludeBriefing = (s, compact = false) => {
    const entry = currentFlowStory(s)
    if (!entry) return null
    return h('section', { className: 'ah-hub-interlude' + (compact ? ' is-compact' : ''), 'aria-label': t('hub.interlude.title') },
      h('small', {}, t('hub.interlude.title')),
      h('h2', {}, entry.title),
      ...(entry.paragraphs || []).map(paragraph =>
        h('p', { className: 'ah-hub-interlude-prose' }, renderRulesText(h, paragraph, { links: false }))))
  }
  const metric = (icon, value, label) => h('span', { className: 'ah-office-metric', title: label }, tableIcon(icon), h('b', {}, String(value ?? 0)), h('small', {}, label))
  const investigatorInfo = inv => {
    const optionText = option => {
      const factions = option.factions || option.faction || []
      const classes = factions.length ? factions.map(klass => classLabel(klass)).join(t('hub.list.separator')) : t('hub.investigator.anyClass')
      const level = option.level || { min: 0, max: 0 }
      return t('hub.investigator.optionLevel', { classes, min: level.min ?? 0, max: level.max ?? 0 })
        + (option.limit ? t('hub.investigator.optionLimit', { limit: option.limit }) : '')
    }
    const signatureLinks = cards => cards.flatMap((card, index) => [
      index ? t('hub.list.separator') : null,
      h('button', {
        type: 'button',
        className: 'ah-investigator-signature-link',
        'aria-label': t('hub.card.inspect', { name: card.name }),
        onclick: () => inspectCard(card.code),
      }, card.name),
    ])
    const signatures = [...(inv.signatureCards || []), ...(inv.signatureWeaknesses || [])]
    return h('div', { className: 'ah-investigator-info' },
    h('div', { className: 'ah-investigator-vitals', 'aria-label': t('hub.investigator.vitalsAria') },
      metric('health', inv.health, t('hub.vital.health')), metric('sanity', inv.sanity, t('hub.vital.sanity')),
      inv.traits?.length ? h('span', { className: 'ah-investigator-traits' }, inv.traits.join(' · ')) : null),
    inv.abilityText ? h('section', { className: 'ah-investigator-rules' }, h('h3', {}, t('hub.investigator.abilityTitle')),
      h('p', {}, renderRulesText(h, inv.abilityText))) : null,
    inv.rules ? h('details', { className: 'ah-investigator-disclosure' }, h('summary', {}, t('hub.investigator.rulesTitle')),
      h('p', {}, t('hub.investigator.deckSize', { count: inv.deckSize || inv.rules.size || 30 })),
      ...(inv.rules.options || []).map(option => h('p', {}, optionText(option))),
      signatures.length ? h('p', {}, t('hub.investigator.signatureCards'), signatureLinks(signatures), t('hub.investigator.signatureNote')) : null) : null,
    inv.code ? h('button', { className: 'ah-investigator-dossier-link', onclick: () => inspectCard(inv.code) },
      tableIcon('book'), t('hub.investigator.dossier')) : null)
  }
  const changeTab = tab => { state.arkhamHubTab = tab; render() }
  const cardFilters = scope => Object.fromEntries(['search','type','klass','cost','xp','campaign','pack','sort']
    .map(key=>[key,state[`${scope}Filters`]?.[key] || '']))
  const filterControls = (scope, cards, shown) => renderCardFilters(h, {
    scope, cards, count: shown.length, filters: cardFilters(scope),
    onChange: filters => { state[`${scope}Filters`] = filters; render() },
  })
  // The host replaces its tree on every state update. Keep passive media alive
  // across those updates so lazy card art never flashes back to a placeholder.
  function stablePanel(selector, build) {
    const previous = document.querySelector(selector)
    const scroll = captureScrollState(previous)
    const active = document.activeElement
    const focusedSelect = previous?.contains(active) && active.tagName === 'SELECT'
      ? [...previous.querySelectorAll('select')].indexOf(active) : -1
    const focusKey = previous?.contains(active) ? active.dataset.focusKey : null
    const next = build()
    const panel = next?.matches(selector) ? next : next?.querySelector(selector)
    if (!panel) return next
    let preferenceKey = ''
    try { preferenceKey = localStorage.getItem('arkham.presentation') || '' } catch {}
    panel.dataset.presentationKey = preferenceKey
    if (previous?.dataset.presentationKey === preferenceKey) {
      const mediaKey = el => el.matches('.ah-table-art')
        ? `card:${el.dataset.artCode}:${el.dataset.artFace}:${el.dataset.artPreference}:${el.className}:${el.getAttribute('aria-label')}` : `decor:${el.getAttribute('src')}:${el.className}`
      const media = new Map()
      for (const el of previous.querySelectorAll('.ah-table-art, .ah-office-decor')) {
        const key = mediaKey(el)
        if (!media.has(key)) media.set(key, [])
        media.get(key).push(el)
      }
      for (const el of panel.querySelectorAll('.ah-table-art, .ah-office-decor')) {
        const retained = media.get(mediaKey(el))?.shift()
        if (retained) el.replaceWith(retained)
      }
    }
    // Restore after the host attaches the new tree, before the browser paints.
    // Context-marked lists reset only when their contents actually change.
    queueMicrotask(() => {
      if (!panel.isConnected) return
      if (focusedSelect >= 0) panel.querySelectorAll('select')[focusedSelect]?.focus({ preventScroll: true })
      if (focusKey) [...panel.querySelectorAll('[data-focus-key]')].find(el => el.dataset.focusKey === focusKey && !el.disabled)?.focus({ preventScroll: true })
    })
    restoreScrollWhenMounted(panel, scroll)
    return next
  }
  const team = s => h('div', { className: 'ah-office-team' }, s.state.investigators.map(inv => h('button', {
    className: 'ah-office-teammate', onclick: () => changeTab('investigators'), 'aria-label': t('hub.investigator.inspectName', { name: inv.name }),
  }, portrait(inv), h('span', {}, h('strong', {}, inv.name), playerBadge(s, inv.seat)))))

  // keepCurrent：刷新存档时保留已显示的列表（页签切换用），避免先闪一帧「读取中」再重排弹窗。
  async function loadSaves({ keepCurrent = false } = {}) {
    if (!keepCurrent) { state.arkhamSaves = null; render() }
    try {
      const response = await api('GET', '/sessions')
      state.arkhamSaves = response.sessions.filter(item => item.modId === 'arkhamhorror')
      state.arkhamPersist = response.persist
      state.arkhamSaveError = null
    } catch (error) {
      state.arkhamSaves = []
      state.arkhamSaveError = String(error.message)
    }
    render()
  }

  function onOpenSetup() {
    state.arkhamSetupTab = 'new'
    state.arkhamSaveMode = 'solo'
    state.arkhamDeleteConfirmId = null
    state.arkhamAiSettingsOpen = false
    state.arkhamGameSettingsOpen = false
    // 两页内容高度不同：记录「新游戏」页自然高度，切到存档页时用它锁住弹窗。
    state.arkhamSetupStableHeight = null
    state.arkhamSaveError = null
    state.arkhamSaveNotice = null
    loadSaves()
  }

  // 存档页比新游戏页矮：切换前先量下当前弹窗高度，交给 CSS 的 --ah-entry-stable-h 锁住，
  // 否则居中的弹窗会随着内容变矮整体下跳。已加载过存档时保留列表并后台刷新，不再闪加载态。
  function openSavesTab() {
    const modal = document.querySelector('.ah-hub-setup')
    // 取亚像素高度：整数 offsetHeight 会让锁定值与自然高度差半像素。
    if (modal && state.arkhamSetupTab !== 'saves') {
      state.arkhamSetupStableHeight = Math.round(modal.getBoundingClientRect().height * 100) / 100
    }
    state.arkhamSetupTab = 'saves'
    if (state.arkhamSaves === null) { render(); return }
    const loaded = Array.isArray(state.arkhamSaves)
    if (loaded) render()
    loadSaves({ keepCurrent: loaded })
  }

  function select(options, value, onChange, attrs = {}) {
    return h('select', { value: String(value), ...attrs, onchange: event => onChange(event.target.value) },
      options.map(option => h('option', { value: String(option.value), selected: String(option.value) === String(value) }, option.label)))
  }

  const cardPoolLabel = scope => CARD_POOL_SCOPE_LABELS[normalizeCardPoolScope(scope)]
  const rollbackLabel = value => value === 'off' ? t('hub.rollback.disabled') : t('hub.rollback.enabled')

  function renderAiDialogueSettings(g) {
    const values = [
      [t('hub.ai.story'), state.setup.form.aiStoryAwareness === 'on' ? t('hub.toggle.on') : t('hub.toggle.off')],
      [t('hub.ai.summary.routine'), state.setup.form.aiRoutineSpeechFrequency],
      [t('hub.ai.summary.selfTest'), state.setup.form.aiSelfTestSpeechFrequency],
      [t('hub.ai.summary.otherTest'), state.setup.form.aiOtherTestSpeechFrequency],
      [t('hub.ai.summary.enemyDefeat'), state.setup.form.aiEnemyDefeatSpeechFrequency],
    ].map(([label, value]) => `${label} ${value}${typeof value === 'number' ? '%' : ''}`).join(' · ')
    return h('section', { className: 'ah-ai-dialogue-settings' },
      h('span', {}, h('strong', {}, t('hub.ai.title')), h('small', {}, values)),
      h('button', { type: 'button', className: 'bg-btn secondary',
        onclick: () => { state.arkhamAiSettingsOpen = true; render() } }, t('hub.ai.edit')))
  }

  // 「游戏高级设置」与 AI 高级设置并列，都只在开局界面出现；值写进开局表单，
  // 由大厅 startGame 一并提交，服务端再落到 state（随存档保留）。
  function renderGameSettings() {
    const values = [
      ...(CARD_POOL_RESTRICTION_ENABLED
        ? [t('hub.gameSettings.cardPoolValue', { value: cardPoolLabel(state.setup.form.cardPoolScope) })]
        : []),
      t('hub.gameSettings.rollbackValue', { value: rollbackLabel(state.setup.form.allowRollback) }),
    ].join(' · ')
    return h('section', { className: 'ah-ai-dialogue-settings' },
      h('span', {}, h('strong', {}, t('hub.gameSettings.title')), h('small', {}, values)),
      h('button', { type: 'button', className: 'bg-btn secondary',
        onclick: () => { state.arkhamGameSettingsOpen = true; render() } }, t('hub.gameSettings.edit')))
  }

  function renderGameSettingsModal(g) {
    if (!state.arkhamGameSettingsOpen) return null
    const spec = key => g.settingsSpec.find(item => item.key === key)
    const scope = spec('cardPoolScope'), rollback = spec('allowRollback')
    const close = () => { state.arkhamGameSettingsOpen = false; render() }
    return h('div', { className: 'ah-ai-dialogue-backdrop', onclick: event => { if (event.target === event.currentTarget) close() } },
      h('section', { className: 'ah-ai-dialogue-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('hub.gameSettings.title'),
        onkeydown: modalKeys(close), onclick: event => event.stopPropagation() },
        h('header', {}, h('div', {}, h('small', {}, 'ARKHAM HORROR'), h('h2', {}, t('hub.gameSettings.title'))),
          h('button', { type: 'button', className: 'bg-btn secondary', onclick: close, 'aria-label': t('hub.gameSettings.closeAria') }, t('common.close'))),
        h('p', {}, t('hub.gameSettings.note')),
        CARD_POOL_RESTRICTION_ENABLED ? h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, scope.label),
          h('div', { className: 'ah-game-settings-select' },
            h('span', {}, t('hub.gameSettings.cardPoolLabel')),
            select(scope.options, state.setup.form.cardPoolScope, value => { state.setup.form.cardPoolScope = value; render() },
              { 'aria-label': scope.label })),
          h('small', {}, scope.description)) : null,
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, t('hub.gameSettings.rollbackLabel')),
          h('label', { className: 'ah-ai-dialogue-toggle' },
            h('input', { type: 'checkbox', checked: state.setup.form.allowRollback !== 'off', 'aria-label': rollback.label,
              onchange: event => { state.setup.form.allowRollback = event.target.checked ? 'on' : 'off' } }),
            h('span', {}, rollback.label),
            h('small', {}, t('hub.gameSettings.defaultAllowed'))),
          h('small', {}, rollback.description))))
  }

  function renderAiDialogueModal(g) {
    if (!state.arkhamAiSettingsOpen) return null
    const spec = key => g.settingsSpec.find(item => item.key === key)
    const range = key => {
      const item = spec(key)
      const value = Number(state.setup.form[key] ?? item.default)
      return h('label', { className: 'ah-ai-dialogue-range' },
        h('span', {}, item.label),
        h('span', { className: 'ah-ai-dialogue-control' },
          h('input', { type: 'range', min: item.min, max: item.max, step: item.step, value,
            'aria-label': item.label, oninput: event => {
              state.setup.form[key] = Number(event.target.value)
              event.target.nextElementSibling.textContent = `${event.target.value}%`
            } }),
          h('output', {}, `${value}%`)))
    }
    const toggle = (key, hint = t('hub.ai.hintFull')) => {
      const item = spec(key)
      return h('label', { className: 'ah-ai-dialogue-toggle' },
        h('input', { type: 'checkbox', checked: state.setup.form[key] === 'on', 'aria-label': item.label,
          onchange: event => { state.setup.form[key] = event.target.checked ? 'on' : 'off' } }),
        h('span', {}, item.label),
        h('small', {}, hint))
    }
    const close = () => { state.arkhamAiSettingsOpen = false; render() }
    return h('div', { className: 'ah-ai-dialogue-backdrop', onclick: event => { if (event.target === event.currentTarget) close() } },
      h('section', { className: 'ah-ai-dialogue-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('hub.ai.title'),
        onkeydown: modalKeys(close), onclick: event => event.stopPropagation() },
        h('header', {}, h('div', {}, h('small', {}, 'ARKHAM HORROR'), h('h2', {}, t('hub.ai.title'))),
          h('button', { type: 'button', className: 'bg-btn secondary', onclick: close, 'aria-label': t('hub.ai.closeAria') }, t('common.close'))),
        h('p', {}, t('hub.ai.note')),
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, t('hub.ai.story')),
          toggle('aiStoryAwareness', t('hub.ai.defaultOn')),
          h('small', {}, spec('aiStoryAwareness').description)),
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, t('hub.ai.groupRoutine')),
          range('aiRoutineSpeechFrequency'),
          range('aiEnemyDefeatSpeechFrequency')),
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, t('hub.ai.groupTests')),
          range('aiSelfTestSpeechFrequency'),
          range('aiOtherTestSpeechFrequency')),
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, t('hub.ai.groupCriticalSuccess')),
          h('small', {}, t('hub.ai.criticalSuccessHint')),
          range('aiSelfCriticalSuccessSpeechFrequency'),
          range('aiOtherCriticalSuccessSpeechFrequency')),
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, t('hub.ai.groupCriticalFailure')),
          h('small', {}, t('hub.ai.criticalFailureHint')),
          range('aiSelfCriticalFailureSpeechFrequency'),
          range('aiOtherCriticalFailureSpeechFrequency')),
        h('div', { className: 'ah-ai-dialogue-special', role: 'group', 'aria-label': t('hub.ai.specialAria') },
          h('strong', {}, t('hub.ai.specialTitle')),
          toggle('aiInvestigatorExitDialogue'),
          toggle('aiScenarioEndDialogue')),
        h('small', {}, t('hub.ai.scenarioEndHint'))))
  }

  const modalKeys = close => event => {
    if (event.key === 'Escape' && !state.busy) { event.preventDefault(); event.stopPropagation(); close(); return }
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input, select, textarea, [tabindex="0"]')]
      .filter(el => el.getClientRects().length && !el.closest('[hidden]'))
    if (!controls.length) return
    const index = controls.indexOf(document.activeElement)
    if (index < 0 || (event.shiftKey ? index === 0 : index === controls.length - 1)) {
      event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0].focus()
    }
  }

  const checkpointForEntry = (s, entry) => entry?.visitId
    ? (s.scenarioCheckpoints || []).find(item => item.visitId === entry.visitId)
    : null

  function checkpointAction(s, entry) {
    if (entry?.kind !== 'result') return null
    const checkpoint = checkpointForEntry(s, entry)
    if (!checkpoint) return null
    // 「允许回档」在开局时固定：关闭后连队长也不能创建分支存档。
    if (checkpoint.rollbackAllowed === false || s.state.allowRollback === false) {
      return h('p', { className: 'ah-checkpoint-note', role: 'status' }, t('hub.checkpoint.disabled'))
    }
    if (!checkpoint.available) {
      return h('p', { className: 'ah-checkpoint-note', role: 'status' }, t('hub.checkpoint.incompatible'))
    }
    if ((s.mySeat ?? s.observerSeat) !== s.state.campaign.leadSeat) {
      return h('p', { className: 'ah-checkpoint-note', role: 'status' }, t('hub.checkpoint.leaderOnly'))
    }
    return h('button', {
      type: 'button',
      className: 'ah-checkpoint-fork',
      disabled: state.busy || !checkpoint.canFork,
      onclick: () => {
        state.arkhamCheckpointFork = {
          sessionId: s.sessionId,
          checkpointId: checkpoint.checkpointId,
          visitId: checkpoint.visitId,
          scenarioName: checkpoint.scenarioName || entry.title,
        }
        render()
      },
    }, t('hub.checkpoint.start'))
  }

  async function confirmCheckpointFork(s, pending) {
    if (state.busy || s.sessionId !== pending.sessionId) return
    state.busy = true
    state.error = null
    render()
    try {
      const result = await api('POST', '/session/fork-checkpoint', {
        sessionId: s.sessionId,
        checkpointId: pending.checkpointId,
        seat: s.mySeat ?? s.observerSeat ?? 0,
        revision: s.state.revision,
        confirm: true,
      })
      if (state.session?.sessionId === pending.sessionId) {
        state.session = result.session
        state.arkhamCheckpointFork = null
        state.arkhamHubTab = 'story'
        rememberSession(result.session.sessionId)
      }
    } catch (error) {
      state.error = String(error.message)
    } finally {
      state.busy = false
      render()
    }
  }

  function renderCheckpointForkModal(s) {
    const pending = state.arkhamCheckpointFork
    if (!pending || pending.sessionId !== s.sessionId) return null
    const close = () => {
      if (state.busy) return
      state.arkhamCheckpointFork = null
      render()
    }
    return h('div', { className: 'ah-ai-dialogue-backdrop ah-checkpoint-backdrop', onclick: event => { if (event.target === event.currentTarget) close() } },
      h('section', {
        className: 'ah-ai-dialogue-modal ah-checkpoint-modal',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('hub.checkpoint.confirmAria'),
        onkeydown: modalKeys(close),
        onclick: event => event.stopPropagation(),
      },
      h('header', {}, h('div', {}, h('small', {}, t('hub.checkpoint.branchTitle')), h('h2', {}, t('hub.checkpoint.question', { scenario: pending.scenarioName })))),
      h('p', {}, t('hub.checkpoint.restoreNote')),
      h('p', {}, t('hub.checkpoint.branchNote')),
      h('div', { className: 'ah-checkpoint-actions' },
        h('button', { type: 'button', className: 'bg-btn secondary', disabled: state.busy, onclick: close }, t('common.cancel')),
        h('button', { type: 'button', className: 'bg-btn', disabled: state.busy, onclick: () => confirmCheckpointFork(s, pending) },
          state.busy ? t('hub.checkpoint.creating') : t('hub.checkpoint.confirm')))))
  }

  const closeDeck = () => {
    state.arkhamDeckOpen = false
    if (state.arkhamDeckImport) Object.assign(state.arkhamDeckImport, { notice: '', pending: null })
    if (state.arkhamDeckLibrary) Object.assign(state.arkhamDeckLibrary, { notice: '', error: '', confirmDelete: null })
    render()
    const target = document.querySelector(`[data-hub-action="${state.arkhamDeckReturnFocus || 'edit-deck'}"]`)
      || document.querySelector('[data-hub-action="edit-deck"]')
    target?.focus({ preventScroll: true })
  }
  const deckSeat = s => s.mySeat ?? 0
  const deckInvestigator = (s, g) => g?.clientData?.deckBuilder?.investigators.find(item => item.code === s.state.investigators[deckSeat(s)].code)
  // 按「卡牌范围」收窄构筑资料（导入/卡组库与服务端做同一判断）。
  const scopedBuilder = (s, builder) => {
    const scope = s.state.cardPoolScope
    const cycle = campaignCycle(s.state.campaign?.id)
    return {
      ...builder,
      investigators: (builder?.investigators || []).filter(inv => cardAllowedByScope(inv.code, scope, cycle)),
      cardPool: (builder?.cardPool || []).filter(card => cardAllowedByScope(card.code, scope, cycle)),
    }
  }
  // A local draft survives only while its saved source stays unchanged. An
  // automatic build or a saved edit must become the next editing baseline.
  const deckDraftKey = (s, inv) => JSON.stringify([s.sessionId, inv?.code, [...(recordForSeat(s, deckSeat(s))?.deck || [])].sort()])
  const savedDraft = (s, inv) => (recordForSeat(s, deckSeat(s))?.deck || []).filter(code => inv?.allowedCards.includes(code))
  const sameCards = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join()
  function openDeck(s, g, { importing = false, library = false } = {}) {
    const inv = deckInvestigator(s, g)
    const key = deckDraftKey(s, inv)
    if (state.arkhamDeckDraftKey !== key) {
      state.arkhamDeckDraft = savedDraft(s, inv)
      state.arkhamDeckDraftKey = key; state.arkhamDeckUndo = []; state.arkhamDeckRedo = []
    }
    state.deckFilters = {}
    state.arkhamDeckReturnFocus = importing ? 'import-deck' : library ? 'deck-library' : 'edit-deck'
    // Keep the object captured by an in-flight read when reopening the modal.
    Object.assign(state.arkhamDeckImport ||= { text: '' }, { open: importing, notice: '', pending: null })
    Object.assign(deckLibrary(), { open: library, notice: '', error: '', confirmDelete: null })
    state.arkhamDeckOpen = true
    render()
    if (importing) setTimeout(() => document.querySelector('.ah-deck-import input')?.focus({ preventScroll: true }), 0)
    if (library) refreshLibrary()
  }
  // The local library lives beside, not inside, the campaign save.
  const deckLibrary = () => state.arkhamDeckLibrary ||= { open: false, decks: null, name: '', currentId: null }
  async function refreshLibrary() {
    const lib = deckLibrary()
    if (lib.loading) return
    lib.loading = true; lib.error = ''; render()
    try { lib.decks = await listLocalDecks(api) } catch (error) { lib.error = t('hub.deckLibrary.readFailed') + String(error?.message || error) }
    lib.loading = false; render()
  }
  async function storeLibraryDeck(inv, draft, overwrite) {
    const lib = deckLibrary()
    if (lib.saving || !inv || !draft.length) return
    lib.saving = true; lib.error = ''; lib.notice = ''; lib.confirmDelete = null; render()
    try {
      const deck = await saveLocalDeck(api, { id: overwrite ? lib.currentId : null, name: lib.name.trim() || t('hub.deckLibrary.defaultName', { name: inv.name }),
        investigatorCode: inv.code, codes: draft })
      lib.currentId = deck.id; lib.name = deck.name
      lib.decks = [deck, ...(lib.decks || []).filter(item => item.id !== deck.id)]
      lib.notice = t(overwrite ? 'hub.deckLibrary.overwritten' : 'hub.deckLibrary.saved', { deck: deck.name, count: draft.length })
    } catch (error) { lib.error = t('hub.deckLibrary.saveFailed') + String(error?.message || error) }
    lib.saving = false; render()
  }
  async function removeLibraryDeck(deck) {
    const lib = deckLibrary()
    if (lib.saving) return
    lib.saving = true; lib.error = ''; lib.notice = ''; render()
    try {
      await deleteLocalDeck(api, deck.id)
      lib.decks = (lib.decks || []).filter(item => item.id !== deck.id)
      if (lib.currentId === deck.id) lib.currentId = null
      lib.notice = t('hub.deckLibrary.deleted', { deck: deck.name })
    } catch (error) { lib.error = t('hub.deckLibrary.deleteFailed') + String(error?.message || error) }
    lib.confirmDelete = null; lib.saving = false; render()
  }
  async function readArkhamDbDeck() {
    const imp = state.arkhamDeckImport
    if (!imp || imp.loading) return
    const parsed = parseArkhamDbInput(imp.text)
    if (parsed.error) { imp.error = parsed.error; imp.deck = null; render(); return }
    imp.loading = true; imp.error = ''; imp.deck = null; render()
    try { imp.deck = await loadArkhamDbDeck(parsed) } catch (error) { imp.error = String(error?.message || error) }
    imp.loading = false; render()
  }

  async function repairSave(id) {
    state.busy = true; state.arkhamSaveError = null; render()
    try {
      const result = await api('POST', '/session/repair', { sessionId: id })
      state.arkhamSaveNotice = result.repaired
        ? t('hub.save.repaired', { changes: result.changes.join(t('hub.list.semicolon')) }) + (result.backup ? t('hub.save.repairedBackup', { backup: result.backup }) : '')
        : t('hub.save.noRepair')
      state.busy = false
      await loadSaves()
    } catch (error) { state.busy = false; state.arkhamSaveError = String(error.message); render() }
  }

  async function deleteSave(id) {
    try {
      await api('POST', '/session/delete', { sessionId: id, confirm: true })
      state.arkhamDeleteConfirmId = null
      await loadSaves()
    } catch (error) { state.arkhamSaveError = String(error.message); render() }
  }

  function renderSetupModal(g) {
    if (state.arkhamSaves === undefined) onOpenSetup()
    const savesTab = state.arkhamSetupTab === 'saves'
    // 存档页内容更短：用切换前记录的「新游戏」页高度锁住弹窗（见 openSavesTab）。
    const stableEntryHeight = savesTab && state.arkhamSetupStableHeight ? `${state.arkhamSetupStableHeight}px` : null
    const themeAttributes = presentationAttributes({ campaign: { id: state.setup?.form?.campaignId } })
    const saves = state.arkhamSaves?.filter(item => (item.mode || (item.online ? 'online' : 'solo')) === (state.arkhamSaveMode || 'solo')) ?? state.arkhamSaves
    const newGame = h('div', { className: 'ah-hub-setup-fields' },
      g.settingsSpec.filter(spec => spec.type === 'select' && !['playerCount', 'teammates', 'cardPoolScope'].includes(spec.key)).map(spec => {
        return h('label', { className: 'bg-field' },
        h('span', {}, spec.label),
        select(spec.options, state.setup.form[spec.key], value => { state.setup.form[spec.key] = spec.key === 'playerCount' ? Number(value) : value; render() }),
        spec.description ? h('small', {}, spec.description) : null)
      }),
      renderGameSettings(g),
      renderAiDialogueSettings(g),
      renderOnlineSetup?.(g),
      h('div', { className: 'bg-modal-foot' },
        // 开局界面盖住了右下角的浮动规则书入口（会压到「开始新游戏」上），
        // 改为放在页脚左侧，仍然随时可查规则。
        rulebookOpen ? h('button', { type: 'button', className: 'bg-btn secondary ah-hub-setup-rulebook',
          title: t('table.rulebook'), 'aria-label': t('table.rulebook'), onclick: rulebookOpen }, tableIcon('book'), t('table.rulebook')) : null,
        h('button', { className: 'bg-btn secondary', onclick: () => { state.setup = null; render() } }, t('common.cancel')),
        h('button', { className: 'bg-btn', disabled: state.busy, onclick: startGame }, state.busy ? t('hub.setup.starting') : t('hub.setup.start'))))
    const saveList = h('div', { className: 'ah-save-list' },
      h('div', { className: 'bg-play-modes', role: 'group', 'aria-label': t('hub.saves.typeAria') },
        [['solo', t('hub.saves.tabSolo')], ['online', t('hub.saves.tabOnline')]].map(([mode, label]) => h('button', { type: 'button', 'aria-pressed': String((state.arkhamSaveMode || 'solo') === mode), onclick: () => { state.arkhamSaveMode = mode; render() } }, label))),
      state.arkhamSaveError ? h('p', { role: 'alert' }, state.arkhamSaveError) : null,
      state.arkhamSaveNotice ? h('p', { role: 'status' }, state.arkhamSaveNotice) : null,
      saves === null ? h('p', {}, t('hub.saves.loading')) : !saves?.length
        ? h('p', {}, state.arkhamPersist === false ? t('hub.saves.disabled') : t('hub.saves.empty'))
        : saves.map(item => h('article', { className: 'ah-save-item', 'data-session-id': item.sessionId },
          h('strong', {}, t('hub.saves.entry', {
            mode: item.online ? t('hub.saves.modeOnline') : t('hub.saves.modeSolo'),
            campaign: item.campaignName || item.campaignId || t('hub.saves.unknownCampaign'),
          })),
          item.online ? h('p', {}, t('hub.saves.onlineDetail', { humans: item.humanCount, ais: item.aiCount })) : null,
          h('div', { className: 'ah-save-portraits' }, item.investigators.map(inv => portrait(inv))),
          h('div', {}, t('hub.saves.summary', {
            stage: stageLabel(item.uiState), players: item.playerCount,
            names: item.investigators.map(inv => inv.name).join(t('hub.list.separator')),
          })),
          h('small', {}, new Date(item.savedAt).toLocaleString()),
          !item.compatible ? h('p', { role: 'status' }, t('hub.saves.incompatible') + item.compatibilityError) : null,
          item.needsMigration ? h('p', { role: 'status' }, t('hub.saves.migration', { changes: item.migrationChanges.join(t('hub.list.semicolon')) })) : null,
          h('div', { className: 'ah-save-actions' },
            item.needsMigration ? h('button', { className: 'bg-btn secondary', disabled: state.busy, onclick: () => repairSave(item.sessionId) }, t('hub.saves.repair')) : null,
            h('button', { className: 'bg-btn', disabled: !item.compatible || state.busy, onclick: async () => {
              state.busy = true; render()
              try { await loadSavedSession(item.sessionId, item.mode || (item.online ? 'online' : 'solo')) } catch (error) { state.arkhamSaveError = String(error.message) }
              state.busy = false; render()
            } }, item.online ? t('hub.saves.continueOnline') : t('hub.saves.load')),
            state.arkhamDeleteConfirmId === item.sessionId
              ? h('button', { className: 'bg-btn', onclick: () => deleteSave(item.sessionId) }, t('hub.saves.confirmDelete'))
              : h('button', { className: 'bg-btn secondary', onclick: () => { state.arkhamDeleteConfirmId = item.sessionId; render() } }, t('hub.delete'))))))
    return h('div', { className: 'bg-backdrop' },
      h('div', { className: 'bg-modal ah-hub-setup ah-office ah-theme', ...themeAttributes,
        style: stableEntryHeight ? { ...themeAttributes.style, '--ah-entry-stable-h': stableEntryHeight } : themeAttributes.style,
        role: 'dialog', 'aria-modal': 'true', 'aria-label': t('hub.setup.dialogAria'),
        onkeydown: modalKeys(() => { state.setup = null; render() }), onclick: event => event.stopPropagation() },
        h('div', { className: 'ah-office-entry-art' },
          h('div', { className: 'ah-office-entry-hero' }, decor('manor'),
            h('span', { className: 'ah-office-entry-blur is-top', 'aria-hidden': 'true' }),
            h('span', { className: 'ah-office-entry-blur is-bottom', 'aria-hidden': 'true' })),
          decor('desk'),
          h('div', { className: 'ah-office-entry-title' }, h('small', {}, 'ARKHAM HORROR'), h('h2', {}, t('hub.setup.gameName')), h('p', {}, t('hub.setup.tagline')))),
        h('div', { className: 'ah-office-entry-controls' },
        h('small', { className: 'ah-office-eyebrow' }, t('hub.setup.eyebrow')),
        h('h2', {}, state.arkhamSetupTab === 'saves' ? t('hub.setup.continueTitle') : t('hub.setup.newTitle')),
        h('div', { className: 'ah-hub-tabs' },
          h('button', { className: state.arkhamSetupTab === 'new' ? 'active' : '', 'data-focus-key': 'setup-tab:new',
            onclick: () => { state.arkhamSetupTab = 'new'; render() } }, t('hub.setup.tabNew')),
          h('button', { className: state.arkhamSetupTab === 'saves' ? 'active' : '', 'data-focus-key': 'setup-tab:saves',
            onclick: openSavesTab }, t('hub.setup.tabSaves'))),
        savesTab ? saveList : newGame,
        state.error ? h('p', { role: 'alert' }, state.error) : null)),
      renderGameSettingsModal(g),
      renderAiDialogueModal(g))
  }

  function action(s, move, label = move.label, className = 'bg-btn') {
    if (state.busy && move.action === 'hubDoneSeat' && state.arkhamHubPending?.sessionId === s.sessionId) label = t('hub.action.confirming')
    const blocked = !!move.disabled
    return h('button', {
      className, disabled: locked(s) || blocked,
      title: blocked ? (move.explanation || '') : undefined,
      onclick: () => { if (!blocked) submitMove(move, s) },
    }, renderRulesText(h,label,{links:false}))
  }

  const seatSelected = (s, seat) => !!s.state.hubSeatSelected?.[seat]
    || (!!s.state.campaign.scenarioResults?.length && recordForSeat(s, seat)?.status === 'active')
  const seatTask = (s, seat) => {
    const st = s.state, record = recordForSeat(s, seat)
    if (st.uiState === 'interlude') {
      if (record?.status !== 'active') return t('hub.task.replaceInvestigator')
      if (record.upgradeDraft) return t('hub.task.saveUpgrades')
      return t('hub.task.finishUpgrades')
    }
    if (!seatSelected(s, seat)) return t('hub.task.selectInvestigator')
    if (!recordDeckReady(record)) return t('hub.task.saveDeck')
    return t('hub.task.confirmReady')
  }
  const preparationMessage = s => {
    const st = s.state, mySeat = s.mySeat ?? 0
    if (st.campaign.leadConfirmed === false && st.hubReady) return mySeat === 0
      ? t('hub.prep.leaderChoose')
      : t('hub.prep.leaderWait')
    if (st.hubReady) return mySeat === 0
      ? t('hub.prep.readyHost')
      : t('hub.prep.readyWait')
    if (['scenarioSetup', 'interlude'].includes(st.uiState)) {
      const others = actingSeats(s).filter(seat => seat !== mySeat)
        .map(seat => s.players.find(item => item.seat === seat)?.name || t('hub.player.name', { seat: seat + 1 }))
      if (acting(s, mySeat)) return t('hub.prep.turn', { task: seatTask(s, mySeat) }) + (others.length ? t('hub.prep.othersPreparing', { names: others.join(t('hub.list.separator')) }) : '')
      return t('hub.prep.selfReadyWaiting', { names: others.join(t('hub.list.separator')) || t('hub.prep.teammate') })
    }
    return st.hubSelectedScenarioId ? t('hub.prep.scenarioChosen') : t('hub.prep.chooseScenario')
  }

  function workflowGuide(s, activeTab) {
    const st = s.state, mySeat = s.mySeat ?? 0, record = recordForSeat(s, mySeat)
    let steps, primary = null, message = preparationMessage(s)
    if (st.uiState === 'scenarioResult') {
      steps = [[t('hub.workflow.stepResultReview'), false], [t('hub.workflow.stepInterludeUpgrade'), false], [t('hub.workflow.stepConfirmNext'), false], [t('hub.workflow.stepStartNext'), false]]
      const move = legal(s, 'hubContinue')[0]
      if (move) primary = action(s, move, t('hub.workflow.primaryResult'))
    } else if (st.uiState === 'interlude') {
      const upgraded = !!st.hubUpgradedSeats?.[mySeat]
        || record?.purchases?.some(item => item.scenarioIndex === st.campaign.scenarioIndex)
      steps = [[t('hub.workflow.stepUpgradeOptional'), upgraded], [t('hub.task.saveUpgrades'), upgraded && !record?.upgradeDraft],
        [t('hub.workflow.stepConfirmSeat'), !!st.hubSeatDone?.[mySeat]], [t('hub.workflow.stepStartNext'), false]]
      if (acting(s, mySeat)) {
        const confirm = legal(s, 'hubConfirmUpgrades')[0], done = legal(s, 'hubDoneSeat')[0]
        if (confirm) primary = action(s, confirm, t('hub.task.saveUpgrades'))
        else if (done) primary = action(s, done, upgraded ? t('hub.workflow.primaryUpgradeDone') : t('hub.workflow.primaryKeepXp'))
        else primary = h('button', { className: 'bg-btn', onclick: () => changeTab(record?.status === 'active' ? 'upgrades' : 'investigators') },
          record?.status === 'active' ? t('hub.workflow.stepViewUpgrades') : t('hub.task.replaceInvestigator'))
      }
    } else if (['campaignHub', 'scenarioSetup'].includes(st.uiState)) {
      const selected = seatSelected(s, mySeat), deckReady = recordDeckReady(record), ready = !!st.hubSeatDone?.[mySeat]
      const scenarioReady = !!st.hubSelectedScenarioId
      steps = [[t('hub.workflow.stepChooseCase'), scenarioReady], [t('hub.task.selectInvestigator'), selected], [t('hub.task.saveDeck'), deckReady], [t('hub.task.confirmReady'), ready], [t('hub.workflow.stepStartScenario'), false]]
      if (st.uiState === 'campaignHub') {
        const setup = legal(s, 'hubGoSetup')[0]
        primary = !scenarioReady
          ? h('button', { className: 'bg-btn', onclick: () => changeTab('scenarios') }, t('hub.workflow.primaryChooseCase'))
          : setup ? action(s, setup, t('hub.task.selectInvestigator')) : null
      } else if (st.hubReady) {
        const begin = legal(s, 'hubBeginScenario')[0]
        if (begin) primary = action(s, begin, t('hub.workflow.primaryStartScenario'))
      } else if (acting(s, mySeat)) {
        if (!selected) primary = h('button', { className: 'bg-btn', onclick: () => changeTab('investigators') }, t('hub.task.selectInvestigator'))
        else if (!deckReady) primary = h('button', { className: 'bg-btn', onclick: () => changeTab('deck') }, t('hub.task.saveDeck'))
        else {
          const done = legal(s, 'hubDoneSeat')[0]
          if (done) primary = action(s, done, t('hub.task.confirmReady'))
        }
      }
    } else if (st.uiState === 'campaignResult') {
      steps = [[t('hub.workflow.campaignDone'), true]]
      message = t('hub.workflow.campaignDoneMessage')
    } else return null
    if ((st.uiState === 'scenarioResult' && activeTab === 'story')
      || (st.uiState === 'scenarioSetup' && ['investigators', 'deck', 'departure'].includes(activeTab))
      || (st.uiState === 'interlude' && ['investigators', 'upgrades'].includes(activeTab))) primary = null
    const current = Math.max(0, steps.findIndex(([, done]) => !done))
    return h('section', { className: 'ah-workflow-guide', 'aria-label': t('hub.workflow.aria') },
      h('ol', {}, steps.map(([label, done], index) => h('li', {
        className: done ? 'is-done' : index === current ? 'is-current' : '',
        'aria-current': index === current ? 'step' : null,
      }, h('span', {}, done ? '✓' : index + 1), h('b', {}, label)))),
      h('div', { className: 'ah-workflow-next', role: 'status' },
        h('span', {}, h('strong', {}, t('hub.workflow.current', { step: steps[current]?.[0] || t('hub.workflow.done') })), h('small', {}, message)),
        primary))
  }

  function preparationProgress(s) {
    const pending = state.arkhamHubPending
    if (!pending || pending.sessionId !== s.sessionId) return null
    const st = s.state, confirmed = st.hubSeatDone?.[pending.seat]
    const message = !confirmed ? t('hub.workflow.preparing') : preparationMessage(s)
    return h('div', { className: 'ah-hub-preparing', role: 'status', 'aria-live': 'polite' },
      tableIcon('action'), h('span', {}, h('strong', {}, message), h('small', {}, t('hub.workflow.preparingNote'))))
  }

  function modePanel(s, model = modePanelModel(s.state, s.state.legalMoves || [])) {
    if (!model.visible) return null
    const modeButton = item => [
      h('button', {
        className: 'bg-btn secondary', 'aria-pressed': String(model.selected === item.mode),
        title: item.reason || undefined, disabled: locked(s) || item.disabled,
        onclick: () => submitMove({ action: 'hubSetMode', mode: item.mode }, s),
      }, item.label),
      item.reason ? h('small', { className: 'ah-mode-reason' }, item.reason) : null,
    ]
    const switchButtons = seat => model.seats.filter(item => item.seat === seat).map(item => [
      h('button', {
        className: 'bg-btn secondary', 'aria-pressed': String(item.part === model.seatParts[item.seat]),
        title: item.reason || undefined, disabled: locked(s) || item.disabled,
        onclick: () => submitMove({ action: 'hubSetSeatPart', seat: item.seat, part: item.part }, s),
      }, item.part === model.seatParts[item.seat] ? item.label : t('hub.mode.switchTo', { part: item.part })),
      item.reason ? h('small', { className: 'ah-mode-reason' }, item.reason) : null,
    ])
    const balance = model.laneCounts || { A: 0, B: 0 }
    return h('section', { className: 'ah-hub-actions ah-office-modes', 'aria-label': t('hub.mode.aria') },
      h('strong', {}, t('hub.mode.title')),
      model.selected ? h('small', {}, t('hub.mode.current', { mode: model.selectedLabel })) : null,
      h('div', { className: 'ah-office-mode-list' }, model.modes.map(item => h('div', { className: 'ah-office-mode' }, ...modeButton(item)))),
      model.needsMode ? h('small', {}, t('hub.mode.chooseFirst')) : null,
      model.hostChooses ? h('small', {}, t('hub.mode.hostChooses')) : null,
      model.assignments.length
        ? h('div', { className: 'ah-office-mode-seats', role: 'group', 'aria-label': t('hub.mode.seatsAria') },
          h('small', { className: 'ah-mode-balance' }, t('hub.mode.balance', { a: balance.A, b: balance.B }),
            model.selected === 'parallel'
              ? h('b', { className: model.balanced ? 'is-ok' : 'is-warn' },
                model.balanced ? t('hub.mode.balanced') : t('hub.mode.unbalanced'))
              : null),
          model.assignments.map(item => h('div', { className: 'ah-office-mode-seat', 'data-seat': item.seat },
            h('span', {}, item.label), ...switchButtons(item.seat))))
        : null,
      model.seatHint ? h('small', {}, t('hub.mode.seatHint')) : null)
  }

  function overview(s, g) {
    const cp = s.state.campaign
    const selected = g.clientData?.campaigns?.find(item => item.id === cp.id)
    return h('section', { className: 'ah-hub-pane ah-office-overview' },
      h('div', { className: 'ah-office-hero' }, decor('manor'),
        h('div', { className: 'ah-office-hero-copy' },
          h('small', { className: 'ah-office-eyebrow' }, t('hub.overview.eyebrow')),
          h('h1', {}, selected?.name || cp.name),
          h('p', {}, t('hub.overview.tagline')),
          h('div', { className: 'ah-office-metrics' }, metric('shield', s.players.length, t('hub.metric.investigators')), metric('star', cp.victory, t('hub.metric.victory')), metric('book', cp.xp, t('hub.metric.xp'))),
          modePanel(s),
          s.state.uiState === 'campaignHub' ? h('div', { className: 'ah-hub-actions ah-office-difficulty', 'aria-label': t('hub.overview.difficultyAria') },
            legal(s, 'hubSetDifficulty').map(move => h('button', {
              className: 'bg-btn secondary', 'aria-pressed': String(s.state.difficulty === move.difficulty),
              disabled: locked(s), onclick: () => submitMove(move, s),
            }, difficultyLabel(move.difficulty)))) : null,
          h('div', { className: 'ah-office-primary' },
            s.state.uiState === 'scenarioResult' ? h('div', { className: 'ah-office-result' },
              h('h3', {}, t('hub.overview.resultTitle')), h('p', {}, t('hub.overview.resultSummary', {
                result: cp.scenarioResults?.length ? resultName(s, cp.scenarioResults.at(-1)) : outcomeName(s.state.resolution),
                victory: s.state.victory,
              })),
              legal(s, 'hubContinue').map(move => action(s, move))) : null,
            s.state.uiState === 'campaignResult' ? h('div', { className: 'ah-office-result' }, h('h3', {}, t('hub.stage.campaignResult')), h('p', {}, outcomeName(cp.result))) : null))),
      h('div', { className: 'ah-office-overview-grid' },
        h('article', { className: 'ah-office-dossier' }, decor('casefile'), h('div', { className: 'ah-office-dossier-copy' },
          h('small', {}, t('hub.overview.currentCase')), h('h2', {}, selected?.scenarios?.find(item => item.id === s.state.hubSelectedScenarioId)?.name || t('hub.overview.notChosen')),
          h('p', {}, t('hub.overview.progress', { difficulty: difficultyLabel(s.state.difficulty), done: cp.scenarioResults.length, total: selected?.scenarios?.length || 0 })),
          h('button', { onclick: () => changeTab('scenarios') }, t('hub.overview.openRoute')))),
        h('section', { className: 'ah-office-team-panel' }, h('h3', {}, t('hub.overview.team')), team(s))),
      h('details', { className: 'ah-content-packs', 'aria-label': t('hub.overview.contentAria') },
        h('summary', {}, t('hub.overview.contentTitle')),
        h('h3', {}, t('hub.overview.registered')),
        h('p', {}, t('hub.overview.contentNote')),
        (selected?.contentPacks || []).map(pack => h('article', { className: 'ah-content-pack', 'data-pack-id': pack.id },
          h('strong', {}, pack.name),
          h('span', { className: 'ah-content-status' }, t('hub.overview.packSummary', {
            status: packStatusLabel(pack.status),
            dependency: pack.required ? t('hub.overview.packRequired') : t('hub.overview.packOptional'),
          })),
          pack.description ? h('p', {}, pack.description) : null,
          pack.cards.map(card => h('div', { className: card.playable ? 'ah-content-ready' : 'ah-content-blocked' },
            t('hub.overview.cardLine', {
              code: card.code, name: card.name,
              status: card.playable ? t('hub.overview.cardPlayable') : card.blockedReason || t('hub.overview.cardBlocked'),
            })))))),
      null)
  }

  function scenarios(s, g) {
    const cp = s.state.campaign
    const manifest = g.clientData?.campaigns?.find(item => item.id === cp.id)
    const list = manifest?.scenarios || []
    return h('section', { className: 'ah-hub-pane ah-office-routes' }, h('h2', {}, t('hub.tab.scenarios')),
      h('div', { className: 'ah-office-cases' }, list.map((scenario, index) => {
        const completed = cp.scenarioResults.some(item => item.scenarioId === scenario.id)
        const move = legal(s, 'hubSelectScenario').find(item => item.scenarioId === scenario.id)
        // Selection is shared campaign state; legal moves only grant the action.
        const selected = !cp.finished && s.state.hubSelectedScenarioId === scenario.id
        const available = !cp.finished && (selected || !!move)
        return h('article', { className: 'ah-hub-scenario ah-office-case' + (selected ? ' available selected' : available ? ' available' : completed ? ' completed' : ' locked') },
          h('img', {
            className: 'ah-office-decor ah-office-case-art',
            src: campaignPresentation(cp.id, scenario.id).assets.storyDefault,
            alt: '', draggable: 'false', 'aria-hidden': 'true',
          }),
          h('small', { className: 'ah-office-case-number' }, `CASE / ${String(index + 1).padStart(2, '0')}`),
          h('div', { className: 'ah-office-case-copy' },
            h('strong', {}, `${index + 1}. ${scenario.name}`),
            h('span', {}, tableIcon(completed ? 'star' : available ? 'clue' : 'lock'), completed ? t('hub.scenarios.completed') : selected ? t('hub.scenarios.selected') : available ? t('hub.scenarios.available') : t('hub.scenarios.locked'))),
          h('div', { className: 'ah-office-case-action' },
            move ? action(s, move, selected ? t('hub.scenarios.selected') : t('hub.scenarios.choose')) : null))
      })))
  }

  function departureMember(s, inv, lane) {
    const st = s.state
    const record = recordForSeat(s, inv.seat)
    const selected = !!st.hubSeatSelected?.[inv.seat] || record?.status === 'active'
    const deckReady = recordDeckReady(record) && !record.upgradeDraft
    // 队长的「设为队长 / 队长」与 AI 的「换位置」都放在人物卡里（只有房主拿得到别座位的动作）。
    const leaderMove = lane?.leaders?.find(move => move.leadSeat === inv.seat) || null
    const switchMove = lane?.switches?.find(move => move.seat === inv.seat) || null
    const isLeader = lane?.leaderSeat === inv.seat
    const actions = [
      isLeader
        ? h('b', { className: 'ah-member-role' }, t('hub.departure.leader'))
        : leaderMove
          ? h('button', { className: 'ah-text-action', disabled: locked(s), onclick: () => { if (!state.busy) submitMove(leaderMove, s) } }, t('hub.departure.setLeader'))
          : null,
      switchMove
        ? h('button', {
          className: 'ah-text-action', disabled: locked(s) || !!switchMove.disabled,
          title: switchMove.explanation || undefined,
          onclick: () => { if (!switchMove.disabled) submitMove(switchMove, s) },
        }, t('hub.departure.moveSeat'))
        : null,
    ].filter(Boolean)
    return h('article', { className: 'ah-departure-member' + (seatPrepared(s, inv) ? ' is-ready' : '') + (isLeader ? ' is-leader' : ''), 'data-seat': inv.seat },
      h('div', { className: 'ah-departure-identity' }, portrait(inv), h('div', {}, h('h3', {}, inv.name), playerBadge(s, inv.seat))),
      h('ul', { className: 'ah-departure-checks' }, [[selected, t('hub.departure.checkInvestigator')], [deckReady, t('hub.departure.checkDeck')], [seatPrepared(s, inv), t('hub.departure.checkSeat')]].map(([done, label]) =>
        h('li', { className: done ? 'is-done' : '' }, h('span', { 'aria-hidden': 'true' }, done ? '✓' : '○'), label))),
      actions.length ? h('div', { className: 'ah-departure-member-actions' }, ...actions) : null,
      !seatPrepared(s, inv) && ['scenarioSetup', 'interlude'].includes(st.uiState) ? h('button', { className: 'bg-btn secondary', onclick: () => changeTab(st.uiState === 'interlude' && record?.status === 'active' ? 'upgrades' : 'investigators') }, inv.seat === (s.mySeat ?? 0) && acting(s, inv.seat) ? t('hub.departure.continuePrep') : t('hub.departure.viewPrep')) : null)
  }

  function departureLaneColumn(s, lane, manifest) {
    const st = s.state
    const members = lane.seats.map(seat => st.investigators.find(inv => inv.seat === seat)).filter(Boolean)
    const sceneId = st.campaign.partScenarios?.[lane.part] || null
    const sceneName = manifest?.scenarios?.find(item => item.id === sceneId)?.name
      || st.campaign.partScenarioNames?.[lane.part] || ''
    return h('section', { className: 'ah-departure-lane', 'data-lane': lane.part, 'aria-label': t('hub.departure.laneAria', { lane: lane.name }) },
      h('header', { className: 'ah-departure-lane-head' },
        h('div', { className: 'ah-departure-lane-title' },
          h('h2', {}, lane.name),
          h('p', { className: 'ah-departure-lane-scenario' }, sceneName || t('hub.departure.laneScenarioPending')),
          h('small', {}, t('hub.departure.laneSize', { count: lane.size }))),
        sceneId ? h('div', { className: 'ah-departure-lane-art' }, decor('scene', '', sceneId)) : null),
      h('div', { className: 'ah-departure-lane-leader-line' },
        h('small', {}, t('hub.departure.laneLeader')),
        h('strong', {}, st.investigators.find(inv => inv.seat === lane.leaderSeat)?.name || t('hub.departure.laneLeaderNone'))),
      h('div', { className: 'ah-departure-team ah-lane-team' }, members.map(inv => departureMember(s, inv, lane))))
  }

  function departure(s, g) {
    const st = s.state, ready = canDepart(s)
    const manifest = g.clientData?.campaigns?.find(item => item.id === st.campaign.id)
    const scenario = manifest?.scenarios?.find(item => item.id === st.hubSelectedScenarioId)
    const count = st.investigators.filter(inv => seatPrepared(s, inv)).length
    const lanes = departureLanes(st, st.legalMoves || [])
    const beginMove = lanes.parallel ? (lanes.startMove || legal(s, 'hubBeginScenario')[0]) : legal(s, 'hubBeginScenario')[0]
    const hint = beginMove?.disabled ? beginMove.explanation : preparationMessage(s)
    const startButton = h('button', { className: 'bg-btn ah-departure-start',
      disabled: !ready || locked(s) || !!s.saveError || !!s.saveDetached || !!beginMove?.disabled,
      title: beginMove?.disabled ? beginMove.explanation : undefined,
      'aria-describedby': 'ah-departure-hint',
      onclick: () => { if (canDepart(s) && !state.busy && !s.saveError && !s.saveDetached) submitMove(beginMove, s) } }, t('hub.workflow.primaryStartScenario'))
    if (lanes.parallel) {
      return h('section', { className: 'ah-hub-pane ah-office-departure ah-departure-parallel', 'aria-label': t('hub.departure.title'), 'data-parallel': 'true' },
        h('div', { className: 'ah-departure-common' },
          h('div', { className: 'ah-departure-common-copy' },
            h('small', { className: 'ah-office-eyebrow' }, t('hub.departure.title')),
            h('h2', {}, t('hub.departure.parallelTitle')),
            h('p', {}, t('hub.departure.readiness', { difficulty: difficultyLabel(st.difficulty), ready: count, total: st.investigators.length })),
            h('p', { id: 'ah-departure-hint', role: 'status' }, hint)),
          h('div', { className: 'ah-departure-common-actions' },
            h('button', { className: 'bg-btn secondary', onclick: () => changeTab('story') }, t('hub.departure.readIntro')),
            startButton,
            legal(s, 'hubReopenSetup').map(move => action(s, move, t('hub.departure.reopenSetup'))),
            legal(s, 'hubGoSetup').map(move => action(s, move)))),
        h('div', { className: 'ah-departure-split' }, departureLaneColumn(s, lanes.lanes[0], manifest), departureLaneColumn(s, lanes.lanes[1], manifest)))
    }
    return h('section', { className: 'ah-hub-pane ah-office-departure', 'aria-label': t('hub.departure.title') },
      h('div', { className: 'ah-departure-heading' }, decor('scene', '', st.hubSelectedScenarioId), h('div', {},
        h('small', { className: 'ah-office-eyebrow' }, t('hub.departure.title')), h('h2', {}, scenario?.name || t('hub.departure.nextScenario')),
        h('p', {}, t('hub.departure.readiness', { difficulty: difficultyLabel(st.difficulty), ready: count, total: st.investigators.length })),
        h('p', { id: 'ah-departure-hint', role: 'status' }, hint),
        h('button', { className: 'bg-btn secondary', onclick: () => changeTab('story') }, t('hub.departure.readIntro')),
        startButton,
        legal(s, 'hubReopenSetup').map(move => action(s, move, t('hub.departure.reopenSetup'))),
        legal(s, 'hubGoSetup').map(move => action(s, move)))),
      h('section', { className: 'ah-leader-picker', 'aria-label': t('hub.departure.leaderAria') },
        h('div', {}, h('strong', {}, t('hub.departure.leaderTitle')), h('small', {}, t('hub.departure.leaderNote'))),
        s.players.filter(p => p.role === 'human').map(player => {
          const inv = st.investigators.find(i => i.seat === player.seat)
          const chosen = st.campaign.leadSeat === player.seat && st.campaign.leadConfirmed !== false
          const move = legal(s, 'hubSetLeader').find(m => m.leadSeat === player.seat)
          return h('button', { className: 'ah-leader-candidate' + (chosen ? ' is-selected' : ''),
            'aria-pressed': String(chosen), disabled: !move || locked(s),
            onclick: () => { if (move && !state.busy) submitMove(move, s) } },
            portrait(inv), h('span', {}, h('strong', {}, inv.name), playerBadge(s, player.seat)), h('b', {}, chosen ? t('hub.departure.leader') : t('hub.departure.setLeader')))
        })),
      h('div', { className: 'ah-departure-team' }, st.investigators.map(inv => departureMember(s, inv))))
  }

  function investigators(s, g) {
    const st = s.state
    const builderInvestigators = g.clientData?.deckBuilder?.investigators || []
    const selectedClass = state.arkhamInvestigatorClass || 'all'
    const moves = legal(s, 'hubSelectInvestigator')
    const packOf = ({ investigator }) => investigator.pack || 'core'
    const candidates = moves.map(move => ({ move, investigator: builderInvestigators.find(item => item.code === move.code)
      // 服务端 move.label 仍是中文「选择调查员：<name>」；名字兜底时只剥掉中文前缀，不翻译协议文本。
      || { code: move.code, name: move.label.replace(/^[\u4e00-\u9fff]+\uFF1A\s*/, ''), pack: 'core' } }))
    // 候选调查员横跨四个循环，扩展包改用下拉框收束；下拉项跟随职业筛选，
    // 因此不会出现「职业 + 扩展包」组合下空名册的死路。
    const classCandidates = selectedClass === 'all' ? candidates
      : candidates.filter(({ investigator }) => investigator.klass === selectedClass)
    const packs = [...new Set(classCandidates.map(packOf))]
    const counts = classCandidates.reduce((result, item) => {
      const pack = packOf(item); result[pack] = (result[pack] || 0) + 1; return result
    }, {})
    const selectedPack = packs.includes(state.arkhamInvestigatorPack) ? state.arkhamInvestigatorPack : 'all'
    const packName = pack => packLabel(pack, candidates.find(item => packOf(item) === pack)?.investigator.packName)
    const packOptions = [['all', t('hub.investigators.allPacks')], ...packs.map(pack => [pack, t('hub.investigators.packOption', { pack: packName(pack), count: counts[pack] })])]
    const groups = Object.entries(classCandidates
      .filter(item => selectedPack === 'all' || packOf(item) === selectedPack)
      .reduce((result, item) => {
        const pack = packOf(item)
        ;(result[pack] ||= []).push(item)
        return result
      }, {}))
    const seatParts = Array.isArray(st.campaign.seatParts) ? st.campaign.seatParts : null
    const lanesAssigned = !!seatParts?.some(part => part === 'A' || part === 'B')
    const myLane = lanesAssigned ? seatParts[s.mySeat ?? 0] : null
    const cards = st.investigators.map(inv => {
        const record = recordForSeat(s, inv.seat)
        const active = acting(s, inv.seat) && !st.hubReady
        const selected = seatSelected(s, inv.seat)
        const detail = builderInvestigators.find(item => item.code === inv.code) || inv
        return h('article', {
          className: 'ah-hub-seat ah-office-investigator' + (active ? ' active' : ''),
          'data-lane': seatParts?.[inv.seat] || '',
          'data-seat': String(inv.seat),
        },
          portrait(inv), h('div', { className: 'ah-office-investigator-copy' },
          h('small', { className: 'ah-office-eyebrow' }, t('hub.investigators.eyebrow', { class: classLabel(inv.klass) || inv.klass || '', pack: packLabel(detail.pack, detail.packName), seat: inv.seat + 1 })),
          playerBadge(s, inv.seat),
          h('h2', {}, inv.name), detail.subname ? h('p', { className: 'ah-investigator-subname' }, detail.subname) : null,
          h('div', { className: 'ah-office-metrics' }, metric('sword', inv.combat, t('hub.skill.combat')), metric('book', inv.intellect, t('hub.skill.intellect')), metric('star', inv.willpower, t('hub.skill.willpower')), metric('leaf', inv.agility, t('hub.skill.agility'))),
          investigatorInfo(detail),
          !selected && !st.campaign.scenarioResults.length
            ? h('p', { className: 'ah-investigator-selection-state', role: 'status' }, t('hub.investigators.notChosen'))
            : h('p', { className: 'ah-investigator-selection-state is-selected', role: 'status' }, t('hub.investigators.chosen')),
          h('p', {}, recordDeckReady(record) ? t('hub.investigators.deckSummary', { count: record.deckSize ?? record.deck?.length ?? 0, xp: record.xp }) : t('hub.investigators.deckNotSaved')),
          active && inv.seat === (s.mySeat ?? 0) && moves.length && !st.campaign.scenarioResults.length
            ? h('p', { className: 'ah-investigator-reselect-note', role: 'note' }, t('hub.investigators.reselectNote')) : null,
          // After the first scenario a living campaign investigator is locked in.
          active && inv.seat === (s.mySeat ?? 0) && !moves.length && record?.status === 'active' && (st.uiState === 'interlude' || st.campaign.scenarioResults?.length)
            ? h('p', { className: 'ah-office-empty ah-investigator-locked', role: 'status' }, tableIcon('lock'), t('hub.investigators.lockedNote')) : null,
          active && inv.seat === (s.mySeat ?? 0) && moves.length ? h('div', { className: 'ah-investigator-browser' },
            h('div', { className: 'ah-investigator-browser-head' }, h('div', {},
              h('h3', {}, record && record.status !== 'active' ? t('hub.investigators.replacementTitle', { status: record.status === 'insane' ? t('hub.investigators.statusInsane') : t('hub.investigators.statusDead') }) : t('hub.task.selectInvestigator')),
              h('p', {}, record && record.status !== 'active' ? t('hub.investigators.replacementNote') : t('hub.investigators.selectNote'))),
              h('div', { className: 'ah-investigator-filter-bar' },
                h('label', { className: 'ah-investigator-pack-filter' }, t('hub.investigators.pack'),
                  h('select', { 'aria-label': t('hub.investigators.packAria'), 'data-focus-key': 'investigator:pack',
                    onchange: event => { state.arkhamInvestigatorPack = event.target.value; render() },
                  }, packOptions.map(([value, label]) => h('option', { value, selected: value === selectedPack }, label)))),
                h('div', { className: 'ah-investigator-class-filters', 'aria-label': t('hub.investigators.classAria') },
                  [['all', t('hub.investigators.allClasses')], ...Object.keys(CLASS_KEYS).filter(key => key !== 'neutral').map(key => [key, classLabel(key)])].map(([key, label]) => h('button', {
                    className: `ah-investigator-class-filter is-${key}`, 'aria-pressed': String(selectedClass === key),
                    onclick: () => { state.arkhamInvestigatorClass = key; render() },
                  }, key === 'all' ? null : tableIcon(classIcon(key)), label))))),
            groups.length ? groups.map(([pack, entries]) => h('section', { className: 'ah-investigator-pack', 'data-pack': pack },
              h('header', {}, h('h4', {}, packName(pack)), h('small', {}, t('hub.investigators.count', { count: entries.length }))),
              h('div', { className: 'ah-office-roster' }, entries.map(({ move, investigator: candidate }) =>
                // 候选人卡 = 选择按钮 + 独立的档案按钮（不能把 button 嵌进 button）。
                // 点卡直接选定（原有行为），点右上角 ⓘ 只看完整人物档案、不提交选择。
                h('div', { className: 'ah-office-candidate-shell', 'data-code': candidate.code },
                  h('button', { className: `ah-office-candidate is-${candidate.klass || 'neutral'}`, 'data-class': candidate.klass || 'neutral',
                    'aria-label': t('hub.investigators.candidateAria', { move: move.label, class: classLabel(candidate.klass) || candidate.klass || '', pack: packName(pack) }),
                    'aria-pressed': String(selected && inv.code === move.code), disabled: locked(s), onclick: () => submitMove(move, s) },
                  portrait(candidate), h('span', {}, candidate.name), h('small', {}, classLabel(candidate.klass) || candidate.klass || t('hub.investigator.generic'))),
                  h('button', { type: 'button', className: 'ah-office-candidate-info', 'data-candidate-info': candidate.code,
                    'aria-label': t('hub.investigator.inspectDossier', { name: candidate.name }), title: t('hub.investigator.dossierTitle', { name: candidate.name }),
                    onclick: () => inspectCard(candidate.code) }, tableIcon('book')))))))
              : h('p', { className: 'ah-office-empty' }, t('hub.investigators.empty'))) : null,
          active && inv.seat === (s.mySeat ?? 0) ? h('div', { className: 'ah-hub-actions' },
            legal(s, 'hubAutoDeck').map(move => action(s, move)),
            selected ? h('button', { className: 'bg-btn secondary', onclick: () => changeTab('deck') }, recordDeckReady(record) ? t('hub.investigators.editDeck') : t('hub.investigators.goDeck')) : null,
            legal(s, 'hubDoneSeat').map(move => action(s, move, t('hub.task.confirmReady')))) : null))
      })
    const laneSections = lanesAssigned
      ? ['A', 'B'].map(part => {
          const members = cards.filter(card => card.dataset.lane === part)
          if (!members.length) return null
          return h('section', {
            className: 'ah-lane-roster', 'data-lane': part,
            'aria-label': t('hub.investigators.laneAria', { part }),
          }, h('h3', {}, t('hub.investigators.laneHeading', { part })), ...members)
        }).filter(Boolean)
      : []
    const loose = lanesAssigned ? cards.filter(card => card.dataset.lane !== 'A' && card.dataset.lane !== 'B') : cards
    return h('section', { className: 'ah-hub-pane ah-office-investigators' },
      h('h2', {}, t('hub.tab.investigators')),
      myLane ? h('p', { className: 'ah-lane-roster-note', role: 'status' }, t('hub.investigators.laneNote', { part: myLane })) : null,
      ...laneSections, ...loose)
  }

  function deck(s, g) {
    const record = recordForSeat(s, s.mySeat ?? 0)
    const deckCodes = record?.deck || []
    const canEdit = legal(s, 'hubSetDeck').length > 0
    const saved = recordDeckReady(record) && deckCodes.length > 0
    const inv = deckInvestigator(s, g)
    const draft = state.arkhamDeckDraftKey === deckDraftKey(s, inv) ? state.arkhamDeckDraft || [] : null
    const unsavedDraft = canEdit && draft && !sameCards(draft, savedDraft(s, inv))
    const editButton = () => canEdit ? h('button', { className: 'bg-btn', 'data-hub-action': 'edit-deck', disabled: locked(s), onclick: () => openDeck(s, g) },
      unsavedDraft ? t('hub.deck.manualDraft', { count: draft.length }) : saved ? t('hub.deck.manualSaved') : t('hub.deck.manualNew', { count: inv?.deckSize || 30 })) : null
    const importButton = () => canEdit ? h('button', { className: 'bg-btn secondary', 'data-hub-action': 'import-deck', disabled: locked(s),
      onclick: () => openDeck(s, g, { importing: true }) }, tableIcon('book'), t('hub.deck.import')) : null
    const libraryButton = () => canEdit ? h('button', { className: 'bg-btn secondary', 'data-hub-action': 'deck-library', disabled: locked(s),
      onclick: () => openDeck(s, g, { library: true }) }, tableIcon('book'), t('hub.deck.library')) : null
    return h('section', { className: 'ah-hub-pane' }, h('h2', {}, t('hub.tab.deck')),
      h('div', { className: 'ah-office-deck-heading' }, portrait(s.state.investigators[s.mySeat ?? 0]), h('div', {},
        h('h3', {}, s.state.investigators[s.mySeat ?? 0].name),
        saved ? h('p', {className:'ah-deck-save-status',role:'status'}, tableIcon('book'), t('hub.deck.savedStatus', { count: deckCodes.length }), s.state.investigators[s.mySeat ?? 0].autoBuilt ? t('hub.deck.autoBuilt') : '') : null)),
      saved && legal(s, 'hubDoneSeat').length ? h('section', { className: 'ah-deck-next-action', role: 'status' },
        h('div', {}, h('strong', {}, t('hub.deck.savedTitle')), h('small', {}, t('hub.deck.savedNote'))),
        action(s, legal(s, 'hubDoneSeat')[0], t('hub.task.confirmReady')),
        h('button', { className: 'bg-btn secondary', disabled: !canEdit || locked(s), onclick: () => openDeck(s, g) }, t('hub.deck.continueEdit'))) : null,
      h('div',{className:'ah-deck-toolbar'},editButton(),importButton(),libraryButton(),legal(s, 'hubAutoDeck').map(move => action(s, move)),
        h('small',{},unsavedDraft ? t('hub.deck.hintUnsaved') : saved ? canEdit ? t('hub.deck.hintSaved') : t('hub.deck.hintView')
          : canEdit ? t('hub.deck.hintCanBuild') : t('hub.deck.hintSelectFirst'))),
      saved ? h('div', { className: 'ah-office-deck-gallery', 'aria-label': t('hub.deck.savedPreviewAria') }, [...new Set(deckCodes)].map(code => {
        const card = s.state.cards?.[code] || g.clientData?.deckBuilder?.cardPool.find(c=>c.code===code) || {}
        const klass = String(card.klass || 'neutral').toLowerCase()
        const type = ({
          asset: ['supply', t('hub.cardKind.asset')], event: ['action', t('hub.cardKind.event')], skill: ['star', t('hub.cardKind.skill')],
          treachery: ['doom', t('hub.cardKind.treachery')], enemy: ['sword', t('hub.cardKind.enemy')],
        })[card.type] || ['book', t('hub.cardKind.card')]
        return h('button', {className:'ah-deck-inspect',onclick:()=>inspectCard(code),'aria-label':t('hub.card.inspectName', { name: nameOf(g, code) }),'data-deck-code':code,'data-zoom-code':code,'data-zoom-name':nameOf(g,code)},
          art(code,nameOf(g,code)),h('span',{className:'ah-deck-copy-count'},`×${deckCodes.filter(c=>c===code).length}`),
          h('strong',{className:'ah-deck-card-name'},nameOf(g,code)),
          h('span',{className:'ah-deck-card-icons'},
            h('span',{title:classLabel(klass) || klass,'aria-label':classLabel(klass) || klass},tableIcon(classIcon(klass))),
            h('span',{title:type[1],'aria-label':type[1]},tableIcon(type[0])),
            card.cost != null ? h('span',{title:t('hub.card.cost', { cost: card.cost }),'aria-label':t('hub.card.cost', { cost: card.cost })},tableIcon('resource'),String(card.cost)) : null))
      })) : h('div', { className: 'ah-office-empty' }, tableIcon('book'), h('p', {}, t('hub.deck.empty'))))
  }

  function upgrades(s, g) {
    const st = s.state
    const name = code => code ? cardDisplayName(st.cards?.[code]) || nameOf(g, code) : t('hub.upgrade.noReplacement')
    const card = code => code ? { ...g.clientData?.deckBuilder?.cardPool.find(item => item.code === code), ...st.cards?.[code] } : null
    const cardDescription = code => {
      const detail = card(code)
      if (!detail) return h('p', { className: 'ah-upgrade-card-description' }, t('hub.upgrade.addDirect'))
      const traits = cardDisplayTraits(detail).join(' · ')
      return h('div', { className: 'ah-upgrade-card-description' },
        traits ? h('small', {}, traits) : null,
        h('p', {}, renderRulesText(h, cardDisplayText(detail) || cardDisplayText({ text: detail.abilityText, textZh: detail.abilityTextZh }) || t('card.zoom.noRules'))))
    }
    const purchases = legal(s, 'hubPurchase')
    const additions = [...new Set(purchases.map(move => move.added))]
    const pool = additions.map(code => ({...g.clientData?.deckBuilder?.cardPool.find(card=>card.code===code),...st.cards?.[code],code,name:name(code)}))
    const shown = filterCards(pool, cardFilters('upgrade'))
    if (shown.length && !shown.some(card=>card.code===state.arkhamUpgradeSelected)) state.arkhamUpgradeSelected = shown[0].code
    const options = shown.length ? purchases.filter(move => move.added === state.arkhamUpgradeSelected) : []
    if (!options.some(move => move.removed === state.arkhamUpgradeRemoved)) state.arkhamUpgradeRemoved = options[0]?.removed
    const selected = options.find(move => move.removed === state.arkhamUpgradeRemoved)
    const cost = Number(selected?.label.match(/（(\d+) XP）/)?.[1] || 0)
    const record = st.campaign.investigators[s.mySeat ?? 0]
    const draft = record?.upgradeDraft
    // 牌组里的每张卡都列在「② 选择替换卡」：换不掉的卡置灰并说明原因。
    // 原因由服务端按同一套升级规则投影（state.upgradeBlocked），前端不复制升级判定。
    const deck = draft?.record?.deck || record?.deck || []
    const deckCodes = [...new Set(deck)]
    const deckCount = code => deck.filter(item => item === code).length
    const blockedReason = new Map((st.upgradeBlocked?.[state.arkhamUpgradeSelected] || []).map(item => [item.code, item.reason]))
    const blockedNotice = state.arkhamUpgradeNotice && state.arkhamUpgradeSelected
      ? blockedReason.get(state.arkhamUpgradeNotice) : null
    const upgraded = !!st.hubUpgradedSeats?.[s.mySeat ?? 0]
      || record?.purchases?.some(item => item.scenarioIndex === st.campaign.scenarioIndex)
    const inspectArt = code => h('button', {
      type: 'button', className: 'ah-upgrade-card-art', 'aria-label': t('hub.card.inspect', { name: name(code) }),
      'data-zoom-code': code, 'data-zoom-name': name(code), onclick: () => inspectCard(code),
    }, art(code, name(code)))
    return h('section', { className: 'ah-hub-pane' }, h('h2', {}, t('hub.upgrade.title')),
      st.uiState !== 'interlude' ? h('p', {}, t('hub.upgrade.interludeOnly')) : null,
      st.investigators.map(inv => h('article', { className: 'ah-hub-seat ah-office-upgrade-seat' },
        h('div', { className: 'ah-office-deck-heading' }, portrait(inv), h('strong', {}, `${inv.name} · ${st.campaign.investigators[inv.seat]?.xp || 0} XP`)),
        st.campaign.investigators[inv.seat]?.upgradeAdvice ? h('p', {}, st.campaign.investigators[inv.seat].upgradeAdvice.reason) : null,
        acting(s, inv.seat) && inv.seat === (s.mySeat ?? 0) && s.players[inv.seat]?.role === 'human'
          ? h('div', { className: 'ah-hub-actions' },
            h('section', {className:'ah-upgrade-library'},
            h('h3', {}, t('hub.upgrade.step1')), filterControls('upgrade', pool, shown),
            shown.length ? h('div', { className: 'ah-office-upgrade-gallery', 'data-scroll-context': JSON.stringify([inv.seat,cardFilters('upgrade')]), 'aria-label': t('hub.upgrade.poolAria') }, shown.map(({code}) => h('button', {
              'data-focus-key': 'upgrade:' + code, 'data-zoom-code': code, 'data-zoom-name': name(code),
              'aria-label': t('hub.upgrade.inspectAria', { name: name(code) }), 'aria-pressed': String(state.arkhamUpgradeSelected === code),
              onclick: () => { state.arkhamUpgradeSelected = code; state.arkhamUpgradeNotice = null; render() },
            }, art(code, name(code)), h('span', {}, name(code))))) : h('p', {className:'ah-office-empty'}, additions.length ? t('hub.upgrade.emptyFiltered') : t('hub.upgrade.emptyNoMoves'))),
            selected ? h('section', {className:'ah-upgrade-workbench'},
              h('h3', {}, t('hub.upgrade.step2')),
              h('div', { className:'ah-office-upgrade-options', 'data-scroll-context': `${inv.seat}:${state.arkhamUpgradeSelected}`, 'aria-label': t('hub.upgrade.optionsAria') },
                options.filter(move => move.removed == null).map(move => h('button', {
                  type: 'button', className: 'ah-upgrade-replacement',
                  'data-focus-key': 'replace:null', 'aria-pressed': String(move === selected),
                  onclick: () => { state.arkhamUpgradeRemoved = move.removed; state.arkhamUpgradeNotice = null; render() },
                }, name(move.removed))),
                deckCodes.map(code => {
                  const move = options.find(item => item.removed === code)
                  const reason = move ? null : blockedReason.get(code) || t('hub.upgrade.cannotReplace')
                  return h('button', {
                    type: 'button', className: 'ah-upgrade-replacement' + (move ? '' : ' is-locked'),
                    'data-focus-key': 'replace:' + code, 'data-zoom-code': code, 'data-zoom-name': name(code),
                    'aria-pressed': String(!!move && move === selected),
                    'aria-disabled': move ? null : 'true',
                    // 置灰卡不写死文字标签：悬浮（title）或点按才说明为什么不能替换。
                    // 原生 title 需要按钮保持可用状态，所以用 aria-disabled 表达不可选。
                    title: move ? t('hub.upgrade.replaceTitle', { name: name(code) }) : reason,
                    'aria-label': move ? t('hub.upgrade.replaceAria', { name: name(code) }) : t('hub.upgrade.blocked', { name: name(code), reason }),
                    onclick: () => {
                      if (move) { state.arkhamUpgradeRemoved = move.removed; state.arkhamUpgradeNotice = null }
                      else state.arkhamUpgradeNotice = code
                      render()
                    },
                  }, h('span', {}, name(code)), deckCount(code) > 1 ? h('i', {}, `×${deckCount(code)}`) : null)
                })),
              h('p', { className: 'ah-upgrade-replacement-note' },
                t('hub.upgrade.replacementNote')),
              blockedNotice ? h('p', { className: 'ah-upgrade-blocked-note', role: 'status' }, tableIcon('lock'),
                t('hub.upgrade.blocked', { name: name(state.arkhamUpgradeNotice), reason: blockedNotice })) : null,
              h('div', {className:'ah-upgrade-comparison'},
                h('div',{}, selected.removed?inspectArt(selected.removed):h('span',{},t('hub.upgrade.extraAdd')),h('strong',{},name(selected.removed)),
                  cardDescription(selected.removed)),
                h('div',{className:'ah-upgrade-cost'},tableIcon('action'),h('b',{},`${cost} XP`),h('small',{},t('hub.upgrade.remainingXp', { xp: (st.campaign.investigators[inv.seat]?.upgradeDraft?.record?.xp ?? st.campaign.investigators[inv.seat]?.xp ?? 0)-cost }))),
                h('div',{},inspectArt(selected.added),h('strong',{},name(selected.added)),
                  cardDescription(selected.added))),
              h('p',{},selected.explanation),action(s,selected,t('hub.upgrade.addMove', { cost }))):null,
            draft ? h('div', { className: 'ah-upgrade-preview' },
              h('h3', {}, t('hub.upgrade.step3')),h('strong', {}, t('hub.upgrade.addedSummary', { changes: draft.changes.length, xp: draft.record.xp })),
              draft.changes.map(change => h('p', {}, `${name(change.removed)} → ${name(change.added)} · ${change.cost} XP`))) : null,
            h('section', { className: 'ah-upgrade-actions', 'aria-label': t('hub.upgrade.actionsAria') },
              h('div', {},
                h('strong', {}, draft ? t('hub.upgrade.statusUnsaved') : upgraded ? t('hub.upgrade.statusSaved') : t('hub.upgrade.statusNone')),
                h('small', {}, draft ? t('hub.upgrade.statusUnsavedNote')
                  : upgraded ? t('hub.upgrade.statusSavedNote')
                    : t('hub.upgrade.statusNoneNote', { xp: record?.xp || 0 }))),
              draft ? h('div', {},
                legal(s, 'hubCancelUpgrades').map(move => action(s, move, t('hub.upgrade.cancelAll'), 'bg-btn secondary')),
                legal(s, 'hubConfirmUpgrades').map(move => action(s, move, t('hub.upgrade.save'))))
                : h('div', {}, legal(s, 'hubDoneSeat').map(move => action(s, move,
                  upgraded ? t('hub.upgrade.finish') : t('hub.upgrade.keepXp', { xp: record?.xp || 0 }),
                  upgraded ? 'bg-btn' : 'bg-btn secondary'))))) : null)))
  }

  function supplies(s) {
    const cp = s.state.campaign
    const labels = cp.supplyLabels || {}
    const label = name => labels[name] || name
    const grouped = names => {
      const counts = new Map()
      for (const name of names) counts.set(name, (counts.get(name) || 0) + 1)
      return [...counts]
    }
    const points = cp.supplyPoints || {}
    const leader = s.state.investigators.find(inv => inv.seat === cp.expeditionLeader)
    const hasSupply = s.state.investigators.some(inv => (cp.supplies?.[inv.seat] || []).length)
    return h('section', { className: 'ah-hub-pane ah-office-supplies' },
      h('small', { className: 'ah-office-eyebrow' }, t('hub.supplies.eyebrow')),
      h('h2', {}, t('hub.tab.supplies')),
      h('p', { className: 'ah-supply-note' },
        t('hub.supplies.note')),
      leader ? h('p', { className: 'ah-supply-leader' }, tableIcon('supply'), t('hub.supplies.leader', { name: leader.name })) : null,
      !hasSupply && !s.state.investigators.some(inv => Number.isFinite(points[inv.seat]))
        ? h('div', { className: 'ah-office-empty' }, tableIcon('supply'), h('p', {}, t('hub.supplies.empty'))) : null,
      s.state.investigators.map(inv => {
        const list = cp.supplies?.[inv.seat] || []
        const remaining = points[inv.seat]
        return h('article', { className: 'ah-supply-card', 'data-supply-seat': inv.seat },
          h('div', { className: 'ah-supply-head' }, h('strong', {}, inv.name),
            Number.isFinite(remaining) && remaining > 0
              ? h('span', { className: 'ah-supply-points' }, t('hub.supplies.points', { points: remaining })) : null),
          list.length
            ? h('ul', { className: 'ah-supply-list' }, grouped(list).map(([name, count]) =>
              h('li', {}, `${label(name)}${count > 1 ? ` ×${count}` : ''}`)))
            : h('p', {}, t('hub.supplies.noneCarried')))
      }))
  }

  // 待决的战役选择。补给选购走卡牌面板（完成按钮在独立的完成栏）；
  // 塔罗抽牌、序章选人、闹鬼结算走万象无终的专用面板（P5）；
  // 其余选择（领队、幕间核对、补给点治疗）仍保持一列按钮。
  function pendingChoicePane(s) {
    const market = supplyPickerModel(s)
    if (market) return h('div', { className: 'ah-hub-pane ah-hub-supply-market' },
      interludeBriefing(s, true),
      renderSupplyPicker(h, market, {
        disabled: locked(s), busy: state.busy,
        onSubmit: move => { if (move && !state.busy) submitMove(move, s) },
      }))
    const panelProps = {
      disabled: locked(s), busy: state.busy,
      onSubmit: move => { if (move && !state.busy) submitMove(move, s) },
      // 序章选人的「详情」入口：复用大厅已有的卡牌详情弹窗（卡面 + 卡背设置），
      // 旧版大厅没有注入 inspectCard 时面板自动隐藏这个按钮。
      inspectCard,
    }
    const tarot = tarotPickerModel(s)
    if (tarot) return h('div', { className: 'ah-hub-pane ah-hub-tcu-panel' }, interludeBriefing(s, true), renderTarotPicker(h, tarot, panelProps))
    const story = storyInvestigatorPickerModel(s)
    if (story) return h('div', { className: 'ah-hub-pane ah-hub-tcu-panel' }, interludeBriefing(s, true), renderStoryInvestigatorPicker(h, story, panelProps))
    const haunted = hauntedChoiceModel(s)
    if (haunted) return h('div', { className: 'ah-hub-pane ah-hub-tcu-panel' }, interludeBriefing(s, true), renderHauntedChoice(h, haunted, panelProps))
    return h('section', { className: 'ah-hub-pane', role: 'dialog', 'aria-label': t('hub.pendingChoice.aria') },
      interludeBriefing(s, true),
      h('h2', {}, renderRulesText(h, s.state.pendingChoice.prompt, { links: false })),
      legal(s, 'choose').map(move => action(s, move)))
  }

  function records(s) {
    const cp = s.state.campaign
    const manifest = game()?.clientData?.campaigns?.find(item => item.id === cp.id)
    const label = key => manifest?.recordLabels?.[key] || key
    const cardNames = cp.recordCardNames || {}
    const shownRecords = Object.entries(cp.records || {}).filter(([, value]) =>
      value !== false && value != null && value !== '' && !(Array.isArray(value) && !value.length))
    return h('section', { className: 'ah-hub-pane ah-office-records' }, h('small', { className: 'ah-office-eyebrow' }, t('hub.records.eyebrow')), h('h2', {}, t('hub.tab.records')),
      h('div', { className: 'ah-office-metrics' }, metric('star', cp.victory, t('hub.records.totalVictory')), metric('book', cp.xp, t('hub.metric.xp'))),
      !shownRecords.length && !cp.scenarioResults?.length ? h('div', { className: 'ah-office-empty' }, tableIcon('book'), h('p', {}, t('hub.records.empty'))) : null,
      shownRecords.map(([key, value]) => h('div', {}, t('hub.records.entry', { label: label(key), value: recordValueText(value, cardNames) }))),
      // 万象无终（P5）：遗留记忆与被看守人追捕都是公开记录，中文名由战役清单下发。
      (s.state.mementos || []).length
        ? h('div', { className: 'ah-hub-records-block', role: 'group', 'aria-label': t('hub.records.mementosAria') },
          h('h3', {}, tableIcon('book'), t('hub.records.mementos', { count: s.state.mementos.length })),
          h('ul', { className: 'ah-hub-record-chips' }, s.state.mementos.map(id =>
            h('li', { className: 'ah-hub-record-chip', 'data-memento': id },
              manifest?.mementoLabels?.[id] || cp.mementoLabels?.[id] || id))))
        : null,
      s.state.watcher
        ? h('div', { className: 'ah-hub-records-block', role: 'group', 'aria-label': t('hub.records.watcherAria') },
          h('h3', {}, tableIcon('eye'), t('hub.records.watcher')),
          h('p', {}, (s.state.watcher.huntedSeats || []).length
            ? t('hub.records.hunting', { names: (s.state.watcher.huntedSeats || []).map(seat => s.state.investigators.find(inv => inv.seat === seat)?.name || t('hub.seat.name', { seat: seat + 1 })).join(t('hub.list.separator')) })
            : t('hub.records.noHunted')),
          (s.state.watcher.taken || []).length
            ? h('p', {}, t('hub.records.taken', { names: s.state.watcher.taken.map(code => cardNames[code] || s.state.investigators.find(inv => inv.code === code)?.name || code).join(t('hub.list.separator')) }))
            : null)
        : null,
      (cp.scenarioResults || []).map(result => h('article', { className: 'ah-hub-scenario' },
        h('strong', {}, manifest?.scenarios.find(item => item.id === result.scenarioId)?.name || result.scenarioId),
        h('span', {}, t('hub.records.scenarioSummary', { result: resultName(s, result), victory: result.victory, rounds: result.rounds })),
        Object.entries(result.recordsAfter || {}).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(result.recordsBefore?.[key]))
          .map(([key, value]) => h('p', {}, t('hub.records.change', { label: label(key), value: recordChangeText(result.recordsBefore?.[key], value, cardNames) }))))),
      s.state.investigators.map(inv => h('p', {}, t('hub.records.trauma', {
        name: inv.name, physical: cp.trauma[inv.seat]?.physical || 0, mental: cp.trauma[inv.seat]?.mental || 0,
      }))))
  }

  async function retrySave(s, asNew = false) {
    state.busy = true; render()
    try {
      const result = await api('POST', asNew ? '/session/save-as' : '/session/save', { sessionId: s.sessionId })
      state.session = result.session
      rememberSession(result.session.sessionId)
      state.error = null
    } catch (error) { state.error = String(error.message) }
    state.busy = false; render()
  }

  function renderGame(s) {
    const g = game()
    // 并行/双线战役：模式未定时先给「开局模式」整屏，页签与其它局外面板全部不出现。
    const modeModel = modePanelModel(s.state, s.state.legalMoves || [])
    if (modeModel.visible && modeModel.firstScreen && s.state.uiState === 'campaignHub') {
      return h('div', { className: 'bg-game ah-hub ah-office ah-theme', ...presentationAttributes(s.state),
        'data-ui-state': s.state.uiState, 'data-mode-gate': 'true' },
        h('header', { className: 'bg-game-head' },
          h('div', { className: 'bg-game-title' }, t('hub.game.title', { campaign: s.state.campaign.name })),
          h('div', { className: 'bg-game-status' }, stageLabel(s.state.uiState)),
          h('div', { className: 'bg-game-actions' },
            h('button', { className: 'bg-btn secondary', onclick: rulebookOpen }, t('table.rulebook')),
            h('button', { className: 'bg-btn secondary', onclick: catalogOpen }, t('table.catalog')),
            h('button', { className: 'bg-btn secondary', onclick: () => refreshSession(s) }, t('hub.refresh')),
            h('button', { className: 'bg-btn secondary', onclick: leave }, t('table.leave')),
            feedbackEntry())),
        h('section', { className: 'ah-office-mode-gate', 'aria-label': t('hub.mode.gateAria') },
          h('small', { className: 'ah-office-eyebrow' }, t('hub.mode.eyebrow')),
          h('h1', {}, t('hub.mode.gateTitle')),
          h('p', {}, t('hub.mode.gateHint')),
          modePanel(s, modeModel)))
    }
    if (state.arkhamLastUiState !== s.state.uiState) {
      state.arkhamLastUiState = s.state.uiState
      const eliminated = s.state.campaign.investigators[s.mySeat ?? 0]?.status !== 'active'
      state.arkhamHubTab = ['scenarioResult','campaignResult'].includes(s.state.uiState) ? 'story' : s.state.uiState === 'interlude' ? eliminated ? 'investigators' : 'upgrades'
        : s.state.uiState === 'scenarioSetup' ? s.state.hubReady ? 'departure' : 'investigators' : 'overview'
    }
    if (canDepart(s) && state.arkhamDepartureReady !== `${s.sessionId}:${s.state.campaign.scenarioIndex}`) state.arkhamHubTab = 'departure'
    state.arkhamDepartureReady = canDepart(s) ? `${s.sessionId}:${s.state.campaign.scenarioIndex}` : null
    const campaignTabs = supportsSupplies(s.state.campaign) ? tabLabels() : tabLabels().filter(([id]) => id !== 'supplies')
    const activeTab = campaignTabs.some(([id]) => id === state.arkhamHubTab) ? state.arkhamHubTab : 'overview'
    const panes = { departure, overview, scenarios, investigators, deck, upgrades, supplies, records,
      story:s=>renderStoryReader(h,s,state,render,action,g,checkpointAction) }
    const saveNotice = s.saveDetached ? t('hub.game.saveDetached')
      : s.saveError ? t('hub.game.saveFailed', { error: s.saveError }) : null
    return h('div', { className: 'bg-game ah-hub ah-office ah-theme', ...presentationAttributes(s.state), 'data-ui-state': s.state.uiState,
      'data-scroll-context': `${s.sessionId}:${s.state.uiState}:${activeTab}` },
      h('header', { className: 'bg-game-head' },
        h('div', { className: 'bg-game-title' }, t('hub.game.title', { campaign: s.state.campaign.name })),
        h('div', { className: 'bg-game-status' }, stageLabel(s.state.uiState)),
        h('div', { className: 'bg-game-actions' },
          h('button', { className: 'bg-btn secondary', onclick: rulebookOpen }, t('table.rulebook')),
          h('button', { className: 'bg-btn secondary', onclick: catalogOpen }, t('table.catalog')),
          h('button', { className: 'bg-btn secondary', onclick: () => refreshSession(s) }, t('hub.refresh')),
          h('button', { className: 'bg-btn secondary', onclick: leave }, t('table.leave')),
          feedbackEntry())),
      saveNotice ? h('div', { className: 'ah-hub-save-alert', role: 'alert' }, saveNotice,
        s.online && s.mySeat !== 0 ? h('p', {}, t('hub.game.hostNotice'))
          : h('button', { className: 'bg-btn', onclick: () => retrySave(s, !!s.saveDetached) }, s.saveDetached ? t('hub.game.saveAsNew') : t('hub.game.retrySave'))) : null,
      state.error ? h('div', { className: 'ah-hub-save-alert', role: 'alert' }, state.error) : null,
      h('nav', { className: 'ah-hub-tabs', 'aria-label': t('hub.game.tabsAria') },
        campaignTabs.map(([id, label]) => h('button', { className: (activeTab === id ? 'active ' : '') + (id === 'departure' ? 'ah-departure-tab' + (canDepart(s) ? ' is-ready' : '') : ''),
          'aria-label': label, 'aria-current': activeTab === id ? 'page' : null, onclick: () => changeTab(id) },
          tableIcon(TAB_ICONS[id] || 'star'), label,
          id === 'departure' ? h('small', {}, canDepart(s) ? t('hub.game.ready') : t('hub.game.pending')) : null))),
      workflowGuide(s, activeTab),
      preparationProgress(s),
      s.state.uiState === 'interlude' && !s.state.pendingChoice ? interludeBriefing(s) : null,
      s.state.pendingChoice ? pendingChoicePane(s)
        : panes[activeTab](s, g || { clientData: { campaigns: [], deckBuilder: null } }),
      renderCheckpointForkModal(s))
  }

  // An import that first switches investigator lands here once the switch is
  // committed; a failed or different switch drops the pending import.
  function applyPendingImport(s, g, inv) {
    const imp = state.arkhamDeckImport
    if (!imp?.pending) return
    if (imp.pending.sessionId !== s.sessionId) { imp.pending = null; return }
    if (inv?.code !== imp.pending.code) { if (!state.busy) imp.pending = null; return }
    imp.pending = null
    const builder = scopedBuilder(s, g.clientData?.deckBuilder)
    const plan = imp.deck && planArkhamDbImport(imp.deck, { investigators: builder?.investigators, cardPool: builder?.cardPool, currentCode: inv.code })
    if (!plan?.ready || plan.mismatch) return
    state.arkhamDeckUndo = [[...(state.arkhamDeckDraft || [])]]; state.arkhamDeckRedo = []
    state.arkhamDeckDraft = [...plan.codes]
    state.arkhamDeckDraftKey = deckDraftKey(s, inv)
    imp.open = false
    imp.notice = t('hub.import.switched', { name: inv.name, deck: imp.deck.name })
  }

  function importPanel(s, g, inv, draft, replaceDraft) {
    const imp = state.arkhamDeckImport
    const builder = scopedBuilder(s, g.clientData?.deckBuilder)
    const deck = imp.deck
    const plan = deck ? planArkhamDbImport(deck, { investigators: builder?.investigators, cardPool: builder?.cardPool, currentCode: inv?.code }) : null
    const total = deck ? deck.entries.reduce((sum, entry) => sum + entry.count, 0) : 0
    const switchMove = plan?.ready && plan.mismatch ? legal(s, 'hubSelectInvestigator').find(move => move.code === plan.investigator.code) : null
    const list = (items, className) => h('ul', { className }, items.map(item => h('li', {},
      h('b', {}, `${item.name} ×${item.count}`), h('span', {}, item.reason))))
    const actions = !plan || !plan.ready ? null : !plan.mismatch
      ? h('button', { className: 'bg-btn', disabled: state.busy, onclick: () => {
        replaceDraft(plan.codes)
        imp.open = false
        imp.notice = plan.errors.length ? t('hub.import.loadedWithErrors', { deck: deck.name }) : t('hub.import.loadedOk', { deck: deck.name })
        render()
      } }, draft.length ? t('hub.import.loadDraftReplace', { count: draft.length }) : t('hub.import.loadDraft'))
      : switchMove ? h('button', { className: 'bg-btn', disabled: locked(s), onclick: () => {
        imp.pending = { sessionId: s.sessionId, code: plan.investigator.code }
        submitMove(switchMove, s)
      } }, t('hub.import.switchAndLoad', { name: plan.investigator.name }))
      : h('p', { className: 'ah-deck-import-warn' }, t('hub.import.mismatch', { name: plan.investigator.name }))
    const xpSuffix = deck?.xp ? t('hub.deck.xpSuffix', { xp: deck.xp }) : ''
    return h('section', { className: 'ah-deck-import', 'aria-label': t('hub.import.aria') },
      h('div', { className: 'ah-deck-import-head' }, h('h3', {}, t('hub.import.title')),
        h('small', {}, t('hub.import.note'))),
      h('div', { className: 'ah-deck-import-form' },
        h('input', { type: 'text', value: imp.text || '', placeholder: 'https://arkhamdb.com/decklist/view/12345', 'aria-label': t('hub.import.inputAria'),
          'data-focus-key': 'arkhamdb-input', spellcheck: 'false', autocomplete: 'off',
          oninput: event => { imp.text = event.target.value },
          onkeydown: event => { if (event.key === 'Enter') { event.preventDefault(); readArkhamDbDeck() } } }),
        h('button', { className: 'bg-btn', disabled: !!imp.loading, onclick: readArkhamDbDeck }, imp.loading ? t('hub.import.reading') : t('hub.import.read')),
        h('button', { className: 'bg-btn secondary', onclick: () => { imp.open = false; render() } }, t('hub.import.collapse'))),
      imp.error ? h('p', { className: 'ah-deck-import-error', role: 'alert' }, imp.error) : null,
      plan ? h('div', { className: 'ah-deck-import-result' + (plan.ready ? ' is-ready' : ' is-blocked'), 'aria-live': 'polite' },
        h('header', {},
          h('strong', {}, deck.name),
          h('small', {}, t('hub.import.deckSummary', { investigator: deck.investigatorName, count: total }) + xpSuffix),
          deck.url ? h('a', { href: deck.url, target: '_blank', rel: 'noopener noreferrer' }, t('hub.import.viewOnArkhamDb')) : null),
        plan.blocked.length ? h('div', { className: 'ah-deck-import-blocked' },
          h('p', {}, t('hub.import.blocked', { count: plan.blocked.length })), list(plan.blocked, 'is-blocked')) : null,
        plan.ready && plan.mismatch ? h('p', { className: 'ah-deck-import-warn' }, t('hub.import.mismatchDetail', { name: plan.investigator.name, current: inv?.name || t('hub.cardFallback') })) : null,
        plan.ready && plan.errors.length ? h('div', { className: 'ah-deck-import-warn' },
          h('p', {}, t('hub.import.errors', { count: plan.errors.length })), plan.errors.slice(0, 4).map(error => h('p', {}, '· ' + error))) : null,
        plan.ready && !plan.errors.length && !plan.mismatch ? h('p', { className: 'ah-deck-import-ok' }, t('hub.import.ok', { count: plan.codes.length })) : null,
        plan.auto.length ? h('div', { className: 'ah-deck-import-auto' }, h('p', {}, t('hub.import.auto')), list(plan.auto, 'is-auto')) : null,
        plan.notes.map(note => h('p', { className: 'ah-deck-import-note' }, note)),
        actions) : null)
  }

  function libraryPanel(s, g, inv, draft, replaceDraft) {
    const lib = deckLibrary()
    const imp = state.arkhamDeckImport
    const builder = g.clientData?.deckBuilder
    const scoped = scopedBuilder(s, builder)
    const investigatorName = code => builder?.investigators.find(item => item.code === code)?.name || nameOf(g, code)
    const current = lib.decks?.find(deck => deck.id === lib.currentId && deck.investigator_code === inv?.code)
    // Decks for the current investigator first; otherwise keep the newest-first order.
    const decks = [...(lib.decks || [])].sort((a, b) => (b.investigator_code === inv?.code) - (a.investigator_code === inv?.code))
    const total = deck => Object.values(deck.slots || {}).reduce((sum, count) => sum + count, 0)
    const fail = message => { lib.error = message; lib.notice = ''; render() }
    const load = deck => {
      const plan = deck.description && planArkhamDbImport(deck.description, { investigators: scoped?.investigators, cardPool: scoped?.cardPool, currentCode: inv?.code })
      if (!plan) return fail(t('hub.library.loadFailedEmpty', { deck: deck.name }))
      if (!plan.ready) return fail(t('hub.library.loadFailedBlocked', { deck: deck.name, count: plan.blocked.length })
        + plan.blocked.slice(0, 4).map(item => t('hub.import.blockedItem', { name: item.name, reason: item.reason })).join(t('hub.list.separator')) + (plan.blocked.length > 4 ? t('hub.import.blockedMore') : ''))
      Object.assign(lib, { currentId: deck.id, name: deck.name, error: '', notice: '', confirmDelete: null })
      if (plan.mismatch) {
        const move = legal(s, 'hubSelectInvestigator').find(item => item.code === plan.investigator.code)
        if (!move || locked(s)) return fail(t('hub.import.mismatch', { name: plan.investigator.name }))
        // applyPendingImport finishes the load once the investigator switch is committed.
        Object.assign(imp, { deck: deck.description, pending: { sessionId: s.sessionId, code: plan.investigator.code } })
        lib.open = false
        submitMove(move, s)
        return
      }
      lib.open = false
      imp.notice = plan.errors.length ? t('hub.library.loadedWithErrors', { deck: deck.name }) : t('hub.library.loadedOk', { deck: deck.name })
      replaceDraft(plan.codes)
    }
    return h('section', { className: 'ah-deck-import ah-deck-library', 'aria-label': t('hub.library.aria') },
      h('div', { className: 'ah-deck-import-head' }, h('h3', {}, t('hub.library.title')),
        h('small', {}, t('hub.library.note'))),
      h('div', { className: 'ah-deck-import-form' },
        h('input', { type: 'text', value: lib.name || '', placeholder: t('hub.library.namePlaceholder', { name: inv?.name || t('hub.investigator.fallbackName') }), maxlength: '60', 'aria-label': t('hub.library.nameAria'),
          'data-focus-key': 'library-name', autocomplete: 'off', oninput: event => { lib.name = event.target.value } }),
        current ? h('button', { className: 'bg-btn', disabled: !!lib.saving || !draft.length, onclick: () => storeLibraryDeck(inv, draft, true) },
          t('hub.library.overwrite', { deck: current.name })) : null,
        h('button', { className: current ? 'bg-btn secondary' : 'bg-btn', disabled: !!lib.saving || !draft.length || !inv,
          title: draft.length ? '' : t('hub.library.emptyDraftTitle'), onclick: () => storeLibraryDeck(inv, draft, false) }, t('hub.library.saveAsNew', { count: draft.length })),
        h('button', { className: 'bg-btn secondary', onclick: () => { lib.open = false; render() } }, t('hub.import.collapse'))),
      lib.error ? h('p', { className: 'ah-deck-import-error', role: 'alert' }, lib.error) : null,
      lib.notice ? h('p', { className: 'ah-deck-import-ok', role: 'status' }, lib.notice) : null,
      !lib.decks ? h('p', { className: 'ah-deck-import-note' }, lib.loading ? t('hub.library.loading') : t('hub.library.unavailable'))
        : !decks.length ? h('p', { className: 'ah-deck-import-note' }, t('hub.library.empty'))
          : h('ul', { className: 'ah-deck-library-list', 'aria-label': t('hub.library.listAria') }, decks.map(deck => h('li', {
            className: deck.investigator_code === inv?.code ? 'is-current-investigator' : '', 'data-library-deck': deck.id },
          h('div', {}, h('strong', {}, deck.name),
            h('small', {}, t('hub.library.entryMeta', {
              investigator: investigatorName(deck.investigator_code), count: total(deck),
              date: new Date(deck.updatedAt).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' }),
            }))),
          h('div', {},
            h('button', { className: 'bg-btn', disabled: !!lib.saving || state.busy, onclick: () => load(deck) },
              deck.investigator_code === inv?.code ? (draft.length ? t('hub.library.loadReplace') : t('hub.library.load')) : t('hub.library.switchAndLoad', { name: investigatorName(deck.investigator_code) })),
            lib.confirmDelete === deck.id
              ? h('button', { className: 'bg-btn', disabled: !!lib.saving, onclick: () => removeLibraryDeck(deck) }, t('hub.library.confirmDelete'))
              : h('button', { className: 'bg-btn secondary', disabled: !!lib.saving, onclick: () => { lib.confirmDelete = deck.id; render() } }, t('hub.delete')))))))
  }

  function renderDeckModal(s) {
    if (!state.arkhamDeckOpen) return null
    const g = game()
    const inv = deckInvestigator(s, g)
    applyPendingImport(s, g, inv)
    // 卡牌范围（渐进式）在服务端校验；这里同步收窄候选，避免把必被拒绝的卡摆出来。
    const scope = s.state.cardPoolScope
    const cycle = campaignCycle(s.state.campaign?.id)
    const pool = (g.clientData?.deckBuilder?.cardPool || [])
      .filter(card => inv?.allowedCards?.includes(card.code) && cardAllowedByScope(card.code, scope, cycle))
      .map(card=>({...s.state.cards?.[card.code],...card}))
    const draft = state.arkhamDeckDraft ||= []
    const shown = filterCards(pool, cardFilters('deck'))
    const counts = Object.fromEntries([...new Set(draft)].map(code => [code, draft.filter(item => item === code).length]))
    const size = inv?.deckSize || 30
    if (inv?.rules) registerDeckRules(inv.code, inv.rules)
    const cardMap = Object.fromEntries(pool.map(card => [card.code, card]))
    const checked = inv ? validateDeckRules(inv, draft, cardMap) : { errors: [t('hub.builder.noInvestigator')], count: 0 }
    const distribution = draft.reduce((out, code) => {
      const card = cardMap[code]
      if (card) out[card.type] = (out[card.type] || 0) + 1
      return out
    }, {})
    // One partial validation per card and render; the pool asks several times.
    const addErrors = new Map()
    const addError = code => {
      if (!addErrors.has(code)) addErrors.set(code, !inv ? t('hub.builder.noInvestigator') : !cardMap[code] ? t('hub.builder.cardUnavailable')
        : validateDeckRules(inv, [...draft, code], cardMap, { partial: true }).errors.join(t('hub.list.semicolon')))
      return addErrors.get(code)
    }
    const canAdd = code => !state.busy && !addError(code)
    const edit = fn => { (state.arkhamDeckUndo ||= []).push([...draft]); state.arkhamDeckRedo=[]; fn(); render() }
    const add = code => { if (canAdd(code)) edit(()=>draft.push(code)) }
    const remove = code => { if (!state.busy && draft.includes(code)) edit(()=>draft.splice(draft.indexOf(code),1)) }
    const replaceDraft = codes => { if (!state.busy) edit(() => { state.arkhamDeckDraft = [...codes] }) }
    const restore = (from,to) => { const stack=state[from] || [];if(stack.length&&!state.busy){(state[to] ||= []).push([...draft]);state.arkhamDeckDraft=stack.pop();render()} }
    const baseline = savedDraft(s, inv)
    const saved = !!recordForSeat(s, deckSeat(s))?.deck?.length
    const dirty = !sameCards(draft, baseline)
    const remaining = size - checked.count
    const imp = state.arkhamDeckImport || (state.arkhamDeckImport = { text: '', open: false })
    const lib = deckLibrary()
    const costCounts = [0, 1, 2, 3, 4, 5].map(cost => draft.filter(code => {
      const value = cardMap[code]?.cost
      return typeof value === 'number' && (cost === 5 ? value >= 5 : value === cost)
    }).length)
    const byCost = (a, b) => (cardMap[a]?.cost ?? 99) - (cardMap[b]?.cost ?? 99) || nameOf(g, a).localeCompare(nameOf(g, b), 'zh') || a.localeCompare(b)
    const groups = [[ 'asset', t('hub.cardKind.asset')], ['event', t('hub.cardKind.event')], ['skill', t('hub.cardKind.skill')], [null, t('hub.cardKind.other')]].map(([type, label]) => {
      const codes = Object.keys(counts).filter(code => type ? cardMap[code]?.type === type : !['asset', 'event', 'skill'].includes(cardMap[code]?.type)).sort(byCost)
      return { label, codes, total: codes.reduce((sum, code) => sum + counts[code], 0) }
    }).filter(group => group.codes.length)
    const fixed = [...(inv?.signatureCards || []).map(card => [card, t('hub.deck.fixedSignature')]), ...(inv?.signatureWeaknesses || []).map(card => [card, t('hub.deck.fixedWeakness')])]
    const keys = event => {
      const tag = event.target?.tagName
      if ((event.ctrlKey || event.metaKey) && !event.altKey && /^[zy]$/i.test(event.key) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        event.preventDefault()
        const redo = event.key.toLowerCase() === 'y' || event.shiftKey
        restore(redo ? 'arkhamDeckRedo' : 'arkhamDeckUndo', redo ? 'arkhamDeckUndo' : 'arkhamDeckRedo')
        return
      }
      if (event.key === 'Escape' && lib.open && event.target?.closest?.('.ah-deck-library')) {
        event.preventDefault(); event.stopPropagation(); lib.open = false; render()
        document.querySelector('[data-deck-tool="library"]')?.focus({ preventScroll: true })
        return
      }
      if (event.key === 'Escape' && imp.open && event.target?.closest?.('.ah-deck-import')) {
        event.preventDefault(); event.stopPropagation(); imp.open = false; render()
        document.querySelector('[data-deck-tool="import"]')?.focus({ preventScroll: true })
        return
      }
      modalKeys(closeDeck)(event)
    }
    return h('div', { className: 'bg-backdrop' },
      h('div', { className: 'bg-modal ah-db-modal ah-office', 'data-scroll-context': `${s.sessionId}:${inv?.seat}:${inv?.code}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': t('hub.tab.deck'),
        onkeydown: keys, onclick: event => event.stopPropagation() },
        h('header', { className: 'ah-db-modal-head' },
          h('h2', {}, t('hub.builder.title', { name: inv?.name || '', count: checked.count, size })),
          h('div', { className: 'ah-db-modal-tools' },
            h('button', { className: 'bg-btn' + (imp.open ? '' : ' secondary'), 'data-deck-tool': 'import', 'aria-expanded': String(!!imp.open), onclick: () => {
              imp.open = !imp.open; if (imp.open) lib.open = false; render()
              if (imp.open) setTimeout(() => document.querySelector('.ah-deck-import:not(.ah-deck-library) input')?.focus({ preventScroll: true }), 0)
            } }, t('hub.builder.import')),
            h('button', { className: 'bg-btn' + (lib.open ? '' : ' secondary'), 'data-deck-tool': 'library', 'aria-expanded': String(!!lib.open), onclick: () => {
              lib.open = !lib.open
              if (lib.open) { imp.open = false; Object.assign(lib, { notice: '', error: '', confirmDelete: null }) }
              render()
              if (lib.open) refreshLibrary()
            } }, t('hub.builder.library')),
            h('small', { className: 'ah-db-modal-hint' }, t('hub.builder.hint')))),
        imp.open ? importPanel(s, g, inv, draft, replaceDraft) : null,
        lib.open ? libraryPanel(s, g, inv, draft, replaceDraft) : null,
        h('div', { className: 'ah-office-builder' },
        h('section', { className: 'ah-office-library', 'aria-label': t('hub.builder.poolAria') },
        filterControls('deck', pool, shown),
        h('div', { className: 'ah-hub-card-pool', 'data-scroll-context': JSON.stringify([inv?.code, cardFilters('deck')]) }, shown.map(card => h('div', {
          className: 'ah-db-card' + (counts[card.code] ? ' is-in-deck' : '') + (remaining > 0 && addError(card.code) ? ' is-unavailable' : ''),
          'data-zoom-code': card.code, 'data-zoom-name': card.name },
          h('button', { disabled: !canAdd(card.code), draggable: String(canAdd(card.code)), 'data-focus-key': 'add:' + card.code, 'aria-label': t('hub.builder.addAria', { name: card.name, count: counts[card.code] || 0, limit: card.deckLimit || 2 }),
            title: addError(card.code) || t('hub.builder.addTitle'),
            ondragstart: event => { event.dataTransfer.setData('application/x-arkham-hub-card', card.code); event.dataTransfer.effectAllowed = 'copy' },
            onclick: () => add(card.code) },
            art(card.code, card.name), counts[card.code] ? h('i', { className: 'ah-db-card-count', 'aria-hidden': 'true' }, `×${counts[card.code]}`) : null,
            h('span', {}, card.name), h('small', {}, t('hub.builder.cardMeta', { count: counts[card.code] || 0, limit: card.deckLimit || 2, cost: card.cost ?? '—', xp: card.xp || 0 }))),
          h('div',{className:'ah-builder-card-tools'},h('button',{'aria-label':t('hub.builder.decrease', { name: card.name }),disabled:state.busy || !counts[card.code],onclick:()=>remove(card.code)},'−'),
            h('button',{'aria-label':t('hub.card.inspectName', { name: card.name }),onclick:()=>inspectCard(card.code)},t('hub.builder.detail')),
            h('button',{'aria-label':t('hub.builder.increase', { name: card.name }),disabled:!canAdd(card.code),onclick:()=>add(card.code)},'+'))))),
        !shown.length ? h('p', { className: 'ah-office-empty' }, t('hub.builder.emptyPool')) : null),
        h('aside', { className: 'ah-office-deck-tray', 'aria-label': t('hub.builder.trayAria'),
          ondragover: event => { if (Array.from(event.dataTransfer.types).includes('application/x-arkham-hub-card')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; event.currentTarget.classList.add('is-dragover') } },
          ondragleave: event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.classList.remove('is-dragover') },
          ondrop: event => { event.preventDefault(); event.currentTarget.classList.remove('is-dragover'); add(event.dataTransfer.getData('application/x-arkham-hub-card')) },
        }, h('h3', {}, t('hub.builder.trayTitle', { count: checked.count, size })),
        h('div', { className: 'ah-deck-progress' + (remaining === 0 ? ' is-full' : remaining < 0 ? ' is-over' : ''), 'aria-hidden': 'true' },
          h('i', { style: `width:${Math.min(100, Math.max(0, checked.count / size * 100))}%` })),
        h('small', { className: 'ah-deck-progress-text' + (dirty ? ' is-dirty' : '') },
          remaining > 0 ? t('hub.builder.remaining', { count: remaining }) : remaining < 0 ? t('hub.builder.over', { count: -remaining }) : t('hub.builder.full'),
          dirty ? t('hub.builder.dirtySuffix') : saved ? t('hub.builder.savedSuffix') : ''),
        imp.notice ? h('p', { className: 'ah-deck-import-notice' }, imp.notice) : null,
        h('small', {}, t('hub.builder.hintDrag')),
        h('div',{className:'ah-builder-tools'},h('button',{disabled:state.busy || !state.arkhamDeckUndo?.length,onclick:()=>restore('arkhamDeckUndo','arkhamDeckRedo')},t('hub.builder.undo')),
          h('button',{disabled:state.busy || !state.arkhamDeckRedo?.length,onclick:()=>restore('arkhamDeckRedo','arkhamDeckUndo')},t('hub.builder.redo')),
          h('button',{disabled:state.busy || !draft.length,title:t('hub.builder.clearTitle'),onclick:()=>replaceDraft([])},t('hub.builder.clear')),
          saved ? h('button',{disabled:state.busy || !dirty,title:t('hub.builder.restoreTitle'),onclick:()=>replaceDraft(baseline)},t('hub.builder.restore')) : null),
        h('p', {}, t('hub.builder.distribution', { asset: distribution.asset || 0, event: distribution.event || 0, skill: distribution.skill || 0 })),
        h('div', { className: 'ah-office-cost-curve', 'aria-label': t('hub.builder.costCurveAria') }, costCounts.map((count, cost) => h('div', { title: t('hub.builder.costBarTitle', { cost: cost === 5 ? '5+' : cost, count }) },
          h('small', {}, String(count)), h('i', { style: `height:${Math.max(2, count / Math.max(1, ...costCounts) * 42)}px` }), h('span', {}, cost === 5 ? '5+' : String(cost))))),
        h('div', { className: 'ah-hub-deck-list' }, !groups.length ? h('p', { className: 'ah-deck-list-empty' }, t('hub.builder.emptyDeck')) : null,
          groups.flatMap(group => [
            h('h4', { className: 'ah-deck-group' }, h('span', {}, group.label), h('small', {}, t('hub.builder.groupCount', { count: group.total }))),
            ...group.codes.map(code => h('div',{className:'ah-deck-row','data-zoom-code':code,'data-zoom-name':nameOf(g,code)},
              h('button',{'aria-label':t('hub.card.inspectName', { name: nameOf(g, code) }),onclick:()=>inspectCard(code)},art(code,nameOf(g,code)),
                h('span',{},nameOf(g,code)), cardMap[code]?.cost != null ? h('small',{className:'ah-deck-row-cost'},String(cardMap[code].cost)) : null),
              h('button',{'aria-label':t('hub.builder.remove', { name: nameOf(g, code) }),disabled:state.busy,onclick:()=>remove(code)},'−'),h('b',{},String(counts[code])),
              h('button',{'aria-label':t('hub.builder.fill', { name: nameOf(g, code) }),disabled:!canAdd(code),title:addError(code) || '',onclick:()=>add(code)},'+'))),
          ])),
        checked.errors.length ? h('div', { role: 'status', className: 'ah-office-deck-validation' }, checked.errors.map(error => h('p', {}, error))) : h('p', { role: 'status' }, t('hub.builder.valid')),
        inv ? h('section', { className: 'ah-deck-fixed', 'aria-label': t('hub.builder.fixedTitle') },
          h('h4', { className: 'ah-deck-group' }, h('span', {}, t('hub.builder.fixedTitle')), h('small', {}, t('hub.builder.groupCount', { count: fixed.length + 1 }))),
          fixed.map(([card, label]) => h('button', { className: 'ah-deck-fixed-card', 'aria-label': t('hub.builder.fixedInspect', { label, name: card.name }),
            'data-zoom-code': card.code, 'data-zoom-name': card.name, onclick: () => inspectCard(card.code) },
            art(card.code, card.name), h('span', {}, card.name), h('small', {}, label))),
          h('div', { className: 'ah-deck-fixed-card is-random' }, tableIcon('doom'), h('span', {}, t('hub.builder.randomWeakness')), h('small', {}, t('hub.builder.randomWeaknessHint')))) : null)),
        h('div', { className: 'bg-modal-foot' },
          dirty ? h('small', { className: 'ah-deck-foot-hint' }, t('hub.builder.cancelHint')) : null,
          h('button', { className: 'bg-btn secondary', onclick: closeDeck }, t('common.cancel')),
          h('button', { className: 'bg-btn', disabled: locked(s) || checked.errors.length > 0, title: checked.errors[0] || '',
            onclick: () => {
              state.arkhamDeckOpen = false
              if (state.arkhamDeckImport) state.arkhamDeckImport.notice = ''
              submitMove({ action: 'hubSetDeck', codes: [...draft] }, s)
            } }, t('hub.builder.save')))))
  }

  return { onOpenSetup,
    renderSetupModal: g => stablePanel('.ah-hub-setup', () => renderSetupModal(g)),
    renderGame: s => stablePanel('.ah-hub', () => renderGame(s)),
    renderDeckModal: s => stablePanel('.ah-db-modal', () => renderDeckModal(s)),
  }
}
