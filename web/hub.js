import { renderRulesText } from './card-text.js'
import { registerDeckRules, validateDeckRules, cardAllowedByScope, campaignCycle, normalizeCardPoolScope, CARD_POOL_SCOPE_LABELS } from './deck-rules.js'
import { parseArkhamDbInput, loadArkhamDbDeck, planArkhamDbImport } from './arkhamdb-import.js'
import { listLocalDecks, saveLocalDeck, deleteLocalDeck } from './deck-library.js'
import { tableArt } from './table-art.js'
import { tableIcon, classIcon } from './table-components.js'
import { renderStoryReader } from './story-reader.js'
import { cardSource, filterCards, renderCardFilters } from './card-filters.js'
import { campaignPresentation, presentationAttributes } from './campaign-presentation.js'
import { renderSupplyPicker, supplyPickerModel } from './supply-picker.js'
import { captureScrollState, restoreScrollWhenMounted } from './scroll-state.js'
import { installCardZoom } from './card-zoom.js'
import { recordValueText, recordChangeText } from './campaign-records.js'
const STAGES = { campaignHub: '战役准备', scenarioSetup: '调查准备', inScenario: '调查进行中', scenario: '调查进行中', scenarioResult: '调查报告', interlude: '关间休整', campaignResult: '战役终章' }
const DIFFICULTIES = { easy: '简单', standard: '普通', hard: '困难', expert: '专家' }
const CLASSES = { guardian: '守护者', seeker: '探求者', rogue: '流浪者', mystic: '潜修者', survivor: '生存者', neutral: '中立' }
// 选调查员时的扩展包署名：核心包沿用档案口径，其余循环复用卡牌筛选的系列表，
// 所以新增循环（失落的时代、万象无终……）不必在两张表里各写一遍中文名。
const PACKS = { core: '核心包' }
function packLabel(pack, englishName = '') {
  if (!pack) return '调查员'
  if (PACKS[pack]) return PACKS[pack]
  const series = cardSource({ pack, packName: englishName }).packName
  return series && series !== pack ? series : englishName || pack
}
const outcomeName = value => ({ noResolution: '未达成结局', defeat: '调查失败', survived: '生还', victory: '调查成功' })[value] || String(value ?? '待结算').replace(/^r(\d+)$/, '结局 $1')
// Arkham-only campaign shell. The hall provides transport and generic modal hosting.
export function createHubUI({ h, api, render, state, startGame, loadSavedSession, renderOnlineSetup,
  rememberSession, leave, submitMove, refreshSession, catalogOpen, rulebookOpen, inspectCard, canAct = () => true,
  openFeedback }) {
  installCardZoom(h)
  const tabs = [
    ['departure', '开始关卡'],
    ['overview', '战役总览'], ['scenarios', '关卡选择'], ['investigators', '调查员与席位'],
    ['deck', '卡组构筑'], ['upgrades', '升级'], ['supplies', '补给品'], ['records', '战役记录'],
    ['story', '调查纪事'],
  ]
  const TAB_ICONS = { departure: 'action', overview: 'clue', scenarios: 'eye', investigators: 'shield',
    deck: 'book', upgrades: 'star', supplies: 'supply', records: 'leaf', story: 'book' }
  // 局外页面的反馈入口：宿主注入 openFeedback 时才出现，旧版大厅下自动隐藏。
  const feedbackEntry = () => typeof openFeedback === 'function'
    ? h('button', { className: 'bg-btn secondary ah-feedback-entry', title: '反馈', 'aria-label': '反馈',
      onclick: () => openFeedback() }, '💬 反馈')
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
  const nameOf = (g, code) => state.session?.state.cards?.[code]?.name || g.clientData?.deckBuilder?.cardPool.find(card => card.code === code)?.name || '调查卡牌'
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
    const name = player?.name || `玩家 ${seat + 1}`, avatar = player?.avatar || '👤'
    return h('span', { className: 'ah-office-player', 'data-player-seat': seat },
      h('span', { className: 'ah-office-player-avatar', 'aria-hidden': 'true' }, /^(data:image\/|blob:|https?:\/\/|\/)/i.test(avatar)
        ? h('img', { src: avatar, alt: '' }) : avatar), h('span', {}, name))
  }
  const recordDeckReady = record => record?.status === 'active' && record.startingDeckReady !== false
    && (record.deckSize ?? record.deck?.length ?? 0) > 0
  const seatPrepared = (s, inv) => {
    const record = s.state.campaign.investigators[inv.seat]
    // Teammates expose only deckSize; their private deck must stay hidden.
    return !!s.state.hubSeatDone?.[inv.seat] && recordDeckReady(record) && !record.upgradeDraft
  }
  const canDepart = s => s.state.uiState === 'scenarioSetup' && s.state.hubReady && !s.state.pendingChoice
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
    return h('section', { className: 'ah-hub-interlude' + (compact ? ' is-compact' : ''), 'aria-label': '幕间纪事' },
      h('small', {}, '幕间纪事'),
      h('h2', {}, entry.title),
      ...(entry.paragraphs || []).map(paragraph =>
        h('p', { className: 'ah-hub-interlude-prose' }, renderRulesText(h, paragraph, { links: false }))))
  }
  const metric = (icon, value, label) => h('span', { className: 'ah-office-metric', title: label }, tableIcon(icon), h('b', {}, String(value ?? 0)), h('small', {}, label))
  const investigatorInfo = inv => {
    const optionText = option => {
      const factions = option.factions || option.faction || []
      const classes = factions.length ? factions.map(klass => CLASSES[klass] || klass).join('、') : '任意职业'
      const level = option.level || { min: 0, max: 0 }
      return `${classes} ${level.min ?? 0}–${level.max ?? 0} 级${option.limit ? `（最多 ${option.limit} 张）` : ''}`
    }
    const signatureLinks = cards => cards.flatMap((card, index) => [
      index ? '、' : null,
      h('button', {
        type: 'button',
        className: 'ah-investigator-signature-link',
        'aria-label': `查看卡牌详情：${card.name}`,
        onclick: () => inspectCard(card.code),
      }, card.name),
    ])
    const signatures = [...(inv.signatureCards || []), ...(inv.signatureWeaknesses || [])]
    return h('div', { className: 'ah-investigator-info' },
    h('div', { className: 'ah-investigator-vitals', 'aria-label': '生命与理智' },
      metric('health', inv.health, '生命'), metric('sanity', inv.sanity, '理智'),
      inv.traits?.length ? h('span', { className: 'ah-investigator-traits' }, inv.traits.join(' · ')) : null),
    inv.abilityText ? h('section', { className: 'ah-investigator-rules' }, h('h3', {}, '调查员能力'),
      h('p', {}, renderRulesText(h, inv.abilityText))) : null,
    inv.rules ? h('details', { className: 'ah-investigator-disclosure' }, h('summary', {}, '查看构筑规则'),
      h('p', {}, `牌库：${inv.deckSize || inv.rules.size || 30} 张普通卡。`),
      ...(inv.rules.options || []).map(option => h('p', {}, optionText(option))),
      signatures.length ? h('p', {}, '专属卡牌：', signatureLinks(signatures), '。另加入 1 张随机基础弱点。') : null) : null,
    inv.code ? h('button', { className: 'ah-investigator-dossier-link', onclick: () => inspectCard(inv.code) },
      tableIcon('book'), '查看完整人物档案') : null)
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
    className: 'ah-office-teammate', onclick: () => changeTab('investigators'), 'aria-label': `查看调查员：${inv.name}`,
  }, portrait(inv), h('span', {}, h('strong', {}, inv.name), playerBadge(s, inv.seat)))))

  async function loadSaves() {
    state.arkhamSaves = null
    render()
    try {
      const response = await api('GET', '/sessions')
      state.arkhamSaves = response.sessions.filter(item => item.modId === 'arkhamhorror')
      state.arkhamPersist = response.persist
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
    loadSaves()
  }

  function select(options, value, onChange, attrs = {}) {
    return h('select', { value: String(value), ...attrs, onchange: event => onChange(event.target.value) },
      options.map(option => h('option', { value: String(option.value), selected: String(option.value) === String(value) }, option.label)))
  }

  const cardPoolLabel = scope => CARD_POOL_SCOPE_LABELS[normalizeCardPoolScope(scope)]
  const rollbackLabel = value => value === 'off' ? '禁止' : '允许'

  function renderAiDialogueSettings(g) {
    const values = [
      ['剧情', state.setup.form.aiStoryAwareness === 'on' ? '开' : '关'],
      ['日常', state.setup.form.aiRoutineSpeechFrequency],
      ['自身检定', state.setup.form.aiSelfTestSpeechFrequency],
      ['他人检定', state.setup.form.aiOtherTestSpeechFrequency],
      ['击败敌人', state.setup.form.aiEnemyDefeatSpeechFrequency],
    ].map(([label, value]) => `${label} ${value}${typeof value === 'number' ? '%' : ''}`).join(' · ')
    return h('section', { className: 'ah-ai-dialogue-settings' },
      h('span', {}, h('strong', {}, 'AI 高级设置'), h('small', {}, values)),
      h('button', { type: 'button', className: 'bg-btn secondary',
        onclick: () => { state.arkhamAiSettingsOpen = true; render() } }, '修改 AI 高级设置'))
  }

  // 「游戏高级设置」与 AI 高级设置并列，都只在开局界面出现；值写进开局表单，
  // 由大厅 startGame 一并提交，服务端再落到 state（随存档保留）。
  function renderGameSettings() {
    const values = [
      `卡牌范围 ${cardPoolLabel(state.setup.form.cardPoolScope)}`,
      `回档 ${rollbackLabel(state.setup.form.allowRollback)}`,
    ].join(' · ')
    return h('section', { className: 'ah-ai-dialogue-settings' },
      h('span', {}, h('strong', {}, '游戏高级设置'), h('small', {}, values)),
      h('button', { type: 'button', className: 'bg-btn secondary',
        onclick: () => { state.arkhamGameSettingsOpen = true; render() } }, '修改游戏高级设置'))
  }

  function renderGameSettingsModal(g) {
    if (!state.arkhamGameSettingsOpen) return null
    const spec = key => g.settingsSpec.find(item => item.key === key)
    const scope = spec('cardPoolScope'), rollback = spec('allowRollback')
    const close = () => { state.arkhamGameSettingsOpen = false; render() }
    return h('div', { className: 'ah-ai-dialogue-backdrop', onclick: event => { if (event.target === event.currentTarget) close() } },
      h('section', { className: 'ah-ai-dialogue-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '游戏高级设置',
        onkeydown: modalKeys(close), onclick: event => event.stopPropagation() },
        h('header', {}, h('div', {}, h('small', {}, 'ARKHAM HORROR'), h('h2', {}, '游戏高级设置')),
          h('button', { type: 'button', className: 'bg-btn secondary', onclick: close, 'aria-label': '关闭游戏高级设置' }, '关闭')),
        h('p', {}, '这些选项在开局后固定，并随存档保留。'),
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, scope.label),
          h('div', { className: 'ah-game-settings-select' },
            h('span', {}, '可用卡牌'),
            select(scope.options, state.setup.form.cardPoolScope, value => { state.setup.form.cardPoolScope = value; render() },
              { 'aria-label': scope.label })),
          h('small', {}, scope.description)),
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, '回档'),
          h('label', { className: 'ah-ai-dialogue-toggle' },
            h('input', { type: 'checkbox', checked: state.setup.form.allowRollback !== 'off', 'aria-label': rollback.label,
              onchange: event => { state.setup.form.allowRollback = event.target.checked ? 'on' : 'off' } }),
            h('span', {}, rollback.label),
            h('small', {}, '默认允许')),
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
    const toggle = (key, hint = '开启后 100% 触发') => {
      const item = spec(key)
      return h('label', { className: 'ah-ai-dialogue-toggle' },
        h('input', { type: 'checkbox', checked: state.setup.form[key] === 'on', 'aria-label': item.label,
          onchange: event => { state.setup.form[key] = event.target.checked ? 'on' : 'off' } }),
        h('span', {}, item.label),
        h('small', {}, hint))
    }
    const close = () => { state.arkhamAiSettingsOpen = false; render() }
    return h('div', { className: 'ah-ai-dialogue-backdrop', onclick: event => { if (event.target === event.currentTarget) close() } },
      h('section', { className: 'ah-ai-dialogue-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'AI 高级设置',
        onkeydown: modalKeys(close), onclick: event => event.stopPropagation() },
        h('header', {}, h('div', {}, h('small', {}, 'ARKHAM HORROR'), h('h2', {}, 'AI 高级设置')),
          h('button', { type: 'button', className: 'bg-btn secondary', onclick: close, 'aria-label': '关闭 AI 高级设置' }, '关闭')),
        h('p', {}, '剧情感知与回应概率都在这里设置。自身指该 AI 操控的调查员，其他角色包括真人与其他 AI。'),
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, '剧情'),
          toggle('aiStoryAwareness', '默认开启'),
          h('small', {}, spec('aiStoryAwareness').description)),
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, '日常事件'),
          range('aiRoutineSpeechFrequency'),
          range('aiEnemyDefeatSpeechFrequency')),
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, '普通检定'),
          range('aiSelfTestSpeechFrequency'),
          range('aiOtherTestSpeechFrequency')),
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, '大成功'),
          h('small', {}, '揭示大成功（古神印记）标记。'),
          range('aiSelfCriticalSuccessSpeechFrequency'),
          range('aiOtherCriticalSuccessSpeechFrequency')),
        h('div', { className: 'ah-ai-dialogue-group' },
          h('h3', {}, '大失败'),
          h('small', {}, '揭示大失败（自动失败）标记。'),
          range('aiSelfCriticalFailureSpeechFrequency'),
          range('aiOtherCriticalFailureSpeechFrequency')),
        h('div', { className: 'ah-ai-dialogue-special', role: 'group', 'aria-label': '必定触发的特殊对话' },
          h('strong', {}, '特殊事件'),
          toggle('aiInvestigatorExitDialogue'),
          toggle('aiScenarioEndDialogue')),
        h('small', {}, '关卡结束回应会读取本次实际到达的完整剧情正文，不会读取其他结局分支。')))
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
      return h('p', { className: 'ah-checkpoint-note', role: 'status' }, '本局已关闭回档：不能从关卡检查点重新开始。')
    }
    if (!checkpoint.available) {
      return h('p', { className: 'ah-checkpoint-note', role: 'status' }, '此关卡的历史开局与当前版本不兼容，无法重新开始。')
    }
    if ((s.mySeat ?? s.observerSeat) !== s.state.campaign.leadSeat) {
      return h('p', { className: 'ah-checkpoint-note', role: 'status' }, '只有当前队长可以从此关创建分支存档。')
    }
    return h('button', {
      type: 'button',
      className: 'bg-btn secondary ah-checkpoint-fork',
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
    }, '从此关重新开始')
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
        'aria-label': '确认重新开始关卡',
        onkeydown: modalKeys(close),
        onclick: event => event.stopPropagation(),
      },
      h('header', {}, h('div', {}, h('small', {}, '创建分支存档'), h('h2', {}, `重新开始「${pending.scenarioName}」？`))),
      h('p', {}, '将恢复这次关卡刚开始时的完整状态，包括手牌、牌序、地图、战役记录、创伤与随机状态。'),
      h('p', {}, '系统会创建一个新的分支存档；当前存档及其后续进度会完整保留。'),
      h('div', { className: 'ah-checkpoint-actions' },
        h('button', { type: 'button', className: 'bg-btn secondary', disabled: state.busy, onclick: close }, '取消'),
        h('button', { type: 'button', className: 'bg-btn', disabled: state.busy, onclick: () => confirmCheckpointFork(s, pending) },
          state.busy ? '正在创建…' : '确认并创建分支'))))
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
  const deckDraftKey = (s, inv) => JSON.stringify([s.sessionId, inv?.code, [...(s.state.campaign.investigators[deckSeat(s)]?.deck || [])].sort()])
  const savedDraft = (s, inv) => (s.state.campaign.investigators[deckSeat(s)]?.deck || []).filter(code => inv?.allowedCards.includes(code))
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
    try { lib.decks = await listLocalDecks(api) } catch (error) { lib.error = '读取卡组库失败：' + String(error?.message || error) }
    lib.loading = false; render()
  }
  async function storeLibraryDeck(inv, draft, overwrite) {
    const lib = deckLibrary()
    if (lib.saving || !inv || !draft.length) return
    lib.saving = true; lib.error = ''; lib.notice = ''; lib.confirmDelete = null; render()
    try {
      const deck = await saveLocalDeck(api, { id: overwrite ? lib.currentId : null, name: lib.name.trim() || `${inv.name}的牌组`,
        investigatorCode: inv.code, codes: draft })
      lib.currentId = deck.id; lib.name = deck.name
      lib.decks = [deck, ...(lib.decks || []).filter(item => item.id !== deck.id)]
      lib.notice = `${overwrite ? '已覆盖' : '已存入'}卡组库：《${deck.name}》· ${draft.length} 张。`
    } catch (error) { lib.error = '保存到卡组库失败：' + String(error?.message || error) }
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
      lib.notice = `已从卡组库删除《${deck.name}》。`
    } catch (error) { lib.error = '删除失败：' + String(error?.message || error) }
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
        ? `存档已修复：${result.changes.join('；')}${result.backup ? `（原档已备份为 ${result.backup}）` : ''}`
        : '存档无需修复。'
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
          title: '规则书', 'aria-label': '规则书', onclick: rulebookOpen }, tableIcon('book'), '规则书') : null,
        h('button', { className: 'bg-btn secondary', onclick: () => { state.setup = null; render() } }, '取消'),
        h('button', { className: 'bg-btn', disabled: state.busy, onclick: startGame }, state.busy ? '创建中…' : '开始新游戏')))
    const saveList = h('div', { className: 'ah-save-list' },
      h('div', { className: 'bg-play-modes', role: 'group', 'aria-label': '存档类型' },
        [['solo', '单人存档'], ['online', '联机存档']].map(([mode, label]) => h('button', { type: 'button', 'aria-pressed': String((state.arkhamSaveMode || 'solo') === mode), onclick: () => { state.arkhamSaveMode = mode; render() } }, label))),
      state.arkhamSaveError ? h('p', { role: 'alert' }, state.arkhamSaveError) : null,
      state.arkhamSaveNotice ? h('p', { role: 'status' }, state.arkhamSaveNotice) : null,
      saves === null ? h('p', {}, '正在读取存档摘要…') : !saves?.length
        ? h('p', {}, state.arkhamPersist === false ? '持久存档未启用。' : '暂无 Arkham 存档。')
        : saves.map(item => h('article', { className: 'ah-save-item', 'data-session-id': item.sessionId },
          h('strong', {}, `${item.online ? '联机' : '单人'} · ${item.campaignName || item.campaignId || '未知战役'}`),
          item.online ? h('p', {}, `${item.humanCount} 个玩家席位 · ${item.aiCount} 个 AI 席位；读档后创建房间等待玩家加入。`) : null,
          h('div', { className: 'ah-save-portraits' }, item.investigators.map(inv => portrait(inv))),
          h('div', {}, `${STAGES[item.uiState] || '调查进行中'} · ${item.playerCount} 人 · ${item.investigators.map(inv => inv.name).join('、')}`),
          h('small', {}, new Date(item.savedAt).toLocaleString()),
          !item.compatible ? h('p', { role: 'status' }, '不可读取：' + item.compatibilityError) : null,
          item.needsMigration ? h('p', { role: 'status' }, `旧版本存档，读取时会自动升级并备份原档（${item.migrationChanges.join('；')}）`) : null,
          h('div', { className: 'ah-save-actions' },
            item.needsMigration ? h('button', { className: 'bg-btn secondary', disabled: state.busy, onclick: () => repairSave(item.sessionId) }, '修复存档') : null,
            h('button', { className: 'bg-btn', disabled: !item.compatible || state.busy, onclick: async () => {
              state.busy = true; render()
              try { await loadSavedSession(item.sessionId, item.mode || (item.online ? 'online' : 'solo')) } catch (error) { state.arkhamSaveError = String(error.message) }
              state.busy = false; render()
            } }, item.online ? '创建房间继续' : '读取此存档'),
            state.arkhamDeleteConfirmId === item.sessionId
              ? h('button', { className: 'bg-btn', onclick: () => deleteSave(item.sessionId) }, '确认删除此存档')
              : h('button', { className: 'bg-btn secondary', onclick: () => { state.arkhamDeleteConfirmId = item.sessionId; render() } }, '删除')))))
    return h('div', { className: 'bg-backdrop' },
      h('div', { className: 'bg-modal ah-hub-setup ah-office ah-theme', ...presentationAttributes({ campaign: { id: state.setup?.form?.campaignId } }), role: 'dialog', 'aria-modal': 'true', 'aria-label': '调查准备设置',
        onkeydown: modalKeys(() => { state.setup = null; render() }), onclick: event => event.stopPropagation() },
        h('div', { className: 'ah-office-entry-art' }, decor('manor'), decor('desk'),
          h('div', { className: 'ah-office-entry-title' }, h('small', {}, 'ARKHAM HORROR'), h('h2', {}, '诡镇奇谈'), h('p', {}, '灯尚未熄灭，调查尚未结束。'))),
        h('div', { className: 'ah-office-entry-controls' },
        h('small', { className: 'ah-office-eyebrow' }, '调查事务所 / 案件档案'),
        h('h2', {}, state.arkhamSetupTab === 'saves' ? '继续调查' : '开启一桩新案'),
        h('div', { className: 'ah-hub-tabs' },
          h('button', { className: state.arkhamSetupTab === 'new' ? 'active' : '', onclick: () => { state.arkhamSetupTab = 'new'; render() } }, '新游戏'),
          h('button', { className: state.arkhamSetupTab === 'saves' ? 'active' : '', onclick: () => { state.arkhamSetupTab = 'saves'; loadSaves() } }, '存档管理')),
        state.arkhamSetupTab === 'saves' ? saveList : newGame,
        state.error ? h('p', { role: 'alert' }, state.error) : null)),
      renderGameSettingsModal(g),
      renderAiDialogueModal(g))
  }

  function action(s, move, label = move.label, className = 'bg-btn') {
    if (state.busy && move.action === 'hubDoneSeat' && state.arkhamHubPending?.sessionId === s.sessionId) label = '正在确认…'
    return h('button', { className, disabled: locked(s), onclick: () => submitMove(move, s) }, renderRulesText(h,label,{links:false}))
  }

  const seatSelected = (s, seat) => !!s.state.hubSeatSelected?.[seat]
    || (!!s.state.campaign.scenarioResults?.length && s.state.campaign.investigators[seat]?.status === 'active')
  const seatTask = (s, seat) => {
    const st = s.state, record = st.campaign.investigators[seat]
    if (st.uiState === 'interlude') {
      if (record?.status !== 'active') return '选择替补调查员'
      if (record.upgradeDraft) return '保存升级方案'
      return '完成升级并确认席位'
    }
    if (!seatSelected(s, seat)) return '选择调查员'
    if (!recordDeckReady(record)) return '保存牌组'
    return '确认准备'
  }
  const preparationMessage = s => {
    const st = s.state, mySeat = s.mySeat ?? 0
    if (st.campaign.leadConfirmed === false && st.hubReady) return mySeat === 0
      ? '全队已就绪，请先确认一名真人玩家担任队长。'
      : '全队已就绪，等待房主确认小队队长。'
    if (st.hubReady) return mySeat === 0
      ? '全队已就绪。你是房主，现在可以开始关卡。'
      : '全队已就绪，等待房主开始关卡；你无需继续操作。'
    if (['scenarioSetup', 'interlude'].includes(st.uiState)) {
      const others = actingSeats(s).filter(seat => seat !== mySeat)
        .map(seat => s.players.find(item => item.seat === seat)?.name || `玩家 ${seat + 1}`)
      if (acting(s, mySeat)) return `请${seatTask(s, mySeat)}。` + (others.length ? `${others.join('、')}正在同时准备。` : '')
      return `你的席位已确认，等待${others.join('、') || '队友'}完成准备；你现在无需操作。`
    }
    return st.hubSelectedScenarioId ? '案件已选定，下一步是选择调查员。' : '请先选择开场案件。'
  }

  function workflowGuide(s, activeTab) {
    const st = s.state, mySeat = s.mySeat ?? 0, record = st.campaign.investigators[mySeat]
    let steps, primary = null, message = preparationMessage(s)
    if (st.uiState === 'scenarioResult') {
      steps = [['查看关卡结算', false], ['进入关间升级', false], ['确认下一关准备', false], ['开始下一关', false]]
      const move = legal(s, 'hubContinue')[0]
      if (move) primary = action(s, move, '查看结算，进入关间准备')
    } else if (st.uiState === 'interlude') {
      const upgraded = !!st.hubUpgradedSeats?.[mySeat]
        || record?.purchases?.some(item => item.scenarioIndex === st.campaign.scenarioIndex)
      steps = [['可选：升级牌组', upgraded], ['保存升级方案', upgraded && !record?.upgradeDraft],
        ['确认席位', !!st.hubSeatDone?.[mySeat]], ['开始下一关', false]]
      if (acting(s, mySeat)) {
        const confirm = legal(s, 'hubConfirmUpgrades')[0], done = legal(s, 'hubDoneSeat')[0]
        if (confirm) primary = action(s, confirm, '保存升级方案')
        else if (done) primary = action(s, done, upgraded ? '完成升级，准备下一关' : '保留经验，准备下一关')
        else primary = h('button', { className: 'bg-btn', onclick: () => changeTab(record?.status === 'active' ? 'upgrades' : 'investigators') },
          record?.status === 'active' ? '查看升级选项' : '选择替补调查员')
      }
    } else if (['campaignHub', 'scenarioSetup'].includes(st.uiState)) {
      const selected = seatSelected(s, mySeat), deckReady = recordDeckReady(record), ready = !!st.hubSeatDone?.[mySeat]
      const scenarioReady = !!st.hubSelectedScenarioId
      steps = [['选择案件', scenarioReady], ['选择调查员', selected], ['保存牌组', deckReady], ['确认准备', ready], ['开始关卡', false]]
      if (st.uiState === 'campaignHub') {
        const setup = legal(s, 'hubGoSetup')[0]
        primary = !scenarioReady
          ? h('button', { className: 'bg-btn', onclick: () => changeTab('scenarios') }, '选择开场案件')
          : setup ? action(s, setup, '选择调查员') : null
      } else if (st.hubReady) {
        const begin = legal(s, 'hubBeginScenario')[0]
        if (begin) primary = action(s, begin, '开始当前关卡')
      } else if (acting(s, mySeat)) {
        if (!selected) primary = h('button', { className: 'bg-btn', onclick: () => changeTab('investigators') }, '选择调查员')
        else if (!deckReady) primary = h('button', { className: 'bg-btn', onclick: () => changeTab('deck') }, '保存牌组')
        else {
          const done = legal(s, 'hubDoneSeat')[0]
          if (done) primary = action(s, done, '确认准备')
        }
      }
    } else if (st.uiState === 'campaignResult') {
      steps = [['战役已完成', true]]
      message = '战役已经结束，记录与调查纪事仍可随时查看。'
    } else return null
    if ((st.uiState === 'scenarioResult' && activeTab === 'story')
      || (st.uiState === 'scenarioSetup' && ['investigators', 'deck', 'departure'].includes(activeTab))
      || (st.uiState === 'interlude' && ['investigators', 'upgrades'].includes(activeTab))) primary = null
    const current = Math.max(0, steps.findIndex(([, done]) => !done))
    return h('section', { className: 'ah-workflow-guide', 'aria-label': '当前准备步骤' },
      h('ol', {}, steps.map(([label, done], index) => h('li', {
        className: done ? 'is-done' : index === current ? 'is-current' : '',
        'aria-current': index === current ? 'step' : null,
      }, h('span', {}, done ? '✓' : index + 1), h('b', {}, label)))),
      h('div', { className: 'ah-workflow-next', role: 'status' },
        h('span', {}, h('strong', {}, `当前步骤：${steps[current]?.[0] || '已完成'}`), h('small', {}, message)),
        primary))
  }

  function preparationProgress(s) {
    const pending = state.arkhamHubPending
    if (!pending || pending.sessionId !== s.sessionId) return null
    const st = s.state, confirmed = st.hubSeatDone?.[pending.seat]
    const message = !confirmed ? '正在确认你的席位…' : preparationMessage(s)
    return h('div', { className: 'ah-hub-preparing', role: 'status', 'aria-live': 'polite' },
      tableIcon('action'), h('span', {}, h('strong', {}, message), h('small', {}, '队友准备进度会自动更新，无需重复点击。')))
  }

  function overview(s, g) {
    const cp = s.state.campaign
    const selected = g.clientData?.campaigns?.find(item => item.id === cp.id)
    return h('section', { className: 'ah-hub-pane ah-office-overview' },
      h('div', { className: 'ah-office-hero' }, decor('manor'),
        h('div', { className: 'ah-office-hero-copy' },
          h('small', { className: 'ah-office-eyebrow' }, '战役档案'),
          h('h1', {}, selected?.name || cp.name),
          h('p', {}, '整理线索，召集同伴，踏入未知。'),
          h('div', { className: 'ah-office-metrics' }, metric('shield', s.players.length, '调查员'), metric('star', cp.victory, '胜利点'), metric('book', cp.xp, '未花经验')),
          s.state.uiState === 'campaignHub' ? h('div', { className: 'ah-hub-actions ah-office-difficulty', 'aria-label': '调查难度' },
            legal(s, 'hubSetDifficulty').map(move => h('button', {
              className: 'bg-btn secondary', 'aria-pressed': String(s.state.difficulty === move.difficulty),
              disabled: locked(s), onclick: () => submitMove(move, s),
            }, DIFFICULTIES[move.difficulty] || move.difficulty))) : null,
          h('div', { className: 'ah-office-primary' },
            s.state.uiState === 'scenarioResult' ? h('div', { className: 'ah-office-result' },
              h('h3', {}, '本关结算'), h('p', {}, `${cp.scenarioResults?.length ? resultName(s, cp.scenarioResults.at(-1)) : outcomeName(s.state.resolution)} · 本关胜利点 ${s.state.victory}`),
              legal(s, 'hubContinue').map(move => action(s, move))) : null,
            s.state.uiState === 'campaignResult' ? h('div', { className: 'ah-office-result' }, h('h3', {}, '战役终章'), h('p', {}, outcomeName(cp.result))) : null))),
      h('div', { className: 'ah-office-overview-grid' },
        h('article', { className: 'ah-office-dossier' }, decor('casefile'), h('div', { className: 'ah-office-dossier-copy' },
          h('small', {}, '当前案件'), h('h2', {}, selected?.scenarios?.find(item => item.id === s.state.hubSelectedScenarioId)?.name || '待选择'),
          h('p', {}, `${DIFFICULTIES[s.state.difficulty] || s.state.difficulty} · 已完成 ${cp.scenarioResults.length}/${selected?.scenarios?.length || 0} 个剧本`),
          h('button', { onclick: () => changeTab('scenarios') }, '展开案件路线 →'))),
        h('section', { className: 'ah-office-team-panel' }, h('h3', {}, '调查小队'), team(s))),
      h('details', { className: 'ah-content-packs', 'aria-label': '已注册内容与依赖' },
        h('summary', {}, '内容包与规则范围'),
        h('h3', {}, '已注册内容'),
        h('p', {}, '当前为可玩规则子集；严格规则名称保持关闭，逐卡差异仍在审计。'),
        (selected?.contentPacks || []).map(pack => h('article', { className: 'ah-content-pack', 'data-pack-id': pack.id },
          h('strong', {}, pack.name),
          h('span', { className: 'ah-content-status' }, `${({ playable: '可玩', verified: '已验证', development: '开发中', 'catalog-only': '仅图鉴' })[pack.status]} · ${pack.required ? '战役依赖' : '可选卡包'}`),
          pack.description ? h('p', {}, pack.description) : null,
          pack.cards.map(card => h('div', { className: card.playable ? 'ah-content-ready' : 'ah-content-blocked' },
            `${card.code} · ${card.name} — ${card.playable ? '可构筑' : card.blockedReason || '未开放'}`))))),
      null)
  }

  function scenarios(s, g) {
    const cp = s.state.campaign
    const manifest = g.clientData?.campaigns?.find(item => item.id === cp.id)
    const list = manifest?.scenarios || []
    return h('section', { className: 'ah-hub-pane ah-office-routes' }, h('h2', {}, '关卡选择'),
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
            h('span', {}, tableIcon(completed ? 'star' : available ? 'clue' : 'lock'), completed ? '已完成' : selected ? '已选择' : available ? '可选择' : '未解锁')),
          h('div', { className: 'ah-office-case-action' },
            move ? action(s, move, selected ? '已选择' : '选择此关') : null))
      })))
  }

  function departure(s, g) {
    const st = s.state, ready = canDepart(s)
    const manifest = g.clientData?.campaigns?.find(item => item.id === st.campaign.id)
    const scenario = manifest?.scenarios?.find(item => item.id === st.hubSelectedScenarioId)
    const count = st.investigators.filter(inv => seatPrepared(s, inv)).length
    const hint = preparationMessage(s)
    return h('section', { className: 'ah-hub-pane ah-office-departure', 'aria-label': '出发准备' },
      h('div', { className: 'ah-departure-heading' }, decor('scene', '', st.hubSelectedScenarioId), h('div', {},
        h('small', { className: 'ah-office-eyebrow' }, '出发准备'), h('h2', {}, scenario?.name || '下一场调查'),
        h('p', {}, `${DIFFICULTIES[st.difficulty] || st.difficulty} · ${count}/${st.investigators.length} 席位已准备`),
        h('p', { id: 'ah-departure-hint', role: 'status' }, hint),
        h('button', {className:'bg-btn secondary',onclick:()=>changeTab('story')}, '阅读本关导入'),
        h('button', { className: 'bg-btn ah-departure-start', disabled: !ready || locked(s) || !!s.saveError || !!s.saveDetached,
          'aria-describedby': 'ah-departure-hint', onclick: () => { if (canDepart(s) && !state.busy && !s.saveError && !s.saveDetached) submitMove(legal(s, 'hubBeginScenario')[0], s) } }, '开始当前关卡'),
        legal(s, 'hubReopenSetup').map(move => action(s, move, '重新准备调查员与牌组')),
        legal(s, 'hubGoSetup').map(move => action(s, move)))),
      h('section', { className: 'ah-leader-picker', 'aria-label': '选择队长' },
        h('div', {}, h('strong', {}, '小队队长'), h('small', {}, '由真人玩家担任，猎物并列和剧情分歧时由队长决定')),
        s.players.filter(p => p.role === 'human').map(player => {
          const inv = st.investigators.find(i => i.seat === player.seat)
          const chosen = st.campaign.leadSeat === player.seat && st.campaign.leadConfirmed !== false
          const move = legal(s, 'hubSetLeader').find(m => m.leadSeat === player.seat)
          return h('button', { className: 'ah-leader-candidate' + (chosen ? ' is-selected' : ''),
            'aria-pressed': String(chosen), disabled: !move || locked(s),
            onclick: () => { if (move && !state.busy) submitMove(move, s) } },
            portrait(inv), h('span', {}, h('strong', {}, inv.name), playerBadge(s, player.seat)), h('b', {}, chosen ? '队长' : '设为队长'))
        })),
      h('div', { className: 'ah-departure-team' }, st.investigators.map(inv => {
        const record = st.campaign.investigators[inv.seat]
        const selected = !!st.hubSeatSelected?.[inv.seat] || record?.status === 'active'
        const deckReady = recordDeckReady(record) && !record.upgradeDraft
        return h('article', { className: 'ah-departure-member' + (seatPrepared(s, inv) ? ' is-ready' : ''), 'data-seat': inv.seat },
          h('div', { className: 'ah-departure-identity' }, portrait(inv), h('div', {}, h('h3', {}, inv.name), playerBadge(s, inv.seat))),
          h('ul', { className: 'ah-departure-checks' }, [[selected, '调查员已选定'], [deckReady, '合法牌组已保存'], [seatPrepared(s, inv), '席位已确认']].map(([done, label]) =>
            h('li', { className: done ? 'is-done' : '' }, h('span', { 'aria-hidden': 'true' }, done ? '✓' : '○'), label))),
          !seatPrepared(s, inv) && ['scenarioSetup', 'interlude'].includes(st.uiState) ? h('button', { className: 'bg-btn secondary', onclick: () => changeTab(st.uiState === 'interlude' && record?.status === 'active' ? 'upgrades' : 'investigators') }, inv.seat === (s.mySeat ?? 0) && acting(s, inv.seat) ? '继续准备' : '查看准备') : null)
      })))
  }

  function investigators(s, g) {
    const st = s.state
    const builderInvestigators = g.clientData?.deckBuilder?.investigators || []
    const selectedClass = state.arkhamInvestigatorClass || 'all'
    const moves = legal(s, 'hubSelectInvestigator')
    const packOf = ({ investigator }) => investigator.pack || 'core'
    const candidates = moves.map(move => ({ move, investigator: builderInvestigators.find(item => item.code === move.code)
      || { code: move.code, name: move.label.replace('选择调查员：', ''), pack: 'core' } }))
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
    const packOptions = [['all', '所有扩展包'], ...packs.map(pack => [pack, `${packName(pack)}（${counts[pack]}）`])]
    const groups = Object.entries(classCandidates
      .filter(item => selectedPack === 'all' || packOf(item) === selectedPack)
      .reduce((result, item) => {
        const pack = packOf(item)
        ;(result[pack] ||= []).push(item)
        return result
      }, {}))
    return h('section', { className: 'ah-hub-pane ah-office-investigators' }, h('h2', {}, '调查员与席位'),
      st.investigators.map(inv => {
        const record = st.campaign.investigators[inv.seat]
        const active = acting(s, inv.seat) && !st.hubReady
        const selected = seatSelected(s, inv.seat)
        const detail = builderInvestigators.find(item => item.code === inv.code) || inv
        return h('article', { className: 'ah-hub-seat ah-office-investigator' + (active ? ' active' : '') },
          portrait(inv), h('div', { className: 'ah-office-investigator-copy' },
          h('small', { className: 'ah-office-eyebrow' }, `${CLASSES[inv.klass] || inv.klass} · ${packLabel(detail.pack, detail.packName)} / 席位 0${inv.seat + 1}`),
          playerBadge(s, inv.seat),
          h('h2', {}, inv.name), detail.subname ? h('p', { className: 'ah-investigator-subname' }, detail.subname) : null,
          h('div', { className: 'ah-office-metrics' }, metric('sword', inv.combat, '战斗'), metric('book', inv.intellect, '智识'), metric('star', inv.willpower, '意志'), metric('leaf', inv.agility, '敏捷')),
          investigatorInfo(detail),
          !selected && !st.campaign.scenarioResults.length
            ? h('p', { className: 'ah-investigator-selection-state', role: 'status' }, '还没有选择调查员。点击一位候选人后才能组牌。')
            : h('p', { className: 'ah-investigator-selection-state is-selected', role: 'status' }, '调查员已选择'),
          h('p', {}, recordDeckReady(record) ? `牌组 ${record.deckSize ?? record.deck?.length ?? 0} 张 · ${record.xp} XP` : '牌组尚未保存'),
          active && inv.seat === (s.mySeat ?? 0) && moves.length && !st.campaign.scenarioResults.length
            ? h('p', { className: 'ah-investigator-reselect-note', role: 'note' }, '首关开始前可以更换调查员或重新组牌；已经生成的随机基础弱点会保留。') : null,
          // After the first scenario a living campaign investigator is locked in.
          active && inv.seat === (s.mySeat ?? 0) && !moves.length && record?.status === 'active' && (st.uiState === 'interlude' || st.campaign.scenarioResults?.length)
            ? h('p', { className: 'ah-office-empty ah-investigator-locked', role: 'status' }, tableIcon('lock'), '调查员已锁定：关间不能更换仍在战役中的调查员，只有死亡或疯狂后才能挑选替补。') : null,
          active && inv.seat === (s.mySeat ?? 0) && moves.length ? h('div', { className: 'ah-investigator-browser' },
            h('div', { className: 'ah-investigator-browser-head' }, h('div', {},
              h('h3', {}, record && record.status !== 'active' ? `${record.status === 'insane' ? '已疯狂' : '已死亡'}，请挑选替补调查员` : '选择调查员'),
              h('p', {}, record && record.status !== 'active' ? '替补以全新 0 XP 牌组加入，不继承旧人物的创伤与卡牌。' : '按职业与扩展包筛选，再挑选一位调查员。')),
              h('div', { className: 'ah-investigator-filter-bar' },
                h('label', { className: 'ah-investigator-pack-filter' }, '扩展包',
                  h('select', { 'aria-label': '筛选扩展包', 'data-focus-key': 'investigator:pack',
                    onchange: event => { state.arkhamInvestigatorPack = event.target.value; render() },
                  }, packOptions.map(([value, label]) => h('option', { value, selected: value === selectedPack }, label)))),
                h('div', { className: 'ah-investigator-class-filters', 'aria-label': '按职业颜色筛选调查员' },
                  [['all', '全部'], ...Object.entries(CLASSES).filter(([key]) => key !== 'neutral')].map(([key, label]) => h('button', {
                    className: `ah-investigator-class-filter is-${key}`, 'aria-pressed': String(selectedClass === key),
                    onclick: () => { state.arkhamInvestigatorClass = key; render() },
                  }, key === 'all' ? null : tableIcon(classIcon(key)), label))))),
            groups.length ? groups.map(([pack, entries]) => h('section', { className: 'ah-investigator-pack', 'data-pack': pack },
              h('header', {}, h('h4', {}, packName(pack)), h('small', {}, `${entries.length} 位调查员`)),
              h('div', { className: 'ah-office-roster' }, entries.map(({ move, investigator: candidate }) =>
                h('button', { className: `ah-office-candidate is-${candidate.klass || 'neutral'}`, 'data-class': candidate.klass || 'neutral',
                  'aria-label': `${move.label}；${CLASSES[candidate.klass] || candidate.klass || ''}；${packName(pack)}`,
                  'aria-pressed': String(selected && inv.code === move.code), disabled: locked(s), onclick: () => submitMove(move, s) },
                portrait(candidate), h('span', {}, candidate.name), h('small', {}, CLASSES[candidate.klass] || candidate.klass || '调查员'))))))
              : h('p', { className: 'ah-office-empty' }, '当前筛选下没有可选调查员')) : null,
          active && inv.seat === (s.mySeat ?? 0) ? h('div', { className: 'ah-hub-actions' },
            legal(s, 'hubAutoDeck').map(move => action(s, move)),
            selected ? h('button', { className: 'bg-btn secondary', onclick: () => changeTab('deck') }, recordDeckReady(record) ? '查看与编辑卡组' : '前往卡组构筑') : null,
            legal(s, 'hubDoneSeat').map(move => action(s, move, '确认准备'))) : null))
      }))
  }

  function deck(s, g) {
    const record = s.state.campaign.investigators[s.mySeat ?? 0]
    const canEdit = legal(s, 'hubSetDeck').length > 0
    const saved = recordDeckReady(record)
    const inv = deckInvestigator(s, g)
    const draft = state.arkhamDeckDraftKey === deckDraftKey(s, inv) ? state.arkhamDeckDraft || [] : null
    const unsavedDraft = canEdit && draft && !sameCards(draft, savedDraft(s, inv))
    const editButton = () => canEdit ? h('button', { className: 'bg-btn', 'data-hub-action': 'edit-deck', disabled: locked(s), onclick: () => openDeck(s, g) },
      unsavedDraft ? `手动构筑：继续编辑草稿，已有 ${draft.length} 张` : saved ? '手动构筑：编辑已保存牌组' : `手动构筑 ${inv?.deckSize || 30} 张普通卡`) : null
    const importButton = () => canEdit ? h('button', { className: 'bg-btn secondary', 'data-hub-action': 'import-deck', disabled: locked(s),
      onclick: () => openDeck(s, g, { importing: true }) }, tableIcon('book'), '从 ArkhamDB 导入') : null
    const libraryButton = () => canEdit ? h('button', { className: 'bg-btn secondary', 'data-hub-action': 'deck-library', disabled: locked(s),
      onclick: () => openDeck(s, g, { library: true }) }, tableIcon('book'), '本地卡组库') : null
    return h('section', { className: 'ah-hub-pane' }, h('h2', {}, '卡组构筑'),
      h('div', { className: 'ah-office-deck-heading' }, portrait(s.state.investigators[s.mySeat ?? 0]), h('div', {},
        h('h3', {}, s.state.investigators[s.mySeat ?? 0].name),
        saved ? h('p', {className:'ah-deck-save-status',role:'status'}, tableIcon('book'), `已保存 · ${record.deck.length} 张`, s.state.investigators[s.mySeat ?? 0].autoBuilt ? ' · 自动构筑' : '') : null)),
      saved && legal(s, 'hubDoneSeat').length ? h('section', { className: 'ah-deck-next-action', role: 'status' },
        h('div', {}, h('strong', {}, '牌组已保存'), h('small', {}, '下一步确认准备；首关开始前仍可继续编辑，基础弱点不会重抽。')),
        action(s, legal(s, 'hubDoneSeat')[0], '确认准备'),
        h('button', { className: 'bg-btn secondary', disabled: !canEdit || locked(s), onclick: () => openDeck(s, g) }, '继续编辑')) : null,
      h('div',{className:'ah-deck-toolbar'},editButton(),importButton(),libraryButton(),legal(s, 'hubAutoDeck').map(move => action(s, move)),
        h('small',{},unsavedDraft ? '有尚未保存的草稿，打开构筑界面继续调整后保存。' : saved ? canEdit ? '可继续调整普通卡；签名卡与弱点保持不变。' : '点击卡牌查看详情。'
          : canEdit ? '可自动构筑、手动挑选、从本地卡组库载入，或导入 ArkhamDB 牌组。导入的卡牌必须全部已实现。' : '先选择调查员，再自动或手动构筑牌组。')),
      saved ? h('div', { className: 'ah-office-deck-gallery', 'aria-label':'已保存牌组预览' }, [...new Set(record.deck)].map(code => {
        const card = s.state.cards?.[code] || g.clientData?.deckBuilder?.cardPool.find(c=>c.code===code) || {}
        const klass = String(card.klass || 'neutral').toLowerCase()
        const type = ({asset:['supply','资产'],event:['action','事件'],skill:['star','技能'],treachery:['doom','诡计'],enemy:['sword','敌人']})[card.type] || ['book','卡牌']
        return h('button', {className:'ah-deck-inspect',onclick:()=>inspectCard(code),'aria-label':'查看卡牌：'+nameOf(g,code),'data-deck-code':code,'data-zoom-code':code,'data-zoom-name':nameOf(g,code)},
          art(code,nameOf(g,code)),h('span',{className:'ah-deck-copy-count'},`×${record.deck.filter(c=>c===code).length}`),
          h('strong',{className:'ah-deck-card-name'},nameOf(g,code)),
          h('span',{className:'ah-deck-card-icons'},
            h('span',{title:CLASSES[klass] || klass,'aria-label':CLASSES[klass] || klass},tableIcon(classIcon(klass))),
            h('span',{title:type[1],'aria-label':type[1]},tableIcon(type[0])),
            card.cost != null ? h('span',{title:`费用 ${card.cost}`,'aria-label':`费用 ${card.cost}`},tableIcon('resource'),String(card.cost)) : null))
      })) : h('div', { className: 'ah-office-empty' }, tableIcon('book'), h('p', {}, '一副牌组，是调查的起点。')))
  }

  function upgrades(s, g) {
    const st = s.state
    const name = code => code ? st.cards?.[code]?.name || nameOf(g, code) : '无需替换'
    const card = code => code ? { ...g.clientData?.deckBuilder?.cardPool.find(item => item.code === code), ...st.cards?.[code] } : null
    const cardDescription = code => {
      const detail = card(code)
      if (!detail) return h('p', { className: 'ah-upgrade-card-description' }, '不移除现有卡牌，直接加入牌组。')
      const traits = (detail.traitsZh?.length ? detail.traitsZh : detail.traits || []).join(' · ')
      return h('div', { className: 'ah-upgrade-card-description' },
        traits ? h('small', {}, traits) : null,
        h('p', {}, renderRulesText(h, detail.textZh || detail.abilityTextZh || detail.text || detail.abilityText || '此卡没有额外规则文字。')))
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
      type: 'button', className: 'ah-upgrade-card-art', 'aria-label': `查看卡牌详情：${name(code)}`,
      'data-zoom-code': code, 'data-zoom-name': name(code), onclick: () => inspectCard(code),
    }, art(code, name(code)))
    return h('section', { className: 'ah-hub-pane' }, h('h2', {}, '升级与关间准备'),
      st.uiState !== 'interlude' ? h('p', {}, '仅在关间开放升级。') : null,
      st.investigators.map(inv => h('article', { className: 'ah-hub-seat ah-office-upgrade-seat' },
        h('div', { className: 'ah-office-deck-heading' }, portrait(inv), h('strong', {}, `${inv.name} · ${st.campaign.investigators[inv.seat]?.xp || 0} XP`)),
        st.campaign.investigators[inv.seat]?.upgradeAdvice ? h('p', {}, st.campaign.investigators[inv.seat].upgradeAdvice.reason) : null,
        acting(s, inv.seat) && inv.seat === (s.mySeat ?? 0) && s.players[inv.seat]?.role === 'human'
          ? h('div', { className: 'ah-hub-actions' },
            h('section', {className:'ah-upgrade-library'},
            h('h3', {}, '① 选择新卡'), filterControls('upgrade', pool, shown),
            shown.length ? h('div', { className: 'ah-office-upgrade-gallery', 'data-scroll-context': JSON.stringify([inv.seat,cardFilters('upgrade')]), 'aria-label': '选择要购入的卡牌' }, shown.map(({code}) => h('button', {
              'data-focus-key': 'upgrade:' + code, 'data-zoom-code': code, 'data-zoom-name': name(code),
              'aria-label': `查看升级：${name(code)}`, 'aria-pressed': String(state.arkhamUpgradeSelected === code),
              onclick: () => { state.arkhamUpgradeSelected = code; state.arkhamUpgradeNotice = null; render() },
            }, art(code, name(code)), h('span', {}, name(code))))) : h('p', {className:'ah-office-empty'}, additions.length ? '没有符合筛选条件的卡牌，请调整或清除筛选。' : '当前没有可支付的合法升级，可以保留经验。')),
            selected ? h('section', {className:'ah-upgrade-workbench'},
              h('h3', {}, '② 选择替换卡'),
              h('div', { className:'ah-office-upgrade-options', 'data-scroll-context': `${inv.seat}:${state.arkhamUpgradeSelected}`, 'aria-label':'选择替换方案' },
                options.filter(move => move.removed == null).map(move => h('button', {
                  type: 'button', className: 'ah-upgrade-replacement',
                  'data-focus-key': 'replace:null', 'aria-pressed': String(move === selected),
                  onclick: () => { state.arkhamUpgradeRemoved = move.removed; state.arkhamUpgradeNotice = null; render() },
                }, name(move.removed))),
                deckCodes.map(code => {
                  const move = options.find(item => item.removed === code)
                  const reason = move ? null : blockedReason.get(code) || '当前升级方案不能替换这张卡。'
                  return h('button', {
                    type: 'button', className: 'ah-upgrade-replacement' + (move ? '' : ' is-locked'),
                    'data-focus-key': 'replace:' + code, 'data-zoom-code': code, 'data-zoom-name': name(code),
                    'aria-pressed': String(!!move && move === selected),
                    'aria-disabled': move ? null : 'true',
                    // 置灰卡不写死文字标签：悬浮（title）或点按才说明为什么不能替换。
                    // 原生 title 需要按钮保持可用状态，所以用 aria-disabled 表达不可选。
                    title: move ? `替换「${name(code)}」` : reason,
                    'aria-label': move ? `替换 ${name(code)}` : `${name(code)}：${reason}`,
                    onclick: () => {
                      if (move) { state.arkhamUpgradeRemoved = move.removed; state.arkhamUpgradeNotice = null }
                      else state.arkhamUpgradeNotice = code
                      render()
                    },
                  }, h('span', {}, name(code)), deckCount(code) > 1 ? h('i', {}, `×${deckCount(code)}`) : null)
                })),
              h('p', { className: 'ah-upgrade-replacement-note' },
                '牌组里的每张卡都列在这里；灰色的卡本次不能选中，悬停或点按可查看原因。'),
              blockedNotice ? h('p', { className: 'ah-upgrade-blocked-note', role: 'status' }, tableIcon('lock'),
                `${name(state.arkhamUpgradeNotice)}：${blockedNotice}`) : null,
              h('div', {className:'ah-upgrade-comparison'},
                h('div',{}, selected.removed?inspectArt(selected.removed):h('span',{},'额外加入'),h('strong',{},name(selected.removed)),
                  cardDescription(selected.removed)),
                h('div',{className:'ah-upgrade-cost'},tableIcon('action'),h('b',{},`${cost} XP`),h('small',{},`暂存后剩余 ${(st.campaign.investigators[inv.seat]?.upgradeDraft?.record?.xp ?? st.campaign.investigators[inv.seat]?.xp ?? 0)-cost} XP`)),
                h('div',{},inspectArt(selected.added),h('strong',{},name(selected.added)),
                  cardDescription(selected.added))),
              h('p',{},selected.explanation),action(s,selected,`加入升级方案，花费 ${cost} XP`)):null,
            draft ? h('div', { className: 'ah-upgrade-preview' },
              h('h3', {}, '③ 核对升级方案'),h('strong', {}, `已加入 ${draft.changes.length} 次升级 · 剩余 ${draft.record.xp} XP`),
              draft.changes.map(change => h('p', {}, `${name(change.removed)} → ${name(change.added)} · ${change.cost} XP`))) : null,
            h('section', { className: 'ah-upgrade-actions', 'aria-label': '升级操作' },
              h('div', {},
                h('strong', {}, draft ? '升级方案尚未保存' : upgraded ? '本轮升级已保存' : '不进行升级'),
                h('small', {}, draft ? '保存后仍可继续进入下一关准备。'
                  : upgraded ? '牌组和剩余经验已经更新，可以结束本轮升级。'
                    : `保留当前 ${record?.xp || 0} XP，直接进入下一关准备。`)),
              draft ? h('div', {},
                legal(s, 'hubCancelUpgrades').map(move => action(s, move, '撤销所有更改', 'bg-btn secondary')),
                legal(s, 'hubConfirmUpgrades').map(move => action(s, move, '保存升级方案')))
                : h('div', {}, legal(s, 'hubDoneSeat').map(move => action(s, move,
                  upgraded ? '完成升级，准备下一关' : `保留 ${record?.xp || 0} XP 并继续`,
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
      h('small', { className: 'ah-office-eyebrow' }, '远征装备'),
      h('h2', {}, '补给品'),
      h('p', { className: 'ah-supply-note' },
        '补给品属于调查员个人；配给、药品与汽油可以重复携带。地点与诡计的「检查你们的补给品」核对同一地点的全队清单：任意一人持有即算通过。'),
      leader ? h('p', { className: 'ah-supply-leader' }, tableIcon('supply'), `远征求领队：${leader.name}`) : null,
      !hasSupply && !s.state.investigators.some(inv => Number.isFinite(points[inv.seat]))
        ? h('div', { className: 'ah-office-empty' }, tableIcon('supply'), h('p', {}, '序幕尚未购买补给品')) : null,
      s.state.investigators.map(inv => {
        const list = cp.supplies?.[inv.seat] || []
        const remaining = points[inv.seat]
        return h('article', { className: 'ah-supply-card', 'data-supply-seat': inv.seat },
          h('div', { className: 'ah-supply-head' }, h('strong', {}, inv.name),
            Number.isFinite(remaining) && remaining > 0
              ? h('span', { className: 'ah-supply-points' }, `剩余补给品点数 ${remaining}`) : null),
          list.length
            ? h('ul', { className: 'ah-supply-list' }, grouped(list).map(([name, count]) =>
              h('li', {}, `${label(name)}${count > 1 ? ` ×${count}` : ''}`)))
            : h('p', {}, '尚未携带补给品。'))
      }))
  }

  // 待决的战役选择。补给选购走卡牌面板（完成按钮在独立的完成栏）；
  // 其余选择（领队、幕间核对、补给点治疗）仍保持一列按钮。
  function pendingChoicePane(s) {
    const market = supplyPickerModel(s)
    if (market) return h('div', { className: 'ah-hub-pane ah-hub-supply-market' },
      interludeBriefing(s, true),
      renderSupplyPicker(h, market, {
        disabled: locked(s), busy: state.busy,
        onSubmit: move => { if (move && !state.busy) submitMove(move, s) },
      }))
    return h('section', { className: 'ah-hub-pane', role: 'dialog', 'aria-label': '战役选择' },
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
    return h('section', { className: 'ah-hub-pane ah-office-records' }, h('small', { className: 'ah-office-eyebrow' }, '调查档案'), h('h2', {}, '战役记录'),
      h('div', { className: 'ah-office-metrics' }, metric('star', cp.victory, '总胜利点'), metric('book', cp.xp, '未花经验')),
      !shownRecords.length && !cp.scenarioResults?.length ? h('div', { className: 'ah-office-empty' }, tableIcon('book'), h('p', {}, '尚未留下调查记录')) : null,
      shownRecords.map(([key, value]) => h('div', {}, `${label(key)}：${recordValueText(value, cardNames)}`)),
      (cp.scenarioResults || []).map(result => h('article', { className: 'ah-hub-scenario' },
        h('strong', {}, manifest?.scenarios.find(item => item.id === result.scenarioId)?.name || result.scenarioId),
        h('span', {}, `${resultName(s, result)} · 胜利点 ${result.victory} · ${result.rounds} 回合`),
        Object.entries(result.recordsAfter || {}).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(result.recordsBefore?.[key]))
          .map(([key, value]) => h('p', {}, `${label(key)}：${recordChangeText(result.recordsBefore?.[key], value, cardNames)}`)))),
      s.state.investigators.map(inv => h('p', {}, `${inv.name} · 创伤 肉体${cp.trauma[inv.seat]?.physical || 0} / 精神${cp.trauma[inv.seat]?.mental || 0}`)))
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
    if (state.arkhamLastUiState !== s.state.uiState) {
      state.arkhamLastUiState = s.state.uiState
      const eliminated = s.state.campaign.investigators[s.mySeat ?? 0]?.status !== 'active'
      state.arkhamHubTab = ['scenarioResult','campaignResult'].includes(s.state.uiState) ? 'story' : s.state.uiState === 'interlude' ? eliminated ? 'investigators' : 'upgrades'
        : s.state.uiState === 'scenarioSetup' ? s.state.hubReady ? 'departure' : 'investigators' : 'overview'
    }
    if (canDepart(s) && state.arkhamDepartureReady !== `${s.sessionId}:${s.state.campaign.scenarioIndex}`) state.arkhamHubTab = 'departure'
    state.arkhamDepartureReady = canDepart(s) ? `${s.sessionId}:${s.state.campaign.scenarioIndex}` : null
    const campaignTabs = supportsSupplies(s.state.campaign) ? tabs : tabs.filter(([id]) => id !== 'supplies')
    const activeTab = campaignTabs.some(([id]) => id === state.arkhamHubTab) ? state.arkhamHubTab : 'overview'
    const panes = { departure, overview, scenarios, investigators, deck, upgrades, supplies, records,
      story:s=>renderStoryReader(h,s,state,render,action,g,checkpointAction) }
    const saveNotice = s.saveDetached ? '当前存档已删除。另存为新存档后才能继续。'
      : s.saveError ? '自动保存失败：' + s.saveError : null
    return h('div', { className: 'bg-game ah-hub ah-office ah-theme', ...presentationAttributes(s.state), 'data-ui-state': s.state.uiState,
      'data-scroll-context': `${s.sessionId}:${s.state.uiState}:${activeTab}` },
      h('header', { className: 'bg-game-head' },
        h('div', { className: 'bg-game-title' }, '诡镇奇谈 · ' + s.state.campaign.name),
        h('div', { className: 'bg-game-status' }, STAGES[s.state.uiState] || '调查进行中'),
        h('div', { className: 'bg-game-actions' },
          h('button', { className: 'bg-btn secondary', onclick: rulebookOpen }, '规则书'),
          h('button', { className: 'bg-btn secondary', onclick: catalogOpen }, '全卡图鉴'),
          h('button', { className: 'bg-btn secondary', onclick: () => refreshSession(s) }, '刷新'),
          h('button', { className: 'bg-btn secondary', onclick: leave }, '退出'),
          feedbackEntry())),
      saveNotice ? h('div', { className: 'ah-hub-save-alert', role: 'alert' }, saveNotice,
        s.online && s.mySeat !== 0 ? h('p', {}, '请房主处理存档问题。')
          : h('button', { className: 'bg-btn', onclick: () => retrySave(s, !!s.saveDetached) }, s.saveDetached ? '另存为新存档' : '重试保存')) : null,
      state.error ? h('div', { className: 'ah-hub-save-alert', role: 'alert' }, state.error) : null,
      h('nav', { className: 'ah-hub-tabs', 'aria-label': '战役局外页面' },
        campaignTabs.map(([id, label]) => h('button', { className: (activeTab === id ? 'active ' : '') + (id === 'departure' ? 'ah-departure-tab' + (canDepart(s) ? ' is-ready' : '') : ''),
          'aria-label': label, 'aria-current': activeTab === id ? 'page' : null, onclick: () => changeTab(id) },
          tableIcon(TAB_ICONS[id] || 'star'), label,
          id === 'departure' ? h('small', {}, canDepart(s) ? '已就绪' : '待准备') : null))),
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
    imp.notice = `已切换为${inv.name}并载入《${imp.deck.name}》，确认后保存牌组。`
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
        imp.notice = `已载入《${deck.name}》${plan.errors.length ? '，请按提示调整后保存' : '，确认无误后保存牌组'}。`
        render()
      } }, draft.length ? `载入草稿（替换当前 ${draft.length} 张）` : '载入草稿')
      : switchMove ? h('button', { className: 'bg-btn', disabled: locked(s), onclick: () => {
        imp.pending = { sessionId: s.sessionId, code: plan.investigator.code }
        submitMove(switchMove, s)
      } }, `切换为${plan.investigator.name}并载入`)
      : h('p', { className: 'ah-deck-import-warn' }, `该牌组属于${plan.investigator.name}，当前调查员已锁定或不在你的操作时机，无法切换。`)
    return h('section', { className: 'ah-deck-import', 'aria-label': '从 ArkhamDB 导入牌组' },
      h('div', { className: 'ah-deck-import-head' }, h('h3', {}, '从 ArkhamDB 导入'),
        h('small', {}, '粘贴已发布牌组或公开分享牌组的链接、牌组编号，或 ArkhamDB 导出的 JSON。牌组内所有普通卡必须已实现，签名卡与弱点将自动处理。')),
      h('div', { className: 'ah-deck-import-form' },
        h('input', { type: 'text', value: imp.text || '', placeholder: 'https://arkhamdb.com/decklist/view/12345', 'aria-label': 'ArkhamDB 牌组链接或编号',
          'data-focus-key': 'arkhamdb-input', spellcheck: 'false', autocomplete: 'off',
          oninput: event => { imp.text = event.target.value },
          onkeydown: event => { if (event.key === 'Enter') { event.preventDefault(); readArkhamDbDeck() } } }),
        h('button', { className: 'bg-btn', disabled: !!imp.loading, onclick: readArkhamDbDeck }, imp.loading ? '读取中…' : '读取牌组'),
        h('button', { className: 'bg-btn secondary', onclick: () => { imp.open = false; render() } }, '收起')),
      imp.error ? h('p', { className: 'ah-deck-import-error', role: 'alert' }, imp.error) : null,
      plan ? h('div', { className: 'ah-deck-import-result' + (plan.ready ? ' is-ready' : ' is-blocked'), 'aria-live': 'polite' },
        h('header', {},
          h('strong', {}, deck.name),
          h('small', {}, `${deck.investigatorName} · ${total} 张${deck.xp ? ` · ${deck.xp} XP` : ''}`),
          deck.url ? h('a', { href: deck.url, target: '_blank', rel: 'noopener noreferrer' }, '在 ArkhamDB 查看') : null),
        plan.blocked.length ? h('div', { className: 'ah-deck-import-blocked' },
          h('p', {}, `以下 ${plan.blocked.length} 项无法使用，整副牌组不能导入：`), list(plan.blocked, 'is-blocked')) : null,
        plan.ready && plan.mismatch ? h('p', { className: 'ah-deck-import-warn' }, `牌组调查员为${plan.investigator.name}，与当前席位的${inv?.name || '调查员'}不同。`) : null,
        plan.ready && plan.errors.length ? h('div', { className: 'ah-deck-import-warn' },
          h('p', {}, `卡牌均已实现，但载入后仍有 ${plan.errors.length} 项构筑问题需要调整：`), plan.errors.slice(0, 4).map(error => h('p', {}, '· ' + error))) : null,
        plan.ready && !plan.errors.length && !plan.mismatch ? h('p', { className: 'ah-deck-import-ok' }, `全部 ${plan.codes.length} 张普通卡均已实现且符合构筑规则。`) : null,
        plan.auto.length ? h('div', { className: 'ah-deck-import-auto' }, h('p', {}, '系统自动处理：'), list(plan.auto, 'is-auto')) : null,
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
      if (!plan) return fail(`《${deck.name}》中没有可载入的卡牌。`)
      if (!plan.ready) return fail(`《${deck.name}》有 ${plan.blocked.length} 项无法使用：`
        + plan.blocked.slice(0, 4).map(item => `${item.name}（${item.reason}）`).join('、') + (plan.blocked.length > 4 ? ' 等' : ''))
      Object.assign(lib, { currentId: deck.id, name: deck.name, error: '', notice: '', confirmDelete: null })
      if (plan.mismatch) {
        const move = legal(s, 'hubSelectInvestigator').find(item => item.code === plan.investigator.code)
        if (!move || locked(s)) return fail(`该牌组属于${plan.investigator.name}，当前调查员已锁定或不在你的操作时机，无法切换。`)
        // applyPendingImport finishes the load once the investigator switch is committed.
        Object.assign(imp, { deck: deck.description, pending: { sessionId: s.sessionId, code: plan.investigator.code } })
        lib.open = false
        submitMove(move, s)
        return
      }
      lib.open = false
      imp.notice = `已从卡组库载入《${deck.name}》${plan.errors.length ? '，请按提示调整后保存' : '，确认无误后保存牌组'}。`
      replaceDraft(plan.codes)
    }
    return h('section', { className: 'ah-deck-import ah-deck-library', 'aria-label': '本地卡组库' },
      h('div', { className: 'ah-deck-import-head' }, h('h3', {}, '本地卡组库'),
        h('small', {}, '卡组库保存在本机，与战役存档相互独立。只收藏普通卡清单，签名卡与弱点在保存牌组时自动处理；未完成的草稿也可以先存起来。')),
      h('div', { className: 'ah-deck-import-form' },
        h('input', { type: 'text', value: lib.name || '', placeholder: `${inv?.name || '调查员'}的牌组`, maxlength: '60', 'aria-label': '卡组名称',
          'data-focus-key': 'library-name', autocomplete: 'off', oninput: event => { lib.name = event.target.value } }),
        current ? h('button', { className: 'bg-btn', disabled: !!lib.saving || !draft.length, onclick: () => storeLibraryDeck(inv, draft, true) },
          `覆盖《${current.name}》`) : null,
        h('button', { className: current ? 'bg-btn secondary' : 'bg-btn', disabled: !!lib.saving || !draft.length || !inv,
          title: draft.length ? '' : '草稿为空', onclick: () => storeLibraryDeck(inv, draft, false) }, `存为新卡组（${draft.length} 张）`),
        h('button', { className: 'bg-btn secondary', onclick: () => { lib.open = false; render() } }, '收起')),
      lib.error ? h('p', { className: 'ah-deck-import-error', role: 'alert' }, lib.error) : null,
      lib.notice ? h('p', { className: 'ah-deck-import-ok', role: 'status' }, lib.notice) : null,
      !lib.decks ? h('p', { className: 'ah-deck-import-note' }, lib.loading ? '正在读取卡组库…' : '卡组库暂不可用。')
        : !decks.length ? h('p', { className: 'ah-deck-import-note' }, '卡组库还是空的，可以把当前草稿存进来。')
          : h('ul', { className: 'ah-deck-library-list', 'aria-label': '已收藏的牌组' }, decks.map(deck => h('li', {
            className: deck.investigator_code === inv?.code ? 'is-current-investigator' : '', 'data-library-deck': deck.id },
          h('div', {}, h('strong', {}, deck.name),
            h('small', {}, `${investigatorName(deck.investigator_code)} · ${total(deck)} 张 · ${new Date(deck.updatedAt).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })}`)),
          h('div', {},
            h('button', { className: 'bg-btn', disabled: !!lib.saving || state.busy, onclick: () => load(deck) },
              deck.investigator_code === inv?.code ? (draft.length ? '载入（替换草稿）' : '载入') : `切换为${investigatorName(deck.investigator_code)}并载入`),
            lib.confirmDelete === deck.id
              ? h('button', { className: 'bg-btn', disabled: !!lib.saving, onclick: () => removeLibraryDeck(deck) }, '确认删除')
              : h('button', { className: 'bg-btn secondary', disabled: !!lib.saving, onclick: () => { lib.confirmDelete = deck.id; render() } }, '删除'))))))
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
    const checked = inv ? validateDeckRules(inv, draft, cardMap) : { errors: ['未选择调查员'], count: 0 }
    const distribution = draft.reduce((out, code) => {
      const card = cardMap[code]
      if (card) out[card.type] = (out[card.type] || 0) + 1
      return out
    }, {})
    // One partial validation per card and render; the pool asks several times.
    const addErrors = new Map()
    const addError = code => {
      if (!addErrors.has(code)) addErrors.set(code, !inv ? '未选择调查员' : !cardMap[code] ? '该卡不可用于当前调查员'
        : validateDeckRules(inv, [...draft, code], cardMap, { partial: true }).errors.join('；'))
      return addErrors.get(code)
    }
    const canAdd = code => !state.busy && !addError(code)
    const edit = fn => { (state.arkhamDeckUndo ||= []).push([...draft]); state.arkhamDeckRedo=[]; fn(); render() }
    const add = code => { if (canAdd(code)) edit(()=>draft.push(code)) }
    const remove = code => { if (!state.busy && draft.includes(code)) edit(()=>draft.splice(draft.indexOf(code),1)) }
    const replaceDraft = codes => { if (!state.busy) edit(() => { state.arkhamDeckDraft = [...codes] }) }
    const restore = (from,to) => { const stack=state[from] || [];if(stack.length&&!state.busy){(state[to] ||= []).push([...draft]);state.arkhamDeckDraft=stack.pop();render()} }
    const baseline = savedDraft(s, inv)
    const saved = !!s.state.campaign.investigators[deckSeat(s)]?.deck?.length
    const dirty = !sameCards(draft, baseline)
    const remaining = size - checked.count
    const imp = state.arkhamDeckImport || (state.arkhamDeckImport = { text: '', open: false })
    const lib = deckLibrary()
    const costCounts = [0, 1, 2, 3, 4, 5].map(cost => draft.filter(code => {
      const value = cardMap[code]?.cost
      return typeof value === 'number' && (cost === 5 ? value >= 5 : value === cost)
    }).length)
    const byCost = (a, b) => (cardMap[a]?.cost ?? 99) - (cardMap[b]?.cost ?? 99) || nameOf(g, a).localeCompare(nameOf(g, b), 'zh') || a.localeCompare(b)
    const groups = [['asset', '资产'], ['event', '事件'], ['skill', '技能'], [null, '其他']].map(([type, label]) => {
      const codes = Object.keys(counts).filter(code => type ? cardMap[code]?.type === type : !['asset', 'event', 'skill'].includes(cardMap[code]?.type)).sort(byCost)
      return { label, codes, total: codes.reduce((sum, code) => sum + counts[code], 0) }
    }).filter(group => group.codes.length)
    const fixed = [...(inv?.signatureCards || []).map(card => [card, '专属卡牌']), ...(inv?.signatureWeaknesses || []).map(card => [card, '专属弱点'])]
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
      h('div', { className: 'bg-modal ah-db-modal ah-office', 'data-scroll-context': `${s.sessionId}:${inv?.seat}:${inv?.code}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': '卡组构筑',
        onkeydown: keys, onclick: event => event.stopPropagation() },
        h('header', { className: 'ah-db-modal-head' },
          h('h2', {}, `卡组构筑 · ${inv?.name || ''} · ${checked.count}/${size}`),
          h('div', { className: 'ah-db-modal-tools' },
            h('button', { className: 'bg-btn' + (imp.open ? '' : ' secondary'), 'data-deck-tool': 'import', 'aria-expanded': String(!!imp.open), onclick: () => {
              imp.open = !imp.open; if (imp.open) lib.open = false; render()
              if (imp.open) setTimeout(() => document.querySelector('.ah-deck-import:not(.ah-deck-library) input')?.focus({ preventScroll: true }), 0)
            } }, '导入 ArkhamDB'),
            h('button', { className: 'bg-btn' + (lib.open ? '' : ' secondary'), 'data-deck-tool': 'library', 'aria-expanded': String(!!lib.open), onclick: () => {
              lib.open = !lib.open
              if (lib.open) { imp.open = false; Object.assign(lib, { notice: '', error: '', confirmDelete: null }) }
              render()
              if (lib.open) refreshLibrary()
            } }, '卡组库'),
            h('small', { className: 'ah-db-modal-hint' }, '按住 Alt 悬停卡牌可放大查看'))),
        imp.open ? importPanel(s, g, inv, draft, replaceDraft) : null,
        lib.open ? libraryPanel(s, g, inv, draft, replaceDraft) : null,
        h('div', { className: 'ah-office-builder' },
        h('section', { className: 'ah-office-library', 'aria-label': '可用卡牌' },
        filterControls('deck', pool, shown),
        h('div', { className: 'ah-hub-card-pool', 'data-scroll-context': JSON.stringify([inv?.code, cardFilters('deck')]) }, shown.map(card => h('div', {
          className: 'ah-db-card' + (counts[card.code] ? ' is-in-deck' : '') + (remaining > 0 && addError(card.code) ? ' is-unavailable' : ''),
          'data-zoom-code': card.code, 'data-zoom-name': card.name },
          h('button', { disabled: !canAdd(card.code), draggable: String(canAdd(card.code)), 'data-focus-key': 'add:' + card.code, 'aria-label': `加入 ${card.name} ${counts[card.code] || 0}/${card.deckLimit || 2}`,
            title: addError(card.code) || '点击或拖入牌组',
            ondragstart: event => { event.dataTransfer.setData('application/x-arkham-hub-card', card.code); event.dataTransfer.effectAllowed = 'copy' },
            onclick: () => add(card.code) },
            art(card.code, card.name), counts[card.code] ? h('i', { className: 'ah-db-card-count', 'aria-hidden': 'true' }, `×${counts[card.code]}`) : null,
            h('span', {}, card.name), h('small', {}, `${counts[card.code] || 0}/${card.deckLimit || 2} · ${card.cost ?? '—'} 资源 · ${card.xp || 0} 级`)),
          h('div',{className:'ah-builder-card-tools'},h('button',{'aria-label':'减少 '+card.name,disabled:state.busy || !counts[card.code],onclick:()=>remove(card.code)},'−'),
            h('button',{'aria-label':'查看卡牌：'+card.name,onclick:()=>inspectCard(card.code)},'详情'),
            h('button',{'aria-label':'增加 '+card.name,disabled:!canAdd(card.code),onclick:()=>add(card.code)},'+'))))),
        !shown.length ? h('p', { className: 'ah-office-empty' }, '没有符合条件的卡牌') : null),
        h('aside', { className: 'ah-office-deck-tray', 'aria-label': '当前牌组',
          ondragover: event => { if (Array.from(event.dataTransfer.types).includes('application/x-arkham-hub-card')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; event.currentTarget.classList.add('is-dragover') } },
          ondragleave: event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.classList.remove('is-dragover') },
          ondrop: event => { event.preventDefault(); event.currentTarget.classList.remove('is-dragover'); add(event.dataTransfer.getData('application/x-arkham-hub-card')) },
        }, h('h3', {}, `我的牌组 · ${checked.count}/${size}`),
        h('div', { className: 'ah-deck-progress' + (remaining === 0 ? ' is-full' : remaining < 0 ? ' is-over' : ''), 'aria-hidden': 'true' },
          h('i', { style: `width:${Math.min(100, Math.max(0, checked.count / size * 100))}%` })),
        h('small', { className: 'ah-deck-progress-text' + (dirty ? ' is-dirty' : '') },
          remaining > 0 ? `还差 ${remaining} 张` : remaining < 0 ? `超出 ${-remaining} 张` : '张数已满',
          dirty ? ' · 有未保存的修改' : saved ? ' · 与已保存牌组一致' : ''),
        imp.notice ? h('p', { className: 'ah-deck-import-notice' }, imp.notice) : null,
        h('small', {}, '点击或拖入加入 · 查看详情不改变牌组 · Ctrl+Z 撤销'),
        h('div',{className:'ah-builder-tools'},h('button',{disabled:state.busy || !state.arkhamDeckUndo?.length,onclick:()=>restore('arkhamDeckUndo','arkhamDeckRedo')},'撤销'),
          h('button',{disabled:state.busy || !state.arkhamDeckRedo?.length,onclick:()=>restore('arkhamDeckRedo','arkhamDeckUndo')},'重做'),
          h('button',{disabled:state.busy || !draft.length,title:'清空当前草稿，可按 Ctrl+Z 撤销',onclick:()=>replaceDraft([])},'清空'),
          saved ? h('button',{disabled:state.busy || !dirty,title:'放弃草稿修改，回到已保存牌组，可按 Ctrl+Z 撤销',onclick:()=>replaceDraft(baseline)},'恢复已保存') : null),
        h('p', {}, `资产 ${distribution.asset || 0} · 事件 ${distribution.event || 0} · 技能 ${distribution.skill || 0}`),
        h('div', { className: 'ah-office-cost-curve', 'aria-label': '资源费用分布' }, costCounts.map((count, cost) => h('div', { title: `${cost === 5 ? '5+' : cost} 资源：${count} 张` },
          h('small', {}, String(count)), h('i', { style: `height:${Math.max(2, count / Math.max(1, ...costCounts) * 42)}px` }), h('span', {}, cost === 5 ? '5+' : String(cost))))),
        h('div', { className: 'ah-hub-deck-list' }, !groups.length ? h('p', { className: 'ah-deck-list-empty' }, '从左侧挑选卡牌，或导入 ArkhamDB 牌组。') : null,
          groups.flatMap(group => [
            h('h4', { className: 'ah-deck-group' }, h('span', {}, group.label), h('small', {}, `${group.total} 张`)),
            ...group.codes.map(code => h('div',{className:'ah-deck-row','data-zoom-code':code,'data-zoom-name':nameOf(g,code)},
              h('button',{'aria-label':'查看卡牌：'+nameOf(g,code),onclick:()=>inspectCard(code)},art(code,nameOf(g,code)),
                h('span',{},nameOf(g,code)), cardMap[code]?.cost != null ? h('small',{className:'ah-deck-row-cost'},String(cardMap[code].cost)) : null),
              h('button',{'aria-label':`移除 ${nameOf(g,code)}`,disabled:state.busy,onclick:()=>remove(code)},'−'),h('b',{},String(counts[code])),
              h('button',{'aria-label':'补入 '+nameOf(g,code),disabled:!canAdd(code),title:addError(code) || '',onclick:()=>add(code)},'+'))),
          ])),
        checked.errors.length ? h('div', { role: 'status', className: 'ah-office-deck-validation' }, checked.errors.map(error => h('p', {}, error))) : h('p', { role: 'status' }, '构筑规则检查通过'),
        inv ? h('section', { className: 'ah-deck-fixed', 'aria-label': '保存时自动加入' },
          h('h4', { className: 'ah-deck-group' }, h('span', {}, '保存时自动加入'), h('small', {}, `${fixed.length + 1} 张`)),
          fixed.map(([card, label]) => h('button', { className: 'ah-deck-fixed-card', 'aria-label': `查看${label}：${card.name}`,
            'data-zoom-code': card.code, 'data-zoom-name': card.name, onclick: () => inspectCard(card.code) },
            art(card.code, card.name), h('span', {}, card.name), h('small', {}, label))),
          h('div', { className: 'ah-deck-fixed-card is-random' }, tableIcon('doom'), h('span', {}, '随机基础弱点'), h('small', {}, '保存时抽取'))) : null)),
        h('div', { className: 'bg-modal-foot' },
          dirty ? h('small', { className: 'ah-deck-foot-hint' }, '取消会保留草稿，下次打开可继续编辑。') : null,
          h('button', { className: 'bg-btn secondary', onclick: closeDeck }, '取消'),
          h('button', { className: 'bg-btn', disabled: locked(s) || checked.errors.length > 0, title: checked.errors[0] || '',
            onclick: () => {
              state.arkhamDeckOpen = false
              if (state.arkhamDeckImport) state.arkhamDeckImport.notice = ''
              submitMove({ action: 'hubSetDeck', codes: [...draft] }, s)
            } }, '保存牌组'))))
  }

  return { onOpenSetup,
    renderSetupModal: g => stablePanel('.ah-hub-setup', () => renderSetupModal(g)),
    renderGame: s => stablePanel('.ah-hub', () => renderGame(s)),
    renderDeckModal: s => stablePanel('.ah-db-modal', () => renderDeckModal(s)),
  }
}
