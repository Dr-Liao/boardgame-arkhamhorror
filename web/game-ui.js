// 诡镇奇谈 · 卡牌版 Mod 的浏览器 UI
//
// 由大厅按 /mods/arkhamhorror/catalog.js 动态加载（见 lib/mods.js 的 web 契约）。
// 大厅只提供通用宿主能力（h/api/render/state），本文件负责全部诡镇专属展示：
// 战役选择、卡组构筑、对局界面、卡牌详情与全卡图鉴。
// 不要把这些逻辑写回大厅的 public/app.js。

import { createCatalogUI, getCardPresentation, renderDetailContent, renderImage, cardFaceText, preloadScenarioImages,
  cardDisplayName, cardDisplayText, cardDisplayFlavor, cardDisplaySubname, cardDisplayTraits, currentLanguage, setHostLocale } from './catalog.js'
import { setLocale as setUiLocale, t } from './i18n.js'
// 第 127 轮：UI 的卡号表现表在 web/ui-cards.js（纯数据表，必须留在浏览器挂载目录内）。
import { UI_CARDS } from './ui-cards.js'
import { createHubUI } from './hub.js'
import { createMusicPlayer } from './music-player.js'
import { createChaosBagView } from './chaos-bag-view.js'
import { chaosTokenFaceByLabel } from './chaos-token.js'
import { createSituationView } from './situation-view.js'
import { createDebugConsole } from './debug-console.js'
import { createRulebook } from './rulebook.js'
import { cardRuleIds, openRule, ruleLink } from './rulebook-data.js'
import { renderRulesText, cardSymbol } from './card-text.js'
import { tableArt, retainTableArt } from './table-art.js'
import { createTableRegions } from './table-regions.js'
import { renderTableLog } from './table-timeline.js'
import { mapGeometry, hunterRouteEdges, MAP_CARD_WIDTH, MAP_CARD_HEIGHT } from './map-layout.js'
import { createTablePresentation } from './table-presentation.js'
import { tableIcon, classIcon, cardAttachmentReferences, cardMarkerData, placedCardMarkers } from './table-components.js'
import { choicePresentation, entityMoves, mountCardInteractions, cancelTableGesture, handUnavailableReason, investigatorHoldsCard } from './card-interactions.js'
import { setReactionEnabled, reactionChoices, reactionView, reactionAutoPlan, reactionState, setReactionState, reactionStates, reactionPrefsSeq, defaultReactionState, hydrateReactionStates } from './reaction-preferences.js'
import { presentationAttributes, campaignPlaylistId } from './campaign-presentation.js'
import { captureScrollState, restoreScrollWhenMounted } from './scroll-state.js'
// 第 4 步 P5：万象无终的专用交互面板（塔罗抽牌 / 序章选人 / 闹鬼来源 / 地点标记 / 多技能检定）。
import {
  enemyFaceBadge, hauntedChoiceModel, locationTcuBadges, multiSkillTestInfo,
  renderHauntedChoice, renderStoryInvestigatorPicker, renderTarotPicker,
  storyInvestigatorPickerModel, tarotPickerModel,
} from './tcu-ui.js'

let h, api, render, state, reset, leave, openFeedback
let beginInteraction = () => () => {}
let hubUi
let tableRegions
let presentation
let mapResizeObserver
let musicPlayer
let chaosBagView
let situationView
// 调试控制台：单机本机可用 / 联机房主可见（契约 artifacts/debug-console/CONTRACT.md §7）。
let debugConsole

// 挂在牌桌之外的浮层（音乐盒）拿不到 .ah-table 上的主题变量：把当前战役色板
// 直接写到浮层根节点，样式与牌桌共用同一组 --ah-theme-* / --ah-material-*。
function applyPresentationAttributes(node, attributes) {
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'style') continue
    if (value == null) node.removeAttribute(key)
    else node.setAttribute(key, value)
  }
  for (const [name, value] of Object.entries(attributes.style || {})) node.style.setProperty(name, value)
}
// The session last painted on the table (after presentation/reaction views).
let tableSession = null
let rulebook
let lastReactionPass = null
// 三态覆盖异步同步：本地立即生效，250ms 去抖合并后上行；失败按错误类型冷却。
// 断线→恢复、房主离线→在线、每 2 分钟各强制重发一次，覆盖房主进程重启丢缓存的情况。
const REACTION_SYNC_REFRESH_MS = 120000
const REACTION_SYNC_DEBOUNCE_MS = 250
let reactionSyncKey = ''
let reactionSyncFailed = ''
let reactionSyncing = ''
let reactionSyncAfter = 0
let reactionSyncedAt = 0
let reactionSyncConnected = null
let reactionSyncHostOnline = null
let reactionSyncTimer = null
let reactionSyncPending = null
const resetReactionSync = () => {
  reactionSyncKey = ''; reactionSyncFailed = ''; reactionSyncing = ''; reactionSyncAfter = 0; reactionSyncedAt = 0
  reactionSyncPending = null
  if (reactionSyncTimer) { clearTimeout(reactionSyncTimer); reactionSyncTimer = null }
}

function flushReactionPreferences() {
  reactionSyncTimer = null
  const pending = reactionSyncPending
  reactionSyncPending = null
  if (!pending || pending.key === reactionSyncing) return
  reactionSyncing = pending.key
  reactionSyncAfter = Date.now() + 5000
  api('POST', '/prefs', { sessionId: pending.sessionId, states: pending.states, seq: pending.seq })
    .then(() => { reactionSyncKey = pending.key; reactionSyncedAt = Date.now(); reactionSyncFailed = '' })
    .catch(error => {
      // 房主忙碌（SESSION_BUSY）很快重试；旧房主不支持该命令时拉长冷却。
      reactionSyncFailed = pending.key
      reactionSyncAfter = Date.now() + (error?.code === 'SESSION_BUSY' ? 800 : 30000)
    })
    .finally(() => { if (reactionSyncing === pending.key) reactionSyncing = '' })
}

function syncReactionPreferences(session) {
  const onlineRoom = !!(session?.online && state.online?.room)
  const connected = !!(onlineRoom && state.online?.connected)
  if (onlineRoom) {
    // 断线→恢复：房主可能经历了重启/缓存重建，强制重发。
    if (reactionSyncConnected === false && connected) resetReactionSync()
    reactionSyncConnected = connected
    if (!connected) return
    const hostOnline = state.online.room.members?.some(member => member.host && member.online) === true
    // 房主离线→在线：同样视为缓存可能已重建。
    if (reactionSyncHostOnline === false && hostOnline) resetReactionSync()
    reactionSyncHostOnline = hostOnline
    if (!hostOnline) return
  } else {
    // 单机没有联机房间：仍然异步写本机大厅，让 sidecar 及时落盘。
    reactionSyncConnected = null
    reactionSyncHostOnline = null
  }
  const seat = mySeat(session)
  const states = reactionStates(session.sessionId, seat)
  const seq = reactionPrefsSeq(session.sessionId, seat)
  const key = [onlineRoom ? (state.online.instanceId || '') : 'local', session.sessionId, seat,
    JSON.stringify(states), seq].join('|')
  if (key === reactionSyncKey && Date.now() - reactionSyncedAt < REACTION_SYNC_REFRESH_MS) return
  if (key === reactionSyncFailed && Date.now() < reactionSyncAfter) return
  if (reactionSyncPending?.key === key) return
  reactionSyncPending = { key, sessionId: session.sessionId, states, seq }
  if (!reactionSyncTimer) reactionSyncTimer = setTimeout(flushReactionPreferences, REACTION_SYNC_DEBOUNCE_MS)
}
const mySeat = s => s.mySeat ?? s.observerSeat ?? 0

// 宿主注入的反馈入口。旧版大厅没有 openFeedback 时按钮不渲染，Mod 单独加载也能跑。
function feedbackEntry() {
  if (typeof openFeedback !== 'function') return null
  const label = t('game.feedback')
  return h('button', { className: 'bg-btn secondary ah-feedback-entry', title: label, 'aria-label': label,
    onclick: () => openFeedback() }, '💬 ' + label)
}
const canAct = (s, seat) => seat === mySeat(s) && (!s.online || (state.online?.connected && !state.online?.busy && state.online?.room?.members.some(member => member.host && member.online)))
// Some choices (e.g. who starts next) accept several seats; answer as myself when I'm one of them.
const decisionSeatOf = s => {
  const st = s.state, primary = st.pendingChoice ? st.pendingChoice.seat : st.currentSeat
  return s.actingSeats?.includes(mySeat(s)) ? mySeat(s) : primary
}
// 演出期间只读视图必须使用正在播放的牌桌快照，避免提前泄露尚未演出的结果。
const viewSession = () => (presentation?.isBlocking && tableSession?.sessionId === state.session?.sessionId && tableSession) || state.session

function scheduleReactionPass(session) {
  const seat = mySeat(session)
  // 「该不该自动结算」与「现在能不能提交」分开判定：联机的忙碌快照（房主还在结算
  // 上一步）不能提交，但窗口必须继续藏住，否则会先画出反应内容再消失。
  const ready = !state.busy && !presentation.isBlocking && canAct(session, seat)
  const pass = reactionAutoPlan(session, seat, ready)
  if (!pass) return false
  if (!pass.submit) return true
  const { choice, key } = pass
  if (key === lastReactionPass) return state.movePending?.sessionId === session.sessionId
  lastReactionPass = key
  queueMicrotask(() => {
    if (key !== lastReactionPass || state.session?.sessionId !== session.sessionId
        || state.session.state.revision !== session.state.revision) return
    // 排队期间又忙起来（别人的行动先到）：这次不提交，等忙碌结束的那次渲染重新排队。
    if (state.busy || presentation.isBlocking || !canAct(session, choice.seat)) {
      lastReactionPass = null
      render()
      return
    }
    // 排队期间玩家可能改了开关：按最新状态重算，只有仍可自动结算才提交。
    const fresh = reactionAutoPlan(state.session, choice.seat, true)
    if (!fresh?.move || fresh.choice.id !== choice.id) { lastReactionPass = null; return }
    cardMove(fresh.move, state.session, { auto: true })
  })
  return true
}

// 反应提示开关统一成一颗可开关的闪电图标（卡面/详情/角色面板同一个控件，不再显示「反应开/反应关」文字）。
// 有自动资格的卡（hasAutoReaction）用三态按钮；只有快速开关的卡是两态 skip ↔ ask，图标仍是同一颗闪电。
function renderReactionToggle(s, code) {
  if (!s) return null
  const def = ahCardDef(s, code)
  if (!def.hasReactionPrompt && !def.hasAutoReaction) return null
  const seat = s.observerSeat ?? s.players.find(player => player.role === 'human')?.seat
  const inv = s.state.investigators.find(inv => inv.seat === seat)
  // 2026-10-28：手牌/场上之外，「如同手牌」通道里的卡（直觉区揭示那张、下方、背包/原定计划
  // 附属、宿主附属）也要显示开关，开关按 cardCode 生效（ask=提示，skip=本局不再询问）。
  if (!inv || !investigatorHoldsCard(inv, s.state, code)) return null
  return renderReactionModeButton(s, seat, code, def)
}

// 三态按钮：skip → ask → auto → skip。一个命中区，图标随状态变化：
// skip=暗闪电+斜杠，ask=亮闪电，auto=亮齿轮（旋转）。hover/aria 都描述当前状态与下一档。
// 没有自动资格的卡只有 skip/ask 两态，始终用闪电图标。
const REACTION_MODE_NEXT = { skip: 'ask', ask: 'auto', auto: 'skip' }
const REACTION_MODE_NEXT_NO_AUTO = { skip: 'ask', ask: 'skip', auto: 'skip' }
// 显式 key 表：i18n 守卫只认 t(字面量)，不要用模板拼接。
const REACTION_MODE_KEY = { skip: 'game.reaction.mode.skip', ask: 'game.reaction.mode.ask', auto: 'game.reaction.mode.auto' }
const REACTION_MODE_TITLE_KEY = { skip: 'game.reaction.mode.skip.title', ask: 'game.reaction.mode.ask.title', auto: 'game.reaction.mode.auto.title' }
// 两态卡（无 auto 档）沿用「开启/关闭」的 hover 文案；三态卡的标题在 ask 档会说明下一档是 auto。
const REACTION_TOGGLE_TITLE_KEY = { skip: 'game.reaction.off.title', ask: 'game.reaction.on.title' }
function reactionModeOf(s, seat, code) {
  return reactionState(s.sessionId, seat, code) ?? defaultReactionState(ahCardDef(s, code))
}
function renderReactionModeButton(s, seat, code, def) {
  const raw = reactionModeOf(s, seat, code)
  const mode = !def.hasAutoReaction && raw === 'auto' ? 'ask' : raw
  const next = (def.hasAutoReaction ? REACTION_MODE_NEXT : REACTION_MODE_NEXT_NO_AUTO)[mode]
  // 三态卡说明当前档位与下一档；两态卡就是开关，读屏用 switch + aria-checked。
  const threeWay = !!def.hasAutoReaction
  const title = threeWay ? t(REACTION_MODE_TITLE_KEY[mode]) : t(REACTION_TOGGLE_TITLE_KEY[mode])
  const ariaLabel = threeWay
    ? t('game.reaction.mode.aria', { state: t(REACTION_MODE_KEY[mode]), next: t(REACTION_MODE_KEY[next]) })
    : t('game.reaction.aria', { name: cardDisplayName(ahCardDef(s, code)) || code })
  return h('button', {
    className: `ah-reaction-mode is-${mode}`,
    type: 'button',
    'data-reaction-mode': mode,
    'data-reaction-code': code,
    role: threeWay ? null : 'switch',
    'aria-checked': threeWay ? null : String(mode !== 'skip'),
    title,
    'aria-label': ariaLabel,
    onpointerdown: event => event.stopPropagation(),
    onkeydown: event => event.stopPropagation(),
    onclick: event => {
      event.stopPropagation()
      setReactionState(s.sessionId, seat, code, next)
      lastReactionPass = null
      resetReactionSync()
      render()
    },
  }, tableIcon(threeWay && mode === 'auto' ? 'gear' : 'action'),
    mode === 'skip' ? h('i', { className: 'ah-reaction-slash', 'aria-hidden': 'true' }) : null)
}
function renderReactionModes(s, inv) {
  const def = ahCardDef(s, inv.code)
  if (!def.hasReactionPrompt && !def.hasAutoReaction) return null
  return renderReactionModeButton(s, inv.seat, inv.code, def)
}

/** 大厅在加载 Mod 时调用一次，注入宿主能力并拿回本 Mod 的 UI 接口。 */
export function createUI(host) {
  ;({ h, api, render, state, reset, leave, openFeedback } = host)
  beginInteraction = host.beginInteraction || beginInteraction
  // 大厅语言（docs/localization.md §8.1）：旧版大厅没有 host.locale，回退游戏默认语言中文。
  // UI 词典与卡牌语言分开：卡牌语言默认跟随大厅，但玩家显式改过后由 preferences.followHall 决定。
  const initialLocale = host.locale?.resolved || 'zh-CN'
  setUiLocale(initialLocale)
  setHostLocale(initialLocale)
  musicPlayer ||= createMusicPlayer(h)
  chaosBagView ||= createChaosBagView(h,render)
  rulebook ||= createRulebook(h,render)
  presentation ||= createTablePresentation({
    art: (code, name, options) => tableArt(h, code, name, options),
    onChange: () => render(),
    themeAttributes: () => state.session?.state ? presentationAttributes(state.session.state) : null,
  })
  const openChaosBag = () => { if (state.session) chaosBagView.open(state.session.sessionId) }
  tableRegions = createTableRegions(h, { openDetail: (def, options) => openCardDetailDef(def, options), openChaosBag })
  situationView ||= createSituationView(h, { render: () => render(), openChaosBag: () => openChaosBag(),
    effStat: (s, inv, skill) => ahEffStat(s, inv, skill), mySeat: s => mySeat(s),
    openDetail: (def, options) => openCardDetailDef(def, options), openCard: (s, reference) => openCardDetail(s, reference),
    cardName: (s, code) => cardDisplayName(ahCardDef(s, code)) })
  // 宿主能力（h/t/api/render/state）注入；面板只在牌桌且 canUse 时渲染入口。
  debugConsole ||= createDebugConsole({ h, t, api, render, state })
  hubUi = createHubUI({ ...host, canAct, submitMove: cardMove, refreshSession: refreshCardSession,
    catalogOpen: () => arkhamCatalog.open(), rulebookOpen: () => openRule(), inspectCard: code => openCardDetailDef({...ahCardDef(state.session,code),code}, {runtime:false}) })
  return {
    onOpenSetup: game => { state.cardDetail = null; state.arkhamZoneOpen = null; state.arkhamDeckOpen = false; if (arkhamCatalog.isOpen) arkhamCatalog.close(); hubUi.onOpenSetup(game) },
    onDeactivate: () => { musicPlayer.render(false); rulebook.render(false); chaosBagView.reset(); situationView.reset(); debugConsole.close({ render: false }); state.arkhamZoneOpen = null; tableSession = null },
    // 大厅切换语言后调用（§8.3）：幂等、同步，只换词典与卡牌语言并重绘；
    // 不重置对局、不重新请求存档、不 location.reload()、不触发 AI 回合。
    onLocaleChange(next) {
      const locale = next?.resolved || next || 'zh-CN'
      setUiLocale(locale)
      setHostLocale(locale)
      render()
    },
    isModalOpen: () => !!(state.cardDetail || state.arkhamZoneOpen || state.arkhamDeckOpen || arkhamCatalog.isOpen || chaosBagView.opened || situationView.opened || debugConsole.opened),
    renderSetupModal: game => hubUi.renderSetupModal(game),
    renderGame: session => {
      session = presentation.sync(session)
      if (session.state.hubFlow && ['interlude', 'scenarioSetup'].includes(session.state.uiState)) preloadScenarioImages(session.state.hubSelectedScenarioId)
      if (session.state.hubFlow && session.state.uiState !== 'inScenario') { tableSession = null; return hubUi.renderGame(session) }
      // P1：每次进局/重连/开关变化时把「反应关」集合同步给房主；房主据此代答任意座位的窗口。
      // 重连/换设备先从视图恢复本座位覆盖，再把本机最新的三态同步给房主。
      hydrateReactionStates(session, mySeat(session))
      syncReactionPreferences(session)
      const autoPassing = scheduleReactionPass(session)
      session = reactionView(session)
      tableSession = session
      const previous = document.querySelector('.ah-table')
      const scroll = previous?.dataset.sessionId === session.sessionId ? captureScrollState(previous) : []
      const next = renderCardGame(session, autoPassing)
      if (previous?.dataset.sessionId === session.sessionId) retainTableArt(previous, next)
      next.dataset.sessionId = session.sessionId
      next.classList.toggle('ah-presenting', presentation.isBlocking)
      restoreScrollWhenMounted(next, scroll)
      return next
    },
    renderOverlays: () => {
      const overlaySession = state.session
      const overlayTheme = overlaySession?.modId === 'arkhamhorror' && overlaySession.state
        ? presentationAttributes(overlaySession.state) : null
      // 弹窗/浮层挂在牌桌与局外面板之外，收不到 .ah-theme 上的战役色板：
      // 给每个浮层根节点补上主题类与变量，样式仍只消费 --ah-theme-*。
      const themed = node => {
        if (!node || !overlayTheme) return node
        node.classList.add('ah-theme')
        applyPresentationAttributes(node, overlayTheme)
        return node
      }
      const musicSession = state.session
      const musicActive = state.view === 'game' && musicSession?.modId === 'arkhamhorror'
        && (!musicSession.state?.hubFlow || musicSession.state.uiState === 'inScenario')
      const music = musicPlayer.render(musicActive, campaignPlaylistId(musicSession?.state))
      if (music && musicSession?.state) applyPresentationAttributes(music, presentationAttributes(musicSession.state))
      return [
        themed(chaosBagView.render(state.view==='game'?viewSession():null,false)),
        themed(rulebook.render(state.setup?.game?.id === 'arkhamhorror' || (state.view === 'game' && state.session?.modId === 'arkhamhorror'))),
        music,
        themed(situationView.render(state.view === 'game' ? tableSession : null, {
          sync: tableSession && state.arkhamSync?.sessionId === tableSession.sessionId ? state.arkhamSync.message : null })),
        themed(!presentation.isBlocking && state.arkhamZoneOpen && tableSession ? renderCardZoneModal(tableSession) : null),
        themed(!presentation.isBlocking && state.arkhamDeckOpen && state.session ? hubUi.renderDeckModal(state.session) : null),
        themed(arkhamCatalog.isOpen ? arkhamCatalog.render() : null),
        themed(state.cardDetail ? renderCardDetailModal(state.cardDetail) : null),
        themed(debugConsole.render()),
      ].filter(Boolean)
    },
    // 大厅「强制同步」钩子：任何操作/演出看起来卡住时，由玩家手动点「强制同步」清掉本 Mod 的
    // 本地演出、选择与行动门闩，再用房主的全量快照重画。只重置展示状态，不提交动作、不改对局。
    recoverAfterStall: () => {
      state.busy = false
      state.movePending = null
      state.error = ''
      state.arkhamSelection = null
      state.arkhamDirectActions = null
      state.arkhamTargetAbility = null
      state.arkhamChoiceDraft = null
      state.arkhamHubPending = null
      state.arkhamAcceptedFx = null
      lastReactionPass = null
      cancelTableGesture()
      clearCardDrag()
      presentation?.reset?.()
      tableSession = null
      render()
    },
  }
}

const arkhamCatalog = createCatalogUI({
  h: (...args) => h(...args),
  onChange: () => render(),
  openCard: (def) => openCardDetailDef(def, { runtime: false }),
})

// ---------------------------------------------------------------------------
// 卡牌类桌游渲染（诡镇奇谈：卡牌版）
// ---------------------------------------------------------------------------

const AH_CLASS_EMOJI = { guardian: '🛡️', seeker: '📖', mystic: '🔮', rogue: '🗡️', survivor: '🪶', neutral: '⚪', mythos: '👁️' }
const AH_CLASS_COLOR = { guardian: '#3b82f6', seeker: '#f59e0b', mystic: '#8b5cf6', rogue: '#10b981', survivor: '#ef4444', neutral: '#9ca3af', mythos: '#6b21a8' }
const AH_SKILL_ICON = { willpower: '🧠', intellect: '📖', combat: '⚔️', agility: '👟', wild: '❓' }
const AH_TYPE_ICON = { asset: '🛠️', event: '⚡', skill: '🎯', investigator: '🕵️', enemy: '👹', treachery: '🃏', location: '📍', act: '📜', agenda: '🌑' }
// 展示标签映射只存 key，取词发生在渲染期：模块顶层不能调用 t()（导入时求值会让英文不生效）。
const AH_CLASS_KEYS = { guardian: 'game.class.guardian', seeker: 'game.class.seeker', mystic: 'game.class.mystic', rogue: 'game.class.rogue', survivor: 'game.class.survivor', neutral: 'game.class.neutral', mythos: 'game.class.mythos' }
const AH_SKILL_KEYS = { willpower: 'game.skill.willpower', intellect: 'game.skill.intellect', combat: 'game.skill.combat', agility: 'game.skill.agility', wild: 'game.skill.wild' }
const AH_TYPE_KEYS = { asset: 'card.type.asset', event: 'card.type.event', skill: 'card.type.skill', investigator: 'card.type.investigator', enemy: 'card.type.enemy', treachery: 'card.type.treachery', location: 'card.type.location', act: 'card.type.act', agenda: 'card.type.agenda', story: 'card.type.story', scenario: 'card.type.scenario' }
const AH_PREY_KEYS = { bearer: 'game.prey.bearer', highestCombat: 'game.prey.highestCombat', lowestHealth: 'game.prey.lowestHealth', mostClues: 'game.prey.mostClues', lowestSanity: 'game.prey.lowestSanity', lowestAgility: 'game.prey.lowestAgility', lowestCombat: 'game.prey.lowestCombat', fewestHand: 'game.prey.fewestHand' }
const AH_SLOT_KEYS = { hand: 'game.slot.hand', 'hand x2': 'game.slot.handx2', ally: 'game.slot.ally', arcane: 'game.slot.arcane', accessory: 'game.slot.accessory', body: 'game.slot.body', tarot: 'game.slot.tarot' }
const AH_ACTION_KEYS = { fight: 'game.action.fight', evade: 'game.action.evade', engage: 'game.action.engage', move: 'game.action.move', investigate: 'game.action.investigate', advanceAct: 'game.action.advanceAct', drawCultist: 'game.action.drawCultist', draw: 'game.action.draw', resource: 'game.action.resource', endTurn: 'game.action.endTurn', locationAbility: 'game.action.locationAbility' }
const ahLabel = (keys, value) => (keys[value] ? t(keys[value]) : value)
const ahClassLabel = klass => ahLabel(AH_CLASS_KEYS, klass)
const ahSkillLabel = skill => ahLabel(AH_SKILL_KEYS, skill)
const ahTypeLabel = type => ahLabel(AH_TYPE_KEYS, type)
const ahPreyLabel = prey => ahLabel(AH_PREY_KEYS, prey)
const ahActionLabel = action => (AH_ACTION_KEYS[action] ? t(AH_ACTION_KEYS[action]) : '')

function slotLabel(slot) {
  if (!slot) return ''
  const key = AH_SLOT_KEYS[String(slot).toLowerCase()]
  return key ? t(key) : slot
}

function ahCardDef(s, code) {
  return (s.state && s.state.cards && s.state.cards[code]) || {}
}

// 卡牌实例与剧本条目常用「规则代号」（如夜之狂热的 frozenInFear），
// 而卡图、图鉴和卡牌详情只按真实卡号索引；展示前统一回落到原卡号。
function ahArtCode(s, code) {
  if (!code) return code
  return (s.state && s.state.cards && s.state.cards[code] && s.state.cards[code].originalCode) || code
}

function locationAttachments(s, loc) {
  const cards = (loc.attachments || []).map(item => typeof item === 'string' ? { code: item } : item).filter(item => item?.code)
  const identity = card => card.originalCode || ahCardDef(s, card.code).originalCode || card.code
  const include = (code, count = 1) => {
    const present = cards.filter(card => identity(card) === identity({ code })).length
    for (let i = present; i < count; i++) cards.push({ code })
  }
  if (loc.fog || loc.fogCode) include(loc.fogCode || 'obscuringFog', loc.fog || 1)
  if (loc.lockedDoorCode) include(loc.lockedDoorCode)
  const markers = UI_CARDS.locationMarkers
  if (loc.barricade || loc.barricades?.length) include(markers.barricade, Math.max(loc.barricades?.length || 0, loc.barricade ? 1 : 0))
  if (loc.arcaneBarriers) include(markers.arcaneBarrier, loc.arcaneBarriers)
  if (loc.sordidAndSilent) include(markers.sordidAndSilent, loc.sordidAndSilent)
  if (loc.searchingForIzzieSeat != null) include(markers.searchingForIzzie)
  return cards.map(card => {
    const def = ahCardDef(s, card.code)
    const resolved = def.name ? def : Object.values(s.state.cards || {}).find(item => item.originalCode === card.code) || def
    return { ...resolved, ...card }
  })
}

// 规则附属到当前密谋/场景的卡（如亚弗戈蒙之光、绑架），服务端只公开卡号。
function scriptAttachmentCards(s, codes = []) {
  return (codes || []).map(code => {
    const def = ahCardDef(s, code)
    const resolved = def.name ? def : Object.values(s.state.cards || {}).find(item => item.originalCode === code) || def
    return { ...resolved, code, originalCode: resolved.originalCode || code }
  })
}

function runtimeAttachmentCards(s, card = {}) {
  return cardAttachmentReferences(card).map(item => {
    const attachment = typeof item === 'string' ? { code: item } : item
    const def = ahCardDef(s, attachment.code)
    const resolved = def.name ? def : Object.values(s.state.cards || {}).find(entry => entry.originalCode === attachment.code) || def
    return { ...resolved, ...attachment }
  }).filter(card => card.code)
}

function renderRuntimeCardState(detail) {
  const s = viewSession()
  if (!detail.runtime || !s) return null
  const card = detail.def || {}
  const attachments = runtimeAttachmentCards(s, card)
  const enemy = card.type === 'enemy' || (card.fight != null && card.type !== 'investigator')
  const markers = cardMarkerData(card, { enemy, attachmentCount: attachments.length })
  const host = card.attachedTo
  const usage = card.id ? abilityUsageFor(s.state, card.id) : null
  // 压在调查员底下的牌（戴安娜·史丹利 / 赛菲娜·卢梭 / 画中世界）：本人拿到卡号，
  // 别人的观察投影只有 beneathCount——公开信息只有「几张」，所以这里两种都画。
  const beneath = Array.isArray(card.beneath) ? card.beneath.map(code => ({ code })) : []
  // 本人视图同时带 beneath 与 beneathCount；别人的只有 beneathCount。取两者较大值，
  // 避免旧投影/注入状态里 beneathCount 落后于 beneath 时把段落整段吃掉。
  const beneathCount = Math.max(beneath.length, Number.isFinite(card.beneathCount) ? card.beneathCount : 0)
  if (!markers.length && !attachments.length && !host && !card.exhausted && !usage && !beneathCount) return null
  const hostLabel = host && (host.name || ({ location: t('game.host.location'), enemy: t('game.host.enemy'), act: t('game.host.act'), agenda: t('game.host.agenda'), investigator: t('game.host.investigator') })[host.type] || t('detail.type.card'))
  const beneathCard = code => {
    const def = ahCardDef(s, code)
    const resolved = def.name ? def : Object.values(s.state.cards || {}).find(entry => entry.originalCode === code) || def
    const name = cardDisplayName(resolved) || code
    return h('button', { type: 'button', className: 'ah-detail-attachment-card ah-detail-beneath-card',
      'data-beneath-code': code, 'aria-label': t('game.runtime.viewBeneath', { name }),
      onclick: () => openCardDetail(s, { ...resolved, code, attachedTo: {
        type: 'investigator', name: cardDisplayName(card) || card.name || card.code,
      } }) },
      tableArt(h, resolved.originalCode || code, name), h('span', {}, name))
  }
  return h('section', { className: 'ah-runtime-card-state', 'aria-label': t('game.runtime.title') },
    h('h3', {}, t('game.runtime.title')),
    markers.length ? h('div', { className: 'ah-runtime-markers' }, markers.map(([kind, icon, label, value]) =>
      h('span', { className: 'ah-runtime-marker ah-runtime-marker-' + kind, 'data-runtime-marker': kind,
        title: `${label} ${value}`, 'aria-label': `${label} ${value}` }, tableIcon(icon), h('b', {}, value), h('small', {}, label)))) : null,
    card.exhausted ? h('p', { className: 'ah-runtime-host' }, t('game.runtime.exhausted')) : null,
    hostLabel ? h('p', { className: 'ah-runtime-host' }, t('game.runtime.attachedTo', { host: hostLabel })) : null,
    beneathCount ? h('div', { className: 'ah-detail-attachments ah-detail-beneath' },
      h('h4', {}, t('game.runtime.beneath', { count: beneathCount })),
      beneath.length
        ? beneath.map(item => beneathCard(item.code))
        : h('p', { className: 'ah-detail-beneath-hidden' }, t('game.runtime.beneathHidden'))) : null,
    usage ? h('div', { className: 'ah-detail-usage', 'aria-label': t('game.runtime.usage') },
      h('h4', {}, t('game.runtime.usage')),
      usage.abilities.map(ability => h('p', {
        className: 'ah-detail-usage-row' + (ability.used ? ' is-used' : ''),
        'data-ability-used': ability.used ? 'true' : 'false',
      }, tableIcon(ability.used ? 'hourglass' : 'star'), h('span', {}, ability.label),
      h('small', {}, t('game.runtime.limit', { limit: ability.limitText, state: ability.used ? t('game.runtime.used') : t('game.runtime.available') }))))) : null,
    attachments.length ? h('div', { className: 'ah-detail-attachments' },
      h('h4', {}, t('game.runtime.attachments', { count: attachments.length })),
      attachments.map(attachment => {
        const name = cardDisplayName(attachment) || attachment.code
        // 「如同手牌打出」的附属（原定计划 / 背包 / 宿主附属）：详情面板也给出打出按钮，
        // 否则玩家只能在牌桌上点宿主才能发现这些牌可以打。
        const playMove = card.id
          ? entityMoves(s.state, 'asset:' + card.id).find(move => move.action === 'play' && move.cardId === attachment.code)
          : null
        return h('div', { className: 'ah-detail-attachment-row' },
          h('button', { type: 'button', className: 'ah-detail-attachment-card',
            'data-attachment-code': attachment.code, 'aria-label': t('game.runtime.viewAttachment', { name }),
            onclick: () => openCardDetail(s, { ...attachment, attachedTo: {
              type: card.type || (enemy ? 'enemy' : 'card'), name: cardDisplayName(card) || card.code,
            } }) }, tableArt(h, attachment.originalCode || attachment.code, name), h('span', {}, name)),
          playMove ? h('button', { type: 'button', className: 'ah-detail-attachment-play',
            'data-attachment-play': attachment.code, title: playMove.label, 'aria-label': playMove.label,
            disabled: !!state.busy, onclick: event => { event.stopPropagation(); cardMove(playMove, s) } },
            t('game.detail.playAttached')) : null)
      })) : null)
}

function ahClassColor(s, code) {
  const d = ahCardDef(s, code)
  const cls = d.klass || 'Neutral'
  return (s.state && s.state.classColors && s.state.classColors[cls]) || '#9ca3af'
}

function ahEffStat(s, inv, skill) {
  if (inv.effectiveStats && Object.hasOwn(inv.effectiveStats, skill)) return inv.effectiveStats[skill]
  let v = inv[skill] || 0
  for (const a of (inv.assets || [])) {
    if (a.exhausted) continue
    const d = ahCardDef(s, a.code)
    if (d.statBonus && d.statBonus[skill]) v += d.statBonus[skill]
  }
  return v
}

// —— 统一卡牌展示视图：把「卡牌数据卡 / 遭遇敌人 / 诡计 / 剧情资产 / 构筑卡」归一化 ——
function cardDisplay(def) {
  if (!def) return null
  const isEnemy = def.type === 'enemy' || (def.fight != null && def.type !== 'investigator')
  const isLoc = def.type === 'location' || def.shroud != null
  const isInvestigator = def.type === 'investigator'
  const english = currentLanguage() === 'en'
  return {
    code: def.code,
    name: cardDisplayName(def),
    nameEn: english ? '' : (def.nameEn || (def.nameZh && def.name !== def.nameZh ? def.name : '')),
    subname: cardDisplaySubname(def),
    klass: (def.klass || 'neutral').toLowerCase(),
    type: def.type || (isEnemy ? 'enemy' : (isLoc ? 'location' : '')),
    cost: def.cost,
    xp: def.xp ?? 0,
    slot: def.slot || (Array.isArray(def.slots) && def.slots[0]) || null,
    slots: def.slots || (def.slot ? [def.slot] : []),
    icons: def.icons || {},
    text: cardDisplayText(def),
    flavor: cardDisplayFlavor(def),
    traits: cardDisplayTraits(def),
    subtype: def.subtype || null,
    unique: !!def.unique,
    permanent: !!def.permanent,
    exceptional: !!def.exceptional,
    exile: !!def.exile,
    doubleSided: !!def.doubleSided,
    victory: def.victory || 0,
    willpower: def.willpower, intellect: def.intellect, combat: def.combat, agility: def.agility,
    health: def.health, sanity: def.sanity,
    fight: def.fight, evade: def.evade,
    damage: def.damage, horror: def.horror,
    hunter: !!def.hunter, retaliate: !!def.retaliate, alert: !!def.alert, elite: !!def.elite, massive: !!def.massive,
    shroud: def.shroud, clues: def.clues, cluesPerInvestigator: def.cluesPerInvestigator,
    deckLimit: def.deckLimit,
    isEnemy, isLoc, isInvestigator,
    isWeakness: def.subtype === 'weakness' || def.subtype === 'basicweakness',
  }
}

function ahCardDefRaw(s, code) {
  return (s && s.state && s.state.cards && s.state.cards[code]) || {}
}

function enemyFightDisplay(enemy) {
  if (enemy.effectiveFight != null) return enemy.effectiveFight
  const code = enemy.originalCode || enemy.code
  return code === UI_CARDS.enemyDisplay.fightMinusTwo && enemy.fight === -2 ? 'X' : enemy.fight
}

function renderSkillIcons(icons) {
  if (!icons) return null
  const parts = []
  for (const [sk, n] of Object.entries(icons)) {
    const k = sk.toLowerCase()
    for (let i = 0; i < (Number(n) || 0); i++) {
      const label = ahSkillLabel(k)
      parts.push(h('span', { className: 'ah-rule-symbol', title: label, 'aria-label': label, role: 'img' }, tableIcon(({willpower:'star',intellect:'book',combat:'sword',agility:'leaf',wild:'star'})[k])))
    }
  }
  return parts.length ? h('div', { className: 'ah-card-full-icons' }, parts) : null
}

function enemyStat(symbol, kind, label, base, value) {
  const delta = typeof base === 'number' && typeof value === 'number' ? value - base : 0
  const shown = delta ? base : (value ?? '—')
  const sign = delta > 0 ? '+' : ''
  const desc = delta ? t('game.stat.descDelta', { label, base, delta: sign + delta, value }) : t('game.stat.desc', { label, value: shown })
  return h('span', { className: 'ah-enemy-stat', 'data-enemy-stat': kind, title: desc, 'aria-label': desc },
    cardSymbol(h, symbol), h('strong', {}, shown),
    delta ? h('small', { className: delta > 0 ? 'is-positive' : 'is-negative' }, sign + delta) : null)
}

// 敌人生命上限：场上实例由服务端算好（含剧本修正与每名调查员的加值）；
// 只拿到卡面时（放在一边、图鉴）按「印刷值 + 每人加值 × 调查员数」重算，
// 否则「实验体」（印刷 7、每人 +3）会显示成 7，与桌面的 10 对不上。
function enemyHealthInfo(card, def) {
  const printed = Number(card.health ?? def.health ?? 0) || 0
  const players = Number(state.session?.state?.numInvestigators) || 0
  const perInvestigator = !!(card.healthPerInvestigator ?? def.healthPerInvestigator)
  const perPlayer = Number(card.healthPerPlayerBonus ?? def.healthPerPlayerBonus) || 0
  const live = def.damageTaken != null && def.health != null
  const total = live ? Number(def.health)
    : players > 0 ? (perInvestigator ? printed * players : printed + perPlayer * players)
    : printed
  const current = live ? Math.max(0, total - (def.damageTaken || 0)) : null
  const hint = perInvestigator ? t('game.enemy.healthHintEach', { value: printed }) : perPlayer > 0 ? t('game.enemy.healthHintEachBonus', { value: perPlayer }) : ''
  // 只有「印刷值 + 加值」正好等于当前上限时才把算式写进提示；
  // 剧本另有修正时（如 02255 失去 +1/人），只保留数值，避免算式和总数对不上。
  const expected = players > 0 ? (perInvestigator ? printed * players : printed + perPlayer * players) : printed
  const parts = []
  if (expected === total) {
    if (perInvestigator) parts.push(t('game.enemy.printedPerInvestigator', { printed }))
    else if (perPlayer) parts.push(t('game.enemy.printedPerPlayer', { printed, perPlayer }))
    if (players > 0 && (perInvestigator || perPlayer)) parts.push(t('game.enemy.playerCount', { players }))
  }
  return { total, current, hint, breakdown: parts.join(t('game.list.commaSeparator')) }
}

function enemyHealthRow(info) {
  const { total, current, hint, breakdown } = info
  const fill = current == null ? 100 : total > 0 ? Math.min(100, current / total * 100) : 0
  const desc = (current == null ? t('game.enemy.healthOf', { total }) : t('game.enemy.healthCurrent', { current, total })) + (breakdown ? t('game.enemy.healthBreakdown', { breakdown }) : '')
  return h('div', { className: 'ah-enemy-health' + (hint ? ' has-hint' : ''), 'aria-label': desc, title: desc },
    tableIcon('health'), h('span', { className: 'ah-enemy-health-label' }, t('game.enemy.health')),
    h('span', { className: 'ah-enemy-health-value' }, current == null ? h('strong', {}, total) : [h('strong', {}, current), h('small', {}, '/ ' + total)]),
    hint ? h('small', { className: 'ah-enemy-health-hint' }, hint) : null,
    h('span', { className: 'ah-enemy-health-track', 'aria-hidden': 'true' }, h('i', { style: { width: fill + '%' } })))
}

// 完整卡牌渲染（用于卡牌详情弹窗与卡组构筑）。
function renderFullCard(def) {
  const d = cardDisplay(def)
  if (!d) return h('div', { className: 'ah-card-full' }, '?')
  const color = (state.session && state.session.state.classColors && state.session.state.classColors[d.klass]) || AH_CLASS_COLOR[d.klass] || '#9ca3af'
  const clsName = (state.session && state.session.state.classNames && state.session.state.classNames[d.klass]) || ahClassLabel(d.klass) || d.klass

  const badges = []
  if (d.cost != null) badges.push(h('span', { className: 'ah-cfcost' }, d.cost))
  if (d.xp) badges.push(h('span', { className: 'ah-cfxp' }, '✦ ' + d.xp))

  const statRows = []
  if (d.isInvestigator) {
    statRows.push(h('div', { className: 'ah-card-full-stats' },
      h('span', null, cardSymbol(h, 'health'), ' ' + d.health),
      h('span', null, cardSymbol(h, 'sanity'), ' ' + d.sanity),
      h('span', null, cardSymbol(h, 'willpower'), ' ' + d.willpower),
      h('span', null, cardSymbol(h, 'intellect'), ' ' + d.intellect),
      h('span', null, cardSymbol(h, 'combat'), ' ' + d.combat),
      h('span', null, cardSymbol(h, 'agility'), ' ' + d.agility)
    ))
  }
  if (d.type === 'asset' && (d.health != null || d.sanity != null)) {
    statRows.push(h('div', { className: 'ah-card-full-stats' },
      d.health != null ? h('span', null, cardSymbol(h, 'health'), ' ' + t('game.card.healthValue', { value: d.health })) : null,
      d.sanity != null ? h('span', null, cardSymbol(h, 'sanity'), ' ' + t('game.card.sanityValue', { value: d.sanity })) : null
    ))
  }
  if (d.isEnemy) {
    const card = ahCardDefRaw(state.session, def.code)
    const printed = key => card[key] ?? def[key]
    statRows.push(h('div', { className: 'ah-card-full-stats' },
      enemyStat('combat', 'fight', t('game.stat.fight'), enemyFightDisplay({ code: def.code, originalCode: def.originalCode, fight: printed('fight') }), enemyFightDisplay(def)),
      enemyStat('agility', 'evade', t('game.stat.evade'), printed('evade'), def.effectiveEvade ?? def.evade),
      enemyStat('health', 'damage', t('game.stat.damage'), printed('damage') || 0, def.damage || 0),
      enemyStat('sanity', 'horror', t('game.stat.horror'), printed('horror') || 0, def.horror || 0)
    ))
    statRows.push(enemyHealthRow(enemyHealthInfo(card, def)))
    const enemyKws = []
    if (d.hunter) enemyKws.push(t('game.kw.hunter'))
    if (d.retaliate) enemyKws.push(t('game.kw.retaliate'))
    if (d.alert) enemyKws.push(t('game.kw.alert'))
    if (d.elite) enemyKws.push(t('game.kw.elite'))
    if (d.massive) enemyKws.push(t('game.kw.massive'))
    if (d.victory) enemyKws.push(t('game.kw.victory', { points: d.victory }))
    if (enemyKws.length) statRows.push(h('div', { className: 'ah-card-full-kws' },
      enemyKws.map((k) => h('span', { className: 'ah-kw ah-kw-flag' }, k))))
  }
  if (d.isLoc) {
    statRows.push(h('div', { className: 'ah-card-full-stats' },
      d.shroud != null ? h('span', null, t('game.location.shroudValue', { value: d.shroud })) : null,
      h('span', null, d.cluesPerInvestigator != null ? t('game.location.cluesPerInvestigator', { count: d.cluesPerInvestigator }) : t('game.location.clueCount', { count: d.clues || 0 }))
    ))
  }

  const kws = []
  if (d.slot) kws.push(t('game.card.slot', { slot: slotLabel(d.slot) }))
  if (d.traits && d.traits.length) kws.push(t('game.card.traits', { traits: d.traits.join(' / ') }))
  const flags = []
  if (d.isWeakness) flags.push(t('game.flag.weakness'))
  if (d.unique) flags.push(t('game.flag.unique'))
  if (d.permanent) flags.push(t('game.flag.permanent'))
  if (d.exceptional) flags.push(t('game.flag.exceptional'))
  if (d.exile) flags.push(t('game.flag.exile'))
  if (d.doubleSided) flags.push(t('game.flag.doubleSided'))
  if (d.victory && !d.isEnemy) flags.push(t('game.kw.victory', { points: d.victory }))
  if (flags.length) kws.push(flags.join(' · '))

  return h('div', { className: 'ah-card-full', style: { borderTop: '3px solid ' + color } },
    h('div', { className: 'ah-card-full-top' },
      h('div', { className: 'ah-card-full-badges' }, badges),
      h('div', { className: 'ah-card-full-meta' }, tableIcon(({act:'book',agenda:'eye',enemy:'sword',investigator:'ally',asset:'supply',location:'clue',treachery:'doom'})[d.type] || 'star'), ' ' + ahTypeLabel(d.type) + ' · ' + clsName)
    ),
    h('div', { className: 'ah-card-full-name' }, d.name),
    d.subname ? h('div', { className: 'ah-card-full-sub' }, d.subname) : null,
    d.nameEn ? h('div', { className: 'ah-card-full-nameen' }, d.nameEn) : null,
    renderSkillIcons(d.icons),
    statRows,
    kws.length ? h('div', { className: 'ah-card-full-kws' }, kws.map((k) => h('span', { className: 'ah-kw' }, k))) : null,
    d.text ? h('div', { className: 'ah-card-full-text' }, renderRulesText(h, d.text)) : null,
    d.flavor ? h('div', { className: 'ah-card-full-flavor' }, d.flavor) : null
  )
}

function openCardDetail(s, reference) {
  const code = typeof reference === 'string' ? reference : reference.code
  const def = { ...ahCardDefRaw(s, code), ...(typeof reference === 'object' ? reference : {}) }
  openCardDetailDef(def, { runtime: true })
}

function openCardDetailDef(def, { runtime = !!state.session && !state.setup, side = null, interactionKey = null, focusInfo = null } = {}) {
  if (!def) return
  const initialCode = def.originalCode || def.code || def.artCode
  if (!def.name && !def.nameZh && !initialCode) return
  if (!def.name) def = { ...def, name: def.nameZh || initialCode }
  const location = runtime && viewSession()?.state.locations?.find(loc => loc.id === def.id || (def.type === 'location' && (loc.originalCode || loc.code) === (def.originalCode || def.code)))
  if (location) { def = { ...def, ...location, type: 'location' }; interactionKey ||= 'location:' + location.id }
  const code = def.originalCode || def.code || def.artCode
  const detail = { code, def, runtime, side: side || (location && !location.revealed ? 'back' : 'front'), interactionKey, locationId: location?.id, focusInfo, loading: !!code }
  state.cardDetail = detail
  render()
  if (!code) return
  getCardPresentation(code).then(entry => {
    if (state.cardDetail !== detail) return
    detail.entry = entry
  }).catch(error => {
    if (state.cardDetail !== detail) return
    detail.error = error.message
  }).finally(() => {
    if (state.cardDetail !== detail) return
    detail.loading = false
    render()
  })
}

// 地点特性（trait）的显示模型：已揭示地点显示印刷特性；未揭示地点只显示效果在运行时授予的
// 特性（03141 皮博迪先生可让未揭示地点获得 [[通道]]，玩家必须能在地图上看见）。中英标签都由
// 观察投影给出（traits/traitsZh、grantedTraits/grantedTraitsZh 逐位对应），缺失时逐项回退，
// 浏览器不导入 src/ 的卡池译名表。
function locationTraitPairs(loc) {
  if (!loc) return []
  const pairs = []
  const seen = new Set()
  const add = (english, localized) => {
    const en = Array.isArray(english) ? english : []
    const zh = Array.isArray(localized) ? localized : []
    const length = Math.max(en.length, zh.length)
    for (let index = 0; index < length; index++) {
      const enLabel = typeof en[index] === 'string' ? en[index].trim() : ''
      const zhLabel = typeof zh[index] === 'string' ? zh[index].trim() : ''
      if (!enLabel && !zhLabel) continue
      const key = (enLabel || zhLabel).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push({ en: enLabel, zh: zhLabel })
    }
  }
  if (loc.revealed) add(loc.traits, loc.traitsZh)
  add(loc.grantedTraits, loc.grantedTraitsZh)
  return pairs
}

function locationTraitLabel(pair) {
  return currentLanguage() === 'en' ? (pair.en || pair.zh) : (pair.zh || pair.en)
}

// 地图上只给「通道」这一个规则关键字做徽记（一楼/二楼/三楼这类楼层特性只在地点档案里列出，
// 否则地图会被特性胶囊塞满）。
function locationTraitBadges(loc) {
  return locationTraitPairs(loc).filter(pair =>
    String(pair.en || pair.zh).toLowerCase() === 'passageway')
}

function renderLocationDetail(detail) {
  const s = viewSession(), st = s.state
  const loc = st.locations.find(item => item.id === detail.locationId) || detail.def
  const front = detail.side === 'front' && loc.revealed
  const face = cardFaceText(detail.entry?.card || detail.def, detail.entry?.linkedCard, front ? 'front' : 'back')
  const rules = front ? cardDisplayText(face) : [face.text === t('card.back.generic') ? '' : face.text, face.flavor].filter(Boolean).join('\n\n')
  const plain = text => String(text || '').replace(/<[^>]+>/g, '').replace(/\[action\]/g, t('game.ruleText.action')).replace(/\[reaction\]/g, t('game.ruleText.reaction'))
    .replace(/\[(willpower|intellect|combat|agility)\]/g, (_,key) => ahSkillLabel(key))
  const entryEffect = loc.onEnter
  const entering = [entryEffect?.damage ? t('game.location.enterDamage', { amount: entryEffect.damage }) : '', entryEffect?.horror ? t('game.location.enterHorror', { amount: entryEffect.horror }) : '',
    entryEffect?.test ? t('game.location.enterTest', { skill: st.skillNames?.[entryEffect.test.skill] || ahSkillLabel(entryEffect.test.skill), difficulty: entryEffect.test.difficulty }) : ''].filter(Boolean)
  // loc 是观察投影后的地点：`shroud` 已经含 shroudMod / 迷雾 / 剧本修正 / 皮博迪先生的 -1，
  // 这里不能再叠一次（旧实现重复计算 shroudMod 与 fogMod，皮博迪的 -1 也进不了弹窗）。
  const counters = [
    ['shroud','eye',t('game.stat.shroud'),loc.revealed ? (loc.shroud ?? 0) : t('game.value.unknown')],
    ['clues','clue',t('game.token.clue'),loc.clues || 0],['doom','doom',t('game.token.doom'),loc.doom || 0],['resources','resource',t('game.token.resource'),loc.resources || 0],
  ]
  // 地点特性/关键字：已揭示显示印刷特性，未揭示只显示效果授予的特性（皮博迪先生的 [[通道]]）。
  const traitPairs = locationTraitPairs(loc)
  const traitChips = traitPairs.length ? h('section',{className:'ah-location-traits'+(detail.focusInfo === 'traits' ? ' is-focused' : '')},
    h('h3',{},t('game.location.traits')),
    h('div',{},traitPairs.map(pair => h('span',{className:'ah-kw','data-trait':pair.en || pair.zh},locationTraitLabel(pair))))) : null
  const decision = decisionSeatOf(s)
  const moves = !state.busy && !presentation.isBlocking && canAct(s, decision) ? entityMoves(st,'location:' + loc.id) : []
  const usedHints = !state.busy && !presentation.isBlocking && canAct(s, decision) ? usedActionHints(st, loc.id) : []
  const people = st.investigators.filter(inv => inv.location === loc.id && !inv.defeated && !inv.resigned)
  const enemies = st.enemies.filter(enemy => enemy.location === loc.id)
  const attachments = [...locationAttachments(s, loc), ...(st.storyAssets || []).filter(asset => asset.location === loc.id).map(asset => ({...ahCardDef(s,asset.code),...asset}))]
  return h('div', { className: 'ah-location-dossier' },
    h('header', {}, h('small', {}, t('game.location.header')),h('h2', {},loc.name),h('span', {className:'ah-location-state'},loc.revealed ? t('game.location.revealed') : t('game.location.hidden'))),
    h('div',{className:'ah-location-detail-layout'},
      h('div',{className:'ah-location-detail-art'},
        renderImage(h,detail.entry?.images || detail.entry?.card?.images || detail.def.images,front ? 'front' : 'back'),
        h('nav',{'aria-label':t('game.location.facesAria')},[['front',t('game.location.revealed')],['back',t('game.location.hidden')]].map(([side,label]) => h('button',{
          disabled:side === 'front' && !loc.revealed,'aria-pressed':String(detail.side === side),
          onclick:()=>{detail.side=side;render()},title:side === 'front' && !loc.revealed ? t('game.location.revealHint') : t('game.location.viewFace', { face: label }),
        },label)))),
      h('div',{className:'ah-location-detail-info'},
        h('div',{className:'ah-location-counters','aria-label':t('game.location.statusAria')},counters.map(([key,icon,label,value]) => h('div',{
          className:detail.focusInfo === key ? 'is-focused' : '', 'data-location-stat':key,
        },tableIcon(icon),h('strong',{},value),h('small',{},label)))),
        traitChips,
        front ? h('section',{className:'ah-location-entry-effect'},h('h3',{},t('game.location.enterTitle')),h('p',{},entering.length ? entering.join(t('game.list.semicolon')) : t('game.location.noEntryPenalty')))
          : h('section',{className:'ah-location-entry-effect'},h('h3',{},t('game.location.exploreTitle')),h('p',{},loc.revealed ? t('game.location.previewBack') : t('game.location.previewBackHint'))),
        h('section',{className:'ah-location-rules'},h('h3',{},front ? t('game.location.rulesEffects') : t('game.location.rulesDescription')),
          h('p',{},renderRulesText(h,plain(rules) || (front ? t('game.location.noEffects') : t('game.location.enterForMore')))),
          h('div',{},...cardRuleIds(loc).map(id=>ruleLink(h,id)),ruleLink(h,'clues',t('game.rule.clues')),ruleLink(h,'encounter',t('game.rule.encounter'))),
          front && loc.resign ? h('span',{className:'ah-location-trait'},t('game.location.resign')) : null,
          front && loc.victory ? h('span',{className:'ah-location-trait'},t('game.kw.victory', { points: loc.victory })) : null,
          loc.locked ? h('span',{className:'ah-location-trait is-danger'},t('game.location.locked')) : null),
        h('section',{className:'ah-location-occupants'},h('h3',{},t('game.location.occupants')),
          people.length || enemies.length ? h('div',{},
            people.map(inv=>h('button',{className:'is-investigator',onclick:()=>openCardDetailDef({...st.investigatorDefs[inv.code],...inv,type:'investigator'})},tableArt(h,inv.code,inv.name),h('span',{},inv.name))),
            enemies.map(enemy=>h('button',{className:'is-enemy',onclick:()=>openCardDetail(s,enemy)},tableArt(h,enemy.originalCode || enemy.code,enemy.name),h('span',{},enemy.name)))) : h('p',{},t('game.location.noOccupants'))),
        attachments.length ? h('section',{className:'ah-location-attachments'+(detail.focusInfo === 'attached' ? ' is-focused' : '')},h('h3',{},t('game.location.attachments')),
          attachments.map(card=>h('button',{onclick:()=>openCardDetail(s,{...card,attachedTo:{type:'location',name:loc.name}})},cardDisplayName(card) || card.code))) : null,
        h('section',{className:'ah-location-connections'},h('h3',{},t('game.location.connections')),h('div',{},(loc.connections || []).map(id=>st.locations.find(item=>item.id===id)).filter(Boolean).map(other=>
          h('button',{onclick:()=>openCardDetailDef({...other,type:'location'})},'→ '+other.name)))),
        h('footer',{className:'ah-location-detail-actions'},moves.length ? moves.map(move=>h('button',{className:'ah-action',onclick:()=>{state.cardDetail=null;cardMove(move,s)}},move.label || (ahActionLabel(move.action) || t('game.action.generic'))))
          : usedHints.length ? null : h('span',{},t('game.location.noActions')),
          // 「每场游戏一次」的行动用掉后不再出现在 legalMoves；这里保留一行置灰说明，
          // 免得玩家以为地点能力坏了（内容层在提示上打 used 标记，见 view.usedActions）。
          usedHints.map(hint=>h('button',{className:'ah-action is-used',disabled:true,title:hint.reason || t('game.used.thisGame'),'data-ability-used':'true'},t('game.used.prefix', { label: hint.label })))))),
    detail.loading ? h('p',{className:'ah-location-loading',role:'status'},t('game.location.loading')) : null,
    detail.error ? h('p',{className:'ah-location-loading',role:'status'},t('game.location.loadError')) : null)
}

function renderCardDetailModal(detail) {
  const close = () => { state.cardDetail = null; render() }
  return h('div', { className: 'bg-backdrop ah-carddetail-backdrop' },
    h('div', { className: 'bg-modal ah-carddetail-modal' + (detail.locationId ? ' ah-location-detail' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': t('game.detail.aria'), onclick: event => event.stopPropagation(), onkeydown: event => { if (event.key === 'Escape') close() } },
      h('button', { className: 'ah-carddetail-close', 'aria-label': t('game.detail.closeAria'), onclick: close }, t('common.close')),
      detail.locationId ? renderLocationDetail(detail) : renderDetailContent(h, detail, renderFullCard, render, viewSession()?.state),
      !detail.locationId ? renderRuntimeCardState(detail) : null,
      !detail.locationId ? renderReactionToggle(viewSession(),detail.def.code) : null,
      !detail.locationId && detail.interactionKey && state.session && !presentation.isBlocking && !state.session.state.pendingChoice &&
        canAct(state.session, state.session.state.currentSeat) && entityMoves(state.session.state, detail.interactionKey).length
        ? h('button', { className: 'ah-action', disabled: state.busy, onclick: () => {
          state.cardDetail = null; selectEntity(state.session, detail.interactionKey)
        } }, t('game.detail.targetAction')) : null
    )
  )
}

function zoneCards(s, kind) {
  // 复仇点数用虚拟卡记在胜利区；弹窗只列真实卡牌，复仇合计单独显示。
  if (kind === 'victory') {
    return (s.state.victoryDisplay || [])
      .map(card => typeof card === 'string' ? { code: card } : card)
      .filter(card => !card.virtual)
  }
  return (s.state.setAsideCards || []).flatMap(card =>
    Array.from({ length: Math.max(0, card.count || 1) }, () => ({ ...card, count: undefined })))
}

function renderCardZoneModal(s) {
  const opened = state.arkhamZoneOpen
  if (!opened || opened.sessionId !== s.sessionId) return null
  const victory = opened.kind === 'victory'
  const cards = zoneCards(s, opened.kind)
  const title = victory ? t('table.victory') : t('game.zone.asideTitle')
  const close = () => { state.arkhamZoneOpen = null; render() }
  const points = victory ? cards.reduce((sum, card) => sum + (card.victory ?? ahCardDefRaw(s, card.code).victory ?? 0), 0) : 0
  const vengeance = victory
    ? (s.state.victoryDisplay || []).reduce((sum, card) => sum + (card.vengeance || 0), 0)
    : 0
  return h('div', { className: 'bg-backdrop ah-card-zone-backdrop', onclick: close },
    h('section', { className: 'ah-card-zone-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title,
      onclick: event => event.stopPropagation(), onkeydown: event => { if (event.key === 'Escape') close() } },
      h('header', {},
        h('div', {}, h('small', {}, victory ? 'SCENARIO / VICTORY DISPLAY' : 'SCENARIO / SET ASIDE'),
          h('h2', {}, tableIcon(victory ? 'star' : 'supply'), title),
          h('p', {}, victory
            ? t('game.zone.victorySummary', { count: cards.length, points }) + (vengeance ? t('game.zone.vengeance', { points: vengeance }) : '')
            : t('game.zone.asideSummary', { count: cards.length }))),
        h('button', { className: 'ah-card-zone-close', 'aria-label': t('game.zone.closeAria', { title }), onclick: close }, t('common.close'))),
      cards.length ? h('div', { className: 'ah-card-zone-grid', role: 'group', 'aria-label': t('game.zone.cardsAria', { title }) },
        cards.map((card, index) => {
          const def = { ...ahCardDefRaw(s, card.code), ...card }
          const name = cardDisplayName(def) || card.code
          const code = def.originalCode || card.originalCode || card.code
          return h('button', { className: 'ah-card-zone-card', 'data-zone-card': card.code,
            'aria-label': t('game.zone.view', { name }), title: t('game.zone.viewDetail', { name }), onclick: () => openCardDetail(s, def) },
            h('span', { className: 'ah-card-zone-art' }, tableArt(h, code, name)),
            h('span', { className: 'ah-card-zone-caption' }, h('strong', {}, name),
              victory ? h('small', {}, t('game.kw.victory', { points: def.victory || 0 })) : h('small', {}, t('game.zone.file', { index: String(index + 1).padStart(2, '0') }))))
        })) : h('div', { className: 'ah-card-zone-empty' }, tableIcon(victory ? 'star' : 'supply'),
          h('strong', {}, victory ? t('game.zone.emptyVictory') : t('game.zone.emptyAside')),
          h('span', {}, victory ? t('game.zone.emptyVictoryHint') : t('game.zone.emptyAsideHint'))),
      h('footer', {}, victory ? t('game.zone.victoryFooter') : t('game.zone.asideFooter'))))
}

async function cardMove(move, displayedSession, options = {}) {
  const session = state.session
  if (!session || state.busy || presentation.isBlocking || session.sessionId !== displayedSession.sessionId) return
  const st = session.state
  const pending = st.pendingChoice
  const seat = decisionSeatOf(session)
  if (st.status !== 'playing' || !canAct(session, seat)) return
  if (st.revision !== displayedSession.state.revision) return
  if (pending ? move.action !== 'choose' || move.choiceId !== pending.id : move.action === 'choose') return
  const draft = choiceDraft(session)
  if (draft && /^\d+$/.test(String(move.optionId))) {
    const index = Number(move.optionId)
    const code = st.investigators[seat]?.hand[index]
    if (!code) return
    const existing = draft.selected.findIndex(item => item.index === index)
    if (existing >= 0) draft.selected.splice(existing, 1)
    else {
      if (pending.kind === 'commit' && st.skillTest?.seat !== seat && draft.selected.length) return
      draft.selected.push({ index, code })
    }
    state.error = ''
    render()
    return
  }
  const batchChoices = draft?.selected.length && ['done', 'help'].includes(move.optionId)
    ? { choiceId: pending.id, kind: pending.kind, selected: draft.selected.map(item => ({ ...item })), finish: move.optionId } : null
  state.busy = true
  state.movePending = { sessionId: session.sessionId, seat, action: move.action }
  cancelTableGesture()
  state.arkhamDirectActions = null
  state.arkhamTargetAbility = null
  state.error = ''
  const watchPreparation = move.action === 'hubDoneSeat' && st.hubFlow && session.players.some(p => p.role === 'ai')
  if (watchPreparation) {
    state.arkhamHubPending = { sessionId: session.sessionId, seat }
    state.arkhamHubTab = 'departure'
  }
  render()
  let waiting = true, progressTimer
  const sameSession = () => state.session?.sessionId === session.sessionId
  const pollProgress = async () => {
    if (!waiting || !sameSession()) return
    try {
      const result = await api('GET', '/session?sessionId=' + encodeURIComponent(session.sessionId))
      if (waiting && sameSession() && result.session &&
          (result.session.state.revision > state.session.state.revision || result.session.events.length > state.session.events.length)) {
        state.session = result.session
        render()
      }
    } catch { /* The submitted move remains the authority for success/errors. */ }
    if (waiting && sameSession()) progressTimer = setTimeout(pollProgress, 500)
  }
  // /move waits for the AI loop. Read committed revisions while it is pending
  // so the presentation queue can run during model latency, not only afterward.
  progressTimer = setTimeout(pollProgress, 150)
  try {
    const { label, ...mv } = move
    const version = Number.isSafeInteger(st.revision) ? { revision: st.revision } : {}
    // 三态覆盖随 move 捎带：切完马上行动也不会丢；空对象=清除本座位覆盖。
    // seq 让房主丢弃乱序到达的旧偏好；旧房主会忽略未知的 client 字段。
    const seat = mySeat(session)
    const autoStates = reactionStates(session.sessionId, seat)
    const r = await api('POST', '/move', { sessionId: session.sessionId, ...version,
      client: { autoPrefs: { states: autoStates, seq: reactionPrefsSeq(session.sessionId, seat) } }, ...(batchChoices
        ? { batchChoices } : { move: { ...mv, ...version } }) })
    if (sameSession()) {
      // P1.2：联机客人拿到的命令响应只有摘要（无 session），权威状态随后由快照 + 长轮询送达；
      // 这里不能把 state.session 覆盖成 undefined，也不要用缺失的 session 计算反馈 revision。
      if (r.session) state.session = r.session
      if (batchChoices) state.arkhamChoiceDraft = null
      state.arkhamSelection = null
      if (state.arkhamMapView) state.arkhamMapView.selectedId = null
      clearCardDrag()
      const revision = Number.isSafeInteger(r.revision) ? r.revision : r.session?.state?.revision ?? st.revision
      const feedback = { sessionId: session.sessionId, revision, label: move.label || t('game.move.confirmed') }
      state.arkhamAcceptedFx = feedback
      setTimeout(() => { if (state.arkhamAcceptedFx === feedback) { state.arkhamAcceptedFx = null; render() } }, 900)
    }
  } catch (e) {
    if (sameSession()) {
      const fresh = e.session
      if (fresh?.sessionId === session.sessionId && fresh.state &&
          (!Number.isSafeInteger(st.revision) || fresh.state.revision >= st.revision)) {
        state.session = fresh
      }
      // 自动提交的 skip 遇到版本已推进/房主忙碌是预期内的竞争（对局已经继续），不弹错误提示。
      // 直连错误可能没有 code，退回到文案匹配（这些文案只在“提交落后于服务端”时出现）。
      // 服务端中文错误文案的兼容匹配：用 \\u 转义写正则，避免被「UI 无中文」守卫误判（docs/localization.md §6.1 控制台日志不要求本地化）。
      const autoRace = options.auto && (['STALE_REVISION', 'SESSION_BUSY'].includes(e.code)
        || /\u5bf9\u5c40\u7248\u672c\u5df2\u53d8\u5316|\u6b63\u5728\u5904\u7406|\u7a0d\u540e\u91cd\u8bd5|\u7248\u672c\u53f7/.test(String(e.message)))
      if (autoRace) console.warn('[autoPass] auto-skip submit fell behind server state: ' + String(e.message))
      else state.error = String(e.message)
      state.arkhamSelection = null
      if (state.arkhamMapView) state.arkhamMapView.selectedId = null
      clearCardDrag()
    }
  } finally {
    waiting = false
    clearTimeout(progressTimer)
    if (watchPreparation && state.arkhamHubPending?.sessionId === session.sessionId) state.arkhamHubPending = null
    if (state.movePending?.sessionId === session.sessionId) state.movePending = null
    state.busy = false
    render()
  }
}

function choiceDraft(s) {
  const choice = s?.state?.pendingChoice
  if (!s?.online || !['mulligan', 'commit'].includes(choice?.kind) || choice.seat !== mySeat(s)) return null
  const key = `${s.sessionId}:${s.state.revision}:${choice.id}:${choice.seat}`
  if (state.arkhamChoiceDraft?.key !== key) state.arkhamChoiceDraft = { key, selected: [] }
  return state.arkhamChoiceDraft
}

function currentSelection(s) {
  const selected = state.arkhamSelection
  if (!selected || selected.sessionId !== s.sessionId || selected.revision !== s.state.revision) return null
  return selected
}

function selectCard(s, selection, focusActions = false) {
  if (state.busy) return
  if (state.arkhamMapView) state.arkhamMapView.selectedId = selection.key?.startsWith('location:') ? selection.key.slice(9) : null
  const current = currentSelection(s)
  selection.key ||= selection.assetId ? `asset:${selection.assetId}` : `hand:${s.state.investigators.find(inv => inv.seat === mySeat(s))?.seat}:${selection.handIndex}`
  state.arkhamDirectActions = null
  state.arkhamTargetAbility = null
  state.arkhamSelection = current?.key === selection.key
    ? null : { sessionId: s.sessionId, revision: s.state.revision, ...selection }
  render()
  if (focusActions && state.arkhamSelection) queueMicrotask(() => (document.querySelector('.ah-equip-slot.ah-drop-valid') || document.querySelector('.ah-drop-valid, .ah-card-action-popover .ah-action, .ah-table-actions .ah-action'))?.focus())
}

function handCommitMove(s, index) {
  if (s.state.pendingChoice?.kind !== 'commit') return null
  return (s.state.legalMoves || []).find(move => move.action === 'choose' && move.optionId === String(index)) || null
}

function choiceTargetMove(s, id) {
  if (s.state.pendingChoice?.kind !== 'target') return null
  return (s.state.legalMoves || []).find(move => move.action === 'choose' && move.optionId === String(id)) || null
}

function selectedMoves(s, selection) {
  if (selection.key) return entityMoves(s.state, selection.key)
  const moves = s.state.legalMoves || []
  return selection.assetId ? moves.filter(move => move.action === 'ability' && move.assetId === selection.assetId)
    : moves.filter(move => move.action === 'play' && move.cardId === selection.code)
}

function entityDefinition(s, key) {
  const [kind, ...parts] = key.split(':'); const id = parts.join(':')
  if (kind === 'hand') return ahCardDef(s, s.state.investigators.find(inv => inv.seat === Number(parts[0]))?.hand?.[Number(parts[1])])
  // 压在调查员底下的牌 / 直觉牌库揭示的牌：key 的第二段就是卡号本身。
  if (kind === 'beneath' || kind === 'hunch') return ahCardDef(s, id)
  if (kind === 'asset') {
    const asset = s.state.investigators.flatMap(inv => [...inv.assets, ...(inv.threat || [])]).find(a => a.id === id)
    return asset ? { ...ahCardDef(s, asset.code), ...asset } : {}
  }
  if (kind === 'enemy') return s.state.enemies.find(e => e.id === id) || {}
  if (kind === 'location') return s.state.locations.find(l => l.id === id) || {}
  if (kind === 'investigator') return s.state.investigators.find(inv => inv.seat === Number(id)) || {}
  if (kind === 'act') return { ...s.state.acts[s.state.actIndex], type: 'act' }
  if (kind === 'agenda') return { ...s.state.agendas[s.state.agendaIndex], type: 'agenda' }
  return ahCardDef(s, entityMoves(s.state, key)[0]?.cardId)
}

function inspectEntity(s, key) { openCardDetailDef(entityDefinition(s, key), { interactionKey: key }) }
function selectEntity(s, key) {
  const def = entityDefinition(s, key)
  selectCard(s, { key, code: def.code, assetId: key.startsWith('asset:') ? key.slice(6) : undefined })
}

function renderCardActionPopover(s, humanTurn) {
  const selection = currentSelection(s)
  const explicit = state.arkhamDirectActions?.sessionId === s.sessionId && state.arkhamDirectActions.revision === s.state.revision ? state.arkhamDirectActions.moves : null
  if (!explicit && state.arkhamTargetAbility?.sessionId === s.sessionId && state.arkhamTargetAbility.revision === s.state.revision) return null
  // Cards with one destination are used on that destination. Multiple abilities stay next to their source.
  const moves = explicit || (selection && !selection.key?.startsWith('hand:') ? selectedMoves(s, selection) : [])
  // 上限已经用掉的能力仍列出来（置灰），否则「点开这张卡没有任何按钮」和
  // 「这张卡本来就没有能力」看起来一模一样。
  const usedRows = !explicit && selection?.assetId ? usedAbilityLines(abilityUsageFor(s.state, selection.assetId)) : []
  if (!moves.length && !usedRows.length) return null
  const grouped = new Map()
  for (const move of moves) {
    const group = move.targetId ? `${move.action}:${move.assetId}:${move.abilityIndex}:${move.optionIndex ?? ''}` : JSON.stringify(move)
    if (!grouped.has(group)) grouped.set(group, [])
    grouped.get(group).push(move)
  }
  const popover = h('div', { className: 'ah-card-action-popover', role: 'group', 'aria-label': t('game.popover.aria'),
    onkeydown: event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      state.arkhamSelection = null; state.arkhamDirectActions = null; state.arkhamTargetAbility = null; render()
    } },
    [...grouped.values()].map(group => {
      const m = group[0]
      return h('button', { className: 'ah-action', disabled: state.busy || !humanTurn, title: m.label, 'aria-label': m.label, 'data-location-move': m.action === 'move' ? m.locationId : null,
        onclick: () => {
          if (group.length === 1) cardMove(m, s)
          else { state.arkhamTargetAbility = { sessionId: s.sessionId, revision: s.state.revision, assetId: m.assetId, abilityIndex: m.abilityIndex, optionIndex: m.optionIndex }; state.arkhamDirectActions = null; render() }
        } }, tableIcon(({ fight: 'sword', evade: 'leaf', move: 'action', investigate: 'clue', ability: 'star' })[m.action] || 'book'),
      group.length > 1 ? t('game.popover.target') : (ahActionLabel(m.action) || renderRulesText(h,m.label,{links:false})))
    }),
    usedRows.map(text => h('button', { className: 'ah-action is-used', disabled: true, title: text, 'aria-label': text, 'data-ability-used': 'true' },
      tableIcon('hourglass'), text)),
    h('button', { className: 'ah-action secondary', onclick: () => { state.arkhamSelection = null; state.arkhamDirectActions = null; state.arkhamTargetAbility = null; render() } }, t('common.cancel')))
  requestAnimationFrame(() => {
    if (!popover.isConnected) return
    const action = popover.querySelector('.ah-action:not(:disabled)')
    if (action && !popover.contains(document.activeElement)) action.focus({ preventScroll: true })
    const source = [...document.querySelectorAll('[data-interaction]')].find(el => el.dataset.interaction === selection?.key)
    const box = source?.getBoundingClientRect()
    if (box) { popover.style.left = Math.max(8, Math.min(innerWidth - popover.offsetWidth - 8, box.x + box.width / 2 - popover.offsetWidth / 2)) + 'px'; popover.style.top = Math.max(65, Math.min(innerHeight - popover.offsetHeight - 12, box.y - popover.offsetHeight - 8)) + 'px' }
  })
  return popover
}

async function refreshCardSession(displayedSession) {
  const session = state.session
  if (!session || state.busy || session.sessionId !== displayedSession.sessionId) return
  state.busy = true
  render()
  try {
    const response = await api('GET', '/session?sessionId=' + encodeURIComponent(session.sessionId))
    if (state.session === session && response.session?.sessionId === session.sessionId &&
        (!Number.isSafeInteger(session.state.revision) || response.session.state.revision >= session.state.revision)) {
      state.session = response.session
      state.arkhamSync = {
        sessionId: session.sessionId,
        message: response.busy ? t('game.sync.busy') : t('game.sync.refreshed'),
      }
    }
  } catch (error) {
    if (state.session === session) state.error = String(error.message)
  } finally {
    state.busy = false
    render()
  }
}

function renderChoiceText(h, label) {
  const symbolized = String(label ?? '').replace(/\b(combat|agility|intellect|willpower)\b/gi, (_, skill) => `[${skill.toLowerCase()}]`)
  return renderRulesText(h, symbolized, { links: false })
}

function renderPendingChoice(s, humanTurn) {
  const choice = s.state.pendingChoice
  if (!choice) return null
  if(choice.kind==='payment' && choice.source==='group-clues')return renderCluePayment(s,humanTurn)
  // 万象无终（P5）：三种选择有自己的面板，语义与排版都与通用按钮列不同。
  // 非当前回答者照样能看到面板（桌面公开信息），只是按钮置灰并说明在等谁。
  const panelProps = {
    disabled: !humanTurn, busy: state.busy,
    onSubmit: move => { if (humanTurn && !state.busy) cardMove(move, s) },
    // 序章选人的「详情」：与牌桌其它卡牌一致，打开完整卡牌详情（卡面 + 卡背设置）。
    inspectCard: code => openCardDetailDef({
      ...(s.state.cards?.[code] || s.state.investigatorDefs?.[code] || {}), code, type: 'investigator',
    }, { runtime: false }),
  }
  const tarotPanel = tarotPickerModel(s)
  if (tarotPanel) return renderTarotPicker(h, tarotPanel, panelProps)
  const storyPanel = storyInvestigatorPickerModel(s)
  if (storyPanel) return renderStoryInvestigatorPicker(h, storyPanel, panelProps)
  const hauntedPanel = hauntedChoiceModel(s)
  if (hauntedPanel) return renderHauntedChoice(h, hauntedPanel, panelProps)
  const items = choicePresentation(s.state)
  const reactions = reactionChoices(s.state)
  const names = { turnOrder: t('game.choice.turnOrder'), mulligan: t('game.choice.mulligan'), commit: t('game.choice.commit'),
    discard: t('game.choice.discard'), 'discard-hand': t('game.choice.discardHand'), card: t('game.choice.card'),
    assetReplacement: t('game.choice.assetReplacement'),
    'assign-damage': t('game.choice.assignDamage'), 'assign-horror': t('game.choice.assignHorror'),
    prey: t('game.choice.prey'), target: t('game.choice.target'), investigator: t('game.choice.investigator'), playerWindow: t('game.choice.playerWindow'), reaction: t('game.choice.reaction') }
  const ordering = choice.kind === 'scry' && choice.options?.some(option => option.cardCodes?.length)
  const offers = ordering ? [] : items.filter(item => !item.control && (!item.key || !item.key.startsWith('hand:')))
  const assigningHarm = ['assign-damage', 'assign-horror'].includes(choice.kind)
  const test = assigningHarm ? null : s.state.skillTest, testSource = test?.source
  // 检定来源可能是规则代号（威胁区卡如「呆若木鸡」= frozenInFear），底栏缩略图按原卡号取图。
  const testSourceCode = testSource ? (testSource.originalCode || ahArtCode(s, testSource.code)) : null
  const staged = humanTurn ? choiceDraft(s)?.selected || [] : []
  // 阵法（P2.5）把 2–4 项技能相加：`skillTest.skill` 可能是数组，标签与图标都按整组显示。
  const multi = test ? multiSkillTestInfo(s.state) : null
  const skillName = multi?.label || t('game.test.skill')
  const testValue = test?.value ?? test?.baseValue ?? '—'
  const testBase = test?.printedValue ?? test?.baseValue ?? testValue
  const testDelta = Number.isFinite(testValue) && Number.isFinite(testBase) ? testValue - testBase : 0
  const testAria = !test
    ? t('game.choice.targetAria', { choice: names[choice.kind] || t('game.choice.pending') })
    : t('game.test.desc', { skill: skillName, base: testBase, delta: (testDelta >= 0 ? '+' : '') + testDelta, value: testValue, difficulty: test.difficulty })
  return h('section', { className: 'ah-choice ah-direct-prompt', role: 'region', 'aria-label': t('game.choice.pending'),
    'aria-busy': String(!!state.busy), 'data-choice-id': choice.id, 'data-choice-kind': choice.kind,
    'data-choice-seat': choice.seat, 'data-interaction': choice.kind === 'commit' ? 'zone:commit' : 'zone:discard' },
    h('div', { className: 'ah-direct-instruction', role: 'status' },
      h('strong', { className: test ? 'ah-test-context' : '' }, test ? `${testSource?.label || t('game.test.generic')} · ${testSource?.name || t('game.test.named', { skill: skillName })}` : humanTurn ? names[choice.kind] || t('game.choice.resolving') : t('game.choice.waitingTeammate')),
      h('span', { className: 'ah-choice-prompt' }, renderRulesText(h,choice.prompt,{links:false}))),
    testSourceCode ? h('button', { className: 'ah-test-source', 'data-card-code': testSourceCode, title: t('game.test.sourceTitle', { name: testSource.name }),
      onclick: () => openCardDetailDef({ ...ahCardDef(s, testSource.code), originalCode: testSourceCode, code: testSourceCode, name: testSource.name }) }, tableArt(h, testSourceCode, testSource.name)) : null,
    test ? h('div', { className: 'ah-test-preview' + (multi?.multi ? ' is-multi-skill' : ''),
      'aria-label': testAria },
      h('span', { className: 'ah-test-skill-icons' },
        (multi?.skills || [{ icon: ({ intellect: 'book', combat: 'sword', agility: 'leaf', willpower: 'star' })[test.skill] || 'star' }])
          .map(skill => tableIcon(skill.icon))),
      h('strong', {}, skillName + ' ' + testBase,
        multi?.multi ? h('em', { className: 'ah-test-multiskill' }, t('game.test.combined')) : null,
        testDelta ? h('small', { className: 'ah-test-modifier ' + (testDelta > 0 ? 'is-positive' : 'is-negative') }, `${testDelta>0?'+':''}${testDelta}`) : null,
        t('game.test.difficultySuffix', { difficulty: test.difficulty })),
      h('span', {}, t('game.test.committed', { count: s.state.skillTest.committed?.length || 0 }) + (staged.length ? t('game.test.staged', { count: staged.length }) : ''))) : null,
    staged.length ? h('div', { className: 'ah-choice-staged', role: 'status', 'aria-label': t('game.test.stagedAria') },
      t('game.test.stagedHint', { count: staged.length }),
      h('div', { className: 'ah-committed-cards' }, staged.map(item => tableArt(h, item.code, cardDisplayName(ahCardDef(s, item.code)) || item.code)))) : null,
    test?.committed?.length ? h('div', { className: 'ah-committed-cards', 'aria-label': t('game.test.committedAria') },
      s.state.skillTest.committed.map(card => tableArt(h, card.code, cardDisplayName(ahCardDef(s, card.code)) || card.code))) : null,
    items.filter(item => item.control).flatMap(item => {
      const assisting = choice.kind === 'commit' && s.state.skillTest?.seat != null && s.state.skillTest.seat !== choice.seat
      const finish = choice.kind === 'commit' && item.move.optionId === 'done'
      const button = (label, title, onclick, extra = '') => h('button', { className: 'ah-action ah-choice-option' + extra,
        'data-option-id': item.move.optionId, disabled: state.busy || !humanTurn, title, onclick }, label)
      // A helper's staged card is only sent once they explicitly submit it.
      if (finish && assisting && staged.length) return [
        button(t('game.test.submit'), t('game.test.submitTitle', { count: staged.length }), () => cardMove(item.move, s), ' ah-commit-submit'),
        button(t('game.test.withdraw'), t('game.test.withdrawTitle'), () => {
          const draft = choiceDraft(s)
          if (draft) draft.selected = []
          cardMove(item.move, s)
        }, ' secondary'),
      ]
      return [button(finish ? assisting ? t('game.test.withdraw') : t('game.test.start') : renderChoiceText(h,item.label),
        choice.kind === 'commit' && item.move.optionId === 'help' ? t('game.test.helpTitle') : item.label,
        () => cardMove(item.move, s))]
    }),
    humanTurn && reactions.length && reactions.every(item=>item.code) ? h('button',{
      className:'ah-action secondary ah-mute-reaction',disabled:state.busy,
      title:t('game.reaction.muteTitle'),
      onclick:()=>{setReactionEnabled(s.sessionId,choice.seat,reactions.map(item=>item.code),false);lastReactionPass=null;resetReactionSync();render()},
    },t('game.reaction.mute')) : null,
    ordering ? renderScryOrder(s, humanTurn) : null,
    offers.length ? h('div', { className: 'ah-visual-choices', 'aria-label': t('game.choice.offersAria') }, offers.map(item => {
      const cards = item.cards.length ? item.cards : item.code ? [{ code: item.code, name: item.label }] : []
      // 混乱标记选项：引擎只下发展示名（emoji / ±数字），按 state.tokenLabels 反查回标记类型，
      // 显示真正的标记图案与名称，而不是把 emoji 当图标。
      const token = !cards.length && choice.kind === 'token' ? chaosTokenFaceByLabel(s.state.tokenLabels, item.label) : null
      const optionIcon = ({ intellect: 'book', combat: 'sword', agility: 'leaf', willpower: 'star' })[item.move.optionId]
        || (choice.kind === 'token' ? 'star' : choice.kind === 'payment' ? 'clue' : 'book')
      const label = token ? token.label : item.label
      return h('button', { className: 'ah-choice-option ah-visual-option' + (cards.length ? ' has-art' : token ? ' ah-effect-option ah-token-option' : ' ah-effect-option'),
        'aria-label': label,
        'data-option-id': item.move.optionId, 'data-choice-offer': item.key, 'data-keep-offer': choice.kind === 'prey' || assigningHarm ? 'true' : null,
        'data-interaction': choice.kind === 'prey' ? item.key : null, disabled: state.busy || !humanTurn,
        title: label, onclick: () => cardMove(item.move, s) },
        cards.length ? h('span', { className: 'ah-offer-cards' }, cards.map(card => tableArt(h, card.originalCode || ahArtCode(s, card.code), cardDisplayName(card)))) :
          token ? h('img', { className: 'ah-choice-token', src: token.src, alt: '', draggable: false })
            : tableIcon(optionIcon),
        h('span', {}, token ? label : renderChoiceText(h,item.label)))
    })) : null)
}

function renderCluePayment(s, humanTurn) {
  const choice=s.state.pendingChoice, inv=s.state.investigators.find(inv=>inv.seat===choice.seat)
  const moves=s.state.legalMoves.filter(move=>move.action==='choose' && move.choiceId===choice.id && /^\d+$/.test(move.optionId))
  const values=moves.map(move=>Number(move.optionId)).sort((a,b)=>a-b)
  const payment=choice.payment||{}, min=values[0]??payment.min??1, max=values.at(-1)??payment.max??min
  const key=`${s.sessionId}:${s.state.revision}:${choice.id}`
  if(state.arkhamCluePayment?.key!==key)state.arkhamCluePayment={key,value:min}
  const value=state.arkhamCluePayment.value, enabled=humanTurn&&!state.busy&&values.length>0
  const amount=h('input',{type:'number',min,max,step:1,value,role:'spinbutton','aria-label':t('game.payment.amountAria'),disabled:!enabled})
  const submit=h('button',{className:'ah-action ah-payment-confirm',disabled:!enabled,
    onclick:()=>{const move=moves.find(move=>Number(move.optionId)===state.arkhamCluePayment.value);if(move&&enabled)cardMove(move,s)}},t('game.payment.confirm', { count: value }))
  const minus=h('button',{type:'button','aria-label':t('game.payment.decrease'),disabled:!enabled||value<=min,onclick:()=>setValue(state.arkhamCluePayment.value-1)},'−')
  const plus=h('button',{type:'button','aria-label':t('game.payment.increase'),disabled:!enabled||value>=max,onclick:()=>setValue(state.arkhamCluePayment.value+1)},'+')
  const setValue=next=>{
    if(!enabled)return
    const clamped=Math.max(min,Math.min(max,Math.trunc(Number(next)||min)))
    const legal=values.reduce((best,n)=>Math.abs(n-clamped)<Math.abs(best-clamped)?n:best,min)
    state.arkhamCluePayment.value=legal;amount.value=String(legal)
    minus.disabled=legal<=min;plus.disabled=legal>=max;submit.textContent=t('game.payment.confirm', { count: legal })
  }
  amount.onchange=()=>setValue(amount.value)
  amount.onblur=()=>setValue(amount.value)
  amount.onkeydown=event=>{
    if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){
      event.preventDefault();setValue(event.key==='Home'?min:event.key==='End'?max:state.arkhamCluePayment.value+(event.key==='ArrowUp'?1:-1))
    }
    if(event.key==='Enter'){event.preventDefault();setValue(amount.value);submit.click()}
  }
  return h('section',{className:'ah-choice ah-clue-payment',role:'region','aria-label':t('game.payment.title'),'data-choice-id':choice.id,'data-choice-kind':'payment','aria-busy':String(!!state.busy)},
    h('header',{},tableIcon('clue'),h('div',{},h('small',{},t('game.payment.round', { round: payment.round || 1 })),h('h2',{},t('game.payment.title')))),
    payment.required!=null?h('div',{className:'ah-payment-progress'},
      h('span',{},t('game.payment.required') + ' ',h('b',{},payment.required)),h('span',{},t('game.payment.paid') + ' ',h('b',{},payment.paid)),h('span',{},t('game.payment.remaining') + ' ',h('b',{},payment.remaining))):h('p',{},renderRulesText(h,choice.prompt,{links:false})),
    h('div',{className:'ah-payment-payer'},inv?.code?tableArt(h,inv.code,inv.name):null,
      h('div',{},h('strong',{},inv?.name||t('card.type.investigator')),h('span',{},t('game.payment.holding', { count: payment.available ?? inv?.clues ?? 0 })))),
    humanTurn?h('div',{},h('div',{className:'ah-payment-dial'},minus,amount,plus),
      h('p',{className:'ah-payment-range'},t('game.payment.range', { min, max })),submit):h('p',{role:'status'},t('game.payment.waiting')),
    h('small',{className:'ah-payment-note'},t('game.payment.note')))
}

function renderScryOrder(s, humanTurn) {
  const choice = s.state.pendingChoice
  const key = `${s.sessionId}:${s.state.revision}:${choice.id}`
  if (state.arkhamScryOrder?.key !== key) state.arkhamScryOrder = { key, codes: [...choice.options.find(option => option.cardCodes?.length).cardCodes] }
  const codes = state.arkhamScryOrder.codes
  const reorder = (from, to) => { if (state.busy || !humanTurn || from === to) return; codes.splice(to,0,codes.splice(from,1)[0]); render() }
  const chosen = choice.options.find(option => option.cardCodes?.join('|') === codes.join('|'))
  const move = s.state.legalMoves.find(m => m.choiceId === choice.id && m.optionId === chosen?.id)
  return h('div', { className: 'ah-scry-order', 'aria-label': t('game.scry.orderAria') },
    h('strong', {}, t('game.scry.orderHint')),
    h('div', { className: 'ah-scry-cards' }, codes.map((code,index) => h('div', { className: 'ah-scry-card', 'data-order-index': index,
      onpointerdown: event => {
        if (event.button !== 0 || state.busy || !humanTurn || event.target.closest('button')) return
        event.preventDefault()
        const releaseRender = beginInteraction()
        let ended = false
        const end = () => { if (!ended) { ended = true; releaseRender() } }
        const finish = e => {
          document.removeEventListener('pointerup',finish); document.removeEventListener('pointercancel',cancel)
          const target = document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-order-index]')
          if (target && state.arkhamScryOrder?.key === key) reorder(index,Number(target.dataset.orderIndex))
          end()
        }
        const cancel = () => {
          document.removeEventListener('pointerup',finish); document.removeEventListener('pointercancel',cancel)
          end()
        }
        document.addEventListener('pointerup',finish); document.addEventListener('pointercancel',cancel)
      } },
      tableArt(h,code,cardDisplayName(ahCardDef(s,code)) || code),
      h('span', {}, h('button',{ disabled: !humanTurn || state.busy || index === 0, 'aria-label': t('game.scry.moveEarlier', { index: index + 1 }), onclick: () => reorder(index,index-1) },'←'),
        String(index+1),h('button',{ disabled: !humanTurn || state.busy || index === codes.length-1, 'aria-label': t('game.scry.moveLater', { index: index + 1 }), onclick: () => reorder(index,index+1) },'→'))))),
    h('button', { className: 'ah-action', disabled: !humanTurn || state.busy || !move, onclick: () => move && cardMove(move,s) }, t('game.scry.confirm')))
}

function renderActAdvance(s, humanTurn) {
  const st = s.state, act = st.acts[st.actIndex], objective = act?.objective
  const costsClues = ['clues', 'actClues'].includes(objective?.type)
  const required = costsClues ? (objective.perInvestigator || 0) * st.numInvestigators : null
  const available = objective?.type === 'actClues' ? st.actClues || 0 : st.investigators
    .filter(inv => !inv.defeated && !inv.resigned && (!objective?.atLocation || inv.location === objective.atLocation))
    .reduce((sum, inv) => sum + (inv.clues || 0), 0)
  const move = st.legalMoves.find(m => m.action === 'advanceAct' || (st.pendingChoice?.kind === 'act' && m.action === 'choose' && m.optionId === 'advance'))
  const enough = required == null || available >= required
  const disabled = !move || !humanTurn || state.busy || !enough
  const location = objective?.atLocation && st.locations.find(loc => loc.id === objective.atLocation)?.name
  const reason = !act ? t('game.act.ended') : !costsClues ? t('game.act.advanceHint') : !enough
    ? (location ? t('game.act.notEnoughCluesAt', { count: required - available, location }) : t('game.act.notEnoughClues', { count: required - available }))
    : !humanTurn ? t('game.act.waitTurn') : !move ? t('game.act.waitWindow') : t('game.act.payToAdvance', { count: required })
  return h('button', { className: 'ah-act-advance' + (!disabled ? ' is-ready' : ''), disabled,
    'aria-label': t('game.act.advance'), title: reason, onclick: () => move && cardMove(move, s) },
    h('strong', {}, tableIcon('book'), t('game.act.advance')),
    h('span', {}, tableIcon('clue'), costsClues ? t('game.act.cluesProgress', { available, required }) : t('game.act.objectiveDone')),
    h('small', {}, location ? t('game.act.onlyAt', { location }) : costsClues ? (!enough ? t('game.act.needMore', { count: required - available }) : move ? t('game.act.ready') : t('game.act.waitWindowShort')) : t('game.act.byCard')))
}

// 当前场景/密谋卡面赋予的行动，排在剧本书与提示卡之后。推进场景已有独立按钮，不重复显示。
// 服务端 scriptActions 列出卡面行动（含暂不可执行的原因），可执行时匹配同一条合法动作提交。
function renderScriptActions(s, humanTurn) {
  const st = s.state
  if (st.status !== 'playing') return null
  const same = (a, b) => a.action === b.action && (a.rule ?? null) === (b.rule ?? null) && (a.skill ?? null) === (b.skill ?? null)
  const legal = (st.legalMoves || []).filter(m => ['act', 'agenda'].includes(m.scriptCard) && m.action !== 'advanceAct')
  const hints = (st.scriptActions || []).filter(hint => ['act', 'agenda'].includes(hint.scriptCard))
  const items = [...hints.map(hint => ({ hint, move: hint.reason ? null : legal.find(m => same(m, hint)) })),
    ...legal.filter(m => !hints.some(hint => same(m, hint))).map(move => ({ hint: move, move }))]
    .sort((a, b) => (a.hint.scriptCard === 'act' ? 0 : 1) - (b.hint.scriptCard === 'act' ? 0 : 1))
  if (!items.length) return null
  return h('div', { className: 'ah-script-actions', role: 'group', 'aria-label': t('game.script.actionsAria') },
    h('span', { className: 'ah-script-actions-title' }, tableIcon('book'), t('game.script.actionsTitle')),
    items.map(({ hint, move }) => {
      const source = hint.scriptCard === 'act' ? t('card.type.act') : t('card.type.agenda')
      const text = String(hint.label || '').replace(/^[^\p{L}\p{N}（(]+/u, '')
      const reason = hint.reason || (!move ? t('game.script.unavailable') : !humanTurn ? t('game.script.notYourTurn') : null)
      return h('button', { className: 'ah-script-action' + (reason ? ' is-unavailable' : ''), type: 'button',
        disabled: !!reason || state.busy, 'data-script-card': hint.scriptCard,
        title: t('game.script.entryTitle', { source, text }) + (reason ? t('game.script.reasonSuffix', { reason }) : ''), 'aria-label': t('game.script.entryTitle', { source, text }), onclick: () => move && cardMove(move, s) },
        h('small', {}, source), h('span', {}, text), reason ? h('em', { className: 'ah-script-action-reason' }, reason) : null)
    }))
}

function renderCardGame(s, autoPassing = false) {
  const st = s.state
  const over = st.status !== 'playing'
  const decisionSeat = decisionSeatOf(s)
  const current = s.players[decisionSeat]
  // 演出期间牌桌保持可浏览（详情、时间线、局势），但不接受任何游戏操作。
  const humanTurn = !over && current && canAct(s, decisionSeat) && !presentation.isBlocking
  const human = st.investigators.find(inv => inv.seat === mySeat(s))
  const humanFinished = human && (st.turnsTaken || []).includes(human.seat)
  const activity = { presenting: presentation.isBlocking, processing: state.movePending?.sessionId === s.sessionId }
  const act = st.acts[st.actIndex]
  const agenda = st.agendas[st.agendaIndex]

  let statusText
  if (over) {
    statusText = st.outcome === 'victory' ? t('game.status.victory') : st.outcome === 'survived' ? t('game.status.survived') : st.outcome === 'defeat' ? t('game.status.defeat') : t('game.status.over')
  } else if (autoPassing) {
    statusText = t('game.status.resolving')
  } else if (st.pendingChoice) {
    const inv = st.investigators.find(item => item.seat === decisionSeat)
    statusText = st.pendingChoice.kind === 'turnOrder'
      ? humanTurn ? t('game.status.turnOrder', { name: inv?.name || current.name }) : t('game.status.turnOrderWait')
      : humanTurn
        ? t('game.status.answerFor', { name: inv?.name || current.name })
        : t('game.status.waitingAnswer', { name: inv?.name || current?.name || t('game.status.aiTeammate') })
  } else {
    const inv = st.investigators[st.currentSeat]
    statusText = humanTurn
      ? (inv && inv.name ? t('game.status.yourTurnNamed', { name: inv.name, actions: inv.actionsLeft }) : t('game.status.yourTurn', { actions: inv ? inv.actionsLeft : 0 }))
      : activity.presenting ? t('game.status.presenting', { name: current ? current.name : '' }) : activity.processing ? t('game.status.thinking', { name: current ? current.name : 'AI' }) : t('game.status.waitingNext', { name: current ? current.name : '' })
  }
  if (!over && humanFinished && !humanTurn) statusText = t('game.status.turnEnded', { status: statusText })
  else if (!over && humanTurn && activity.processing) statusText = activity.presenting ? t('game.status.resolvingYours') : t('game.status.submittingYours')

  const script = tableRegions.script(st, act, agenda, s.players, renderActAdvance(s, humanTurn), activity, renderScriptActions(s, humanTurn), {
    act: scriptAttachmentCards(s, st.scriptAttachments?.act), agenda: scriptAttachmentCards(s, st.scriptAttachments?.agenda) })
  const map = tableRegions.map(renderLocationMap(s, humanTurn))
  const player = tableRegions.player(human ? renderPlayerDock(s, human, humanTurn) : null)
  const visibleChoice = st.pendingChoice && !autoPassing
  const actions = tableRegions.actions(visibleChoice ? renderPendingChoice(s, humanTurn) : st.pendingChoice ? null : renderActionButtons(s, humanTurn), !!visibleChoice)
  const timelineOpen = !!state.arkhamTimelineOpen
  const timeline = tableRegions.timeline(timelineOpen,
    () => { state.arkhamTimelineOpen = !state.arkhamTimelineOpen; render() },
    timelineOpen ? renderTableLog(h, s, def => openCardDetailDef(def, {runtime:true})) : null)
  const body = tableRegions.body({ script, map, player, actions, timeline })

  const root = h('div', { className: 'bg-game ah-table ah-calm ah-noir ah-direct-table ah-theme' + (visibleChoice ? ' ah-table-has-choice' : ''), ...presentationAttributes(st), 'data-revision': st.revision,
    onkeydown: event => { if (event.key === 'Escape' && !state.cardDetail) {
      state.arkhamEquipmentOpen = false
      state.arkhamSelection = null; if (state.arkhamMapView) state.arkhamMapView.selectedId = null
      state.arkhamDirectActions = null
      state.arkhamTargetAbility = null
      render()
    } },
  },
    h('div', { className: 'bg-game-head' },
      h('div', { className: 'bg-game-title', title: st.scenario?.name || s.modName }, st.scenario?.name?.split('：').at(-1) || s.modName),
      tableRegions.headerPhases(st),
      h('div', { className: 'bg-game-status' + (over ? ' bg-over' : ''), title: statusText },
        statusText),
      h('div', { className: 'bg-game-actions' },
        h('button', { className: 'bg-btn secondary ah-card-zone-launcher ah-victory-launcher',
          'aria-label': t('table.victory.aria', { count: zoneCards(s, 'victory').length }),
          'aria-haspopup': 'dialog', 'aria-expanded': String(state.arkhamZoneOpen?.kind === 'victory'),
          onclick: () => { state.arkhamZoneOpen = { sessionId: s.sessionId, kind: 'victory' }; render() } },
        tableIcon('star'), h('span', {}, t('table.victory')), h('b', {}, zoneCards(s, 'victory').length)),
        h('button', { className: 'bg-btn secondary ah-card-zone-launcher ah-aside-launcher',
          'aria-label': t('table.aside.aria', { count: zoneCards(s, 'aside').length }),
          'aria-haspopup': 'dialog', 'aria-expanded': String(state.arkhamZoneOpen?.kind === 'aside'),
          onclick: () => { state.arkhamZoneOpen = { sessionId: s.sessionId, kind: 'aside' }; render() } },
        tableIcon('supply'), h('span', {}, t('table.aside')), h('b', {}, zoneCards(s, 'aside').length)),
        h('button', { className: 'bg-btn secondary', 'data-situation-toggle': 'true', 'aria-haspopup': 'dialog',
          'aria-expanded': String(situationView.opened), title: t('table.situation.title'), onclick: () => situationView.open(s.sessionId) }, t('table.situation')),
        h('button', { className: 'bg-btn secondary', onclick: () => arkhamCatalog.open() }, t('table.catalog')),
        h('button', { className: 'bg-btn secondary ah-header-rulebook', title: t('table.rulebook.title'), onclick: () => openRule() }, tableIcon('book'), t('table.rulebook')),
        h('button', { className: 'bg-btn secondary', 'aria-label': t('table.refresh'), title: t('table.refresh'), disabled: state.busy, onclick: () => refreshCardSession(s) }, '↻'),
        h('details', { className: 'ah-session-menu' }, h('summary', { 'aria-label': t('table.menu') }, '•••'),
        h('div', { className: 'ah-session-menu-items' },
        h('button', { className: 'bg-btn secondary', 'aria-pressed': String(presentation.preferences.sound), onclick: () => { presentation.toggleSound(); render() } }, presentation.preferences.sound ? t('table.sound.on') : t('table.sound.off')),
        h('button', { className: 'bg-btn secondary', 'aria-pressed': String(presentation.preferences.fast), onclick: () => { presentation.toggleFast(); render() } }, presentation.preferences.fast ? t('table.animation.fast') : t('table.animation.standard')),
        !st.hubFlow ? h('button', { className: 'bg-btn secondary', disabled: state.busy, onclick: reset }, t('table.restart')) : null,
        h('button', { className: 'bg-btn secondary', disabled: state.busy, onclick: leave }, t('table.leave'))
        )),
        // 调试控制台入口：单机本机显示；联机只有房主显示（客人由服务端硬拒绝）。
        debugConsole.canUse(s) ? h('button', { className: 'bg-btn secondary ah-debug-launcher', 'data-debug-launcher': 'true',
          'aria-haspopup': 'dialog', 'aria-expanded': String(debugConsole.opened),
          title: t('debug.button'), 'aria-label': t('debug.button'),
          onclick: () => debugConsole.open(s) }, '🛠️ ' + t('debug.button')) : null,
        feedbackEntry()
      )
    ),
    state.arkhamAcceptedFx?.sessionId === s.sessionId
      ? h('div', { className: 'ah-accepted-feedback', role: 'status' }, '✓ ' + state.arkhamAcceptedFx.label) : null,
    h('div', { className: 'bg-game-body ah-table-viewport' }, body),
    renderCardActionPopover(s, humanTurn)
  )
  mountCardInteractions(root, s, { state, submit: cardMove, beginInteraction,
    canInteract: () => !presentation.isBlocking && canAct(s, decisionSeatOf(s)),
    selectedKey: () => currentSelection(s)?.key,
    select: key => selectEntity(s, key), inspect: key => inspectEntity(s, key),
    showActions: moves => { state.arkhamDirectActions = { sessionId: s.sessionId, revision: st.revision, moves }; render() },
    feedback: message => { state.error = message; render() } })
  const highlightResources = target => {
    const card=target?.closest?.('.ah-hand-card'), pool=root.querySelector('.ah-pool-resource')
    if(!pool)return
    const cost=Number(card?.dataset.resourceCost || 0)
    pool.classList.toggle('is-cost-preview',cost>0)
    pool.querySelector('.ah-pool-hint').textContent=cost>0 ? t('game.pool.cost', { cost }) : t('game.pool.available')
  }
  root.addEventListener('pointerover',event=>highlightResources(event.target))
  root.addEventListener('pointerout',event=>highlightResources(event.relatedTarget))
  root.addEventListener('focusin',event=>highlightResources(event.target))
  root.addEventListener('focusout',event=>highlightResources(event.relatedTarget))
  return root
}

function renderPlayerAvatar(player) {
  if (!/^(data:image\/|blob:|https?:\/\/|\/)/i.test(player?.avatar || '')) return null
  return h('img', { className: 'ah-player-avatar', src: player.avatar, alt: '',
    role: 'img', 'aria-label': t('game.player.avatarAria', { name: player.name || t('game.player.fallback') }) })
}

function renderPlayerDock(s, inv, humanTurn) {
  const hand = inv.hand || []
  const selected = currentSelection(s)
  const preview = selected ? entityDefinition(s, selected.key) : null
  // Match the engine's enemiesEngagedWith rule, including co-located massive enemies.
  const engaged = s.state.enemies.filter(enemy => enemy.engagedSeat === inv.seat || (enemy.massive && enemy.location === inv.location))
  // 「压在调查员底下」与「直觉牌库」：服务端只把本人的卡号下发（别人的只有张数），
  // 所以这里画的是本人视角；公开张数在调查员详情里另给（见 renderRuntimeCardState）。
  const beneath = Array.isArray(inv.beneath) ? inv.beneath : []
  const hunch = (s.state.hunch || []).find(entry => entry.seat === inv.seat) || null
  return h('div', { className: 'ah-player-board' },
    !engaged.length ? h('div', { className: 'ah-engage-drop', 'data-interaction': 'zone:engage', role: 'region', 'aria-label': t('game.dock.engageAria') },
      tableIcon('sword'), h('strong', {}, t('game.dock.engage')), h('span', {}, t('game.dock.engageHint'))) : null,
    h('section', { className: 'ah-equipment-battlefield', 'aria-label': t('game.dock.equipmentAria') },
      h('div', { className: 'ah-play-surface' + (preview?.code ? ' has-card' : ''), 'data-interaction': 'zone:play', role: 'button', tabindex: 0, 'aria-label': t('game.dock.playArea') },
        preview?.code ? tableArt(h, preview.originalCode || preview.code, preview.name) : [slotBackdrop('star'), h('span', { className: 'ah-play-label' }, t('game.dock.playArea'))]),
      renderEquipmentSlots(s, inv, humanTurn),
      inv.threat?.length ? h('div', { className: 'ah-threat-row', 'aria-label': t('game.dock.threatAria', { count: inv.threat.length }) },
        h('span', { className: 'ah-threat-label' }, t('game.dock.threat')),
        h('div', { className: 'ah-threat-cards' }, inv.threat.map(card => renderMiniCard(s, card, false, { asset: true })))) : null,
      beneath.length ? h('div', { className: 'ah-threat-row ah-beneath-row', 'data-beneath-count': beneath.length,
        'aria-label': t('game.beneath.aria', { count: beneath.length }) },
        h('span', { className: 'ah-threat-label' }, tableIcon('book'), t('game.beneath.label')),
        h('div', { className: 'ah-threat-cards' }, beneath.map(code => renderMiniCard(s, code, false, { beneath: true })))) : null,
      hunch ? h('div', { className: 'ah-threat-row ah-hunch-row', 'data-hunch-deck': hunch.deck,
        'aria-label': t('game.hunch.aria', { count: hunch.deck }) },
        h('span', { className: 'ah-threat-label' }, tableIcon('eye'), t('game.hunch.label', { count: hunch.deck })),
        hunch.revealed
          ? h('div', { className: 'ah-threat-cards' }, renderMiniCard(s, hunch.revealed, false, { hunch: true }))
          : h('span', { className: 'ah-hunch-empty' }, t('game.hunch.empty'))) : null),
    h('div', { className: 'ah-player-dock' },
    h('div', { className: 'ah-dock-investigator' },
      h('span', { className: 'ah-dock-kicker', title: t('game.dock.investigatorOwner', { name: s.players[inv.seat]?.name || 'player' }) }, renderPlayerAvatar(s.players[inv.seat]), t('game.dock.investigatorOwner', { name: s.players[inv.seat]?.name || 'player' })),
      h('div', { className: 'ah-dock-name-row' },
        h('button', { className: 'ah-dock-name', title: inv.name, 'data-interaction': `investigator:${inv.seat}`, onclick: () => openCardDetailDef({ ...s.state.investigatorDefs[inv.code], ...inv, type: 'investigator' }) },
          tableIcon(classIcon(inv.klass)),
          h('span', { className: 'ah-dock-name-text' }, inv.name)),
        renderReactionModes(s, inv),
        // 头像与三态齿轮同排居中：早先绝对定位在名字行右上角，和齿轮上下错开半个按钮高。
        h('span', { className: 'ah-dock-portrait', 'aria-hidden': 'true' }, tableArt(h, inv.code, inv.name))),
      h('div', { className: 'ah-dock-vitals' }, [['health',t('game.vital.health'),inv.maxHealth,inv.damage],['sanity',t('game.vital.sanity'),inv.maxSanity,inv.horror]].map(([kind,label,max,loss])=>{
        const current=Math.max(0,max-(loss || 0)), fill=max>0 ? Math.min(100,current/max*100) : 0
        return h('div',{className:'ah-vital ah-vital-'+kind,'aria-label':t('game.vital.aria', { label, current, max })},
          tableIcon(kind),h('span',{className:'ah-vital-label'},label),h('span',{className:'ah-vital-value'},h('strong',{},current),h('small',{},'/ '+max)),
          h('span',{className:'ah-vital-track','aria-hidden':'true'},h('i',{style:{width:fill+'%'}})))
      })),
      h('div', {className:'ah-dock-skills','aria-label':t('game.dock.skillsAria')}, ['willpower','intellect','combat','agility'].map(skill=>{
        const base=inv[skill] || 0, value=ahEffStat(s,inv,skill), delta=value-base
        const label=(s.state.skillNames || {})[skill] || ahSkillLabel(skill)
        const desc=t('game.stat.descDelta', { label, base, delta: (delta>=0?'+':'')+delta, value })
        return h('div', {className:'ah-dock-skill','data-skill':skill,title:desc,'aria-label':desc},
          tableIcon(({willpower:'star',intellect:'book',combat:'sword',agility:'leaf'})[skill]),
          h('div',{className:'ah-skill-value'},h('strong',{},base),delta ? h('small',{className:delta>0?'is-positive':'is-negative'},`${delta>0?'+':''}${delta}`) : null),h('span',{},label))
      })),
      h('div', { className: 'ah-dock-actions ah-action-points' + (inv.actionsLeft>0?'':' is-empty'), 'aria-label': t('game.dock.actionsAria', { count: inv.actionsLeft }) },
        h('strong',{className:'ah-action-count'},Math.max(0,inv.actionsLeft || 0)),h('small',{},t('game.dock.actionPoints')),
        h('div',{className:'ah-action-pips','aria-hidden':'true'},Array.from({ length: Math.max(3,Math.min(6,inv.actionsLeft || 0)) }, (_, index) =>
          h('span', { className: index < inv.actionsLeft ? 'is-ready' : '' }, tableIcon('action')))))),
    h('div',{className:'ah-personal-pools','aria-label':t('game.dock.poolsAria')},[['resource',t('game.token.resource'),inv.resources],['clue',t('game.token.clue'),inv.clues || 0]].map(([kind,label,value])=>
      h('section',{className:'ah-token-pool ah-pool-'+kind,'aria-label':kind==='resource'?t('game.dock.resourcePoolAria'):t('game.dock.cluePoolAria'),'data-pool':kind},
        h('div',{className:'ah-pool-tokens','aria-hidden':'true'},Array.from({length:Math.min(6,Math.max(0,value))},(_,i)=>h('i',{style:{'--token-index':i}},tableIcon(kind)))),
        h('strong',{},value),h('span',{},label),h('small',{className:'ah-pool-hint'},kind==='resource'?t('game.pool.available'):t('game.pool.discovered'))))),
    h('div', { className: 'ah-hand-area' },
      h('div', { className: 'ah-cards ah-hand', 'data-hand-seat': inv.seat, 'data-hand-count': hand.length, 'aria-label': t('game.dock.handAria') },
        hand.length ? hand.map((card, index) => renderMiniCard(s, card, false, {
          source: 'hand', handIndex: index, handCount: hand.length, seat: inv.seat,
          draggable: humanTurn && !state.busy && (!s.state.pendingChoice || s.state.pendingChoice.kind === 'commit'),
        })) : h('span', { className: 'ah-hand-empty' }, t('game.dock.emptyHand')))),
    h('div', { className: 'ah-dock-tools' },
      h('button', { className: 'ah-dock-equipment', 'aria-label': t('game.dock.viewDiscard'), onclick: () => { state.arkhamDiscardOpen = !state.arkhamDiscardOpen; render() } }, t('game.dock.discardCount', { count: inv.discard?.length || 0 })),
      h('button', { className: 'ah-dock-deck', title: t('game.dock.drawTitle'), 'aria-label': t('game.dock.drawAria'), disabled: state.busy || !humanTurn || !s.state.legalMoves.some(m => m.action === 'draw'),
        onclick: () => { const move = s.state.legalMoves.find(m => m.action === 'draw'); if (move) cardMove(move, s) } },
        h('img', { className: 'ah-deck-back', src: '/mods/arkhamhorror/img/backs/back_player.webp', alt: '' }),
        h('span', {}, t('game.dock.deckSummary', { deck: inv.deckSize ?? inv.deck?.length ?? 0, discard: inv.discard?.length || 0 })))),
    state.arkhamDiscardOpen ? h('section', { className: 'ah-discard-tray', 'aria-label': t('game.dock.discardPile') },
      h('button', { 'aria-label': t('game.dock.closeDiscard'), onclick: () => { state.arkhamDiscardOpen = false; render() } }, t('common.close')),
      (inv.discard || []).map((code, index) => h('div', { 'data-interaction': index === inv.discard.length - 1 ? 'discard:top' : null }, renderMiniCard(s, code))),
      !inv.discard?.length ? h('span', {}, t('game.dock.emptyDiscard')) : null) : null),
    engaged.length ? h('section', { className: 'ah-engagement-zone', 'aria-label': t('game.dock.engagementAria'), 'data-engaged-count': engaged.length, 'data-interaction': 'zone:engage' },
      h('div', { className: 'ah-engagement-heading' }, tableIcon('sword'), h('span', {}, t('game.dock.engaged')), h('b', {}, t('game.dock.enemyCount', { count: engaged.length }))),
      h('div', { className: 'ah-engagement-cards' }, engaged.map(enemy=>h('div',{className:'ah-engaged-enemy'},renderEnemyChip(s,enemy),
        h('div',{className:'ah-engaged-enemy-stats'},tableIcon('health'),`${Math.max(0,enemy.health-(enemy.damageTaken||0))}`,tableIcon('sword'),enemyFightDisplay(enemy),tableIcon('leaf'),enemy.effectiveEvade ?? enemy.evade)))),
      h('small',{className:'ah-engagement-hint'},t('game.dock.engageHint2'))) : null)
}

// 能力上限：按资产实例 id 在服务端投影（view.abilityUsage）里找这张卡的记账。
// 场上支援对所有座位可见，因此这里不需要先知道持有者是谁。
function abilityUsageFor(st, assetId) {
  if (!assetId || !st?.abilityUsage) return null
  for (const list of Object.values(st.abilityUsage)) {
    const found = (list || []).find(entry => entry.assetId === assetId)
    if (found) return found
  }
  return null
}

// 已用掉的能力，一行一条，供卡面 title / 详情面板复用。
function usedAbilityLines(usage) {
  return (usage?.abilities || []).filter(item => item.used)
    .map(item => t('game.used.line', { label: item.label, limit: item.limitText }))
}

// 当前调查员所在地点上「本场游戏已经用过」的卡面行动（内容层标了 used 的提示）。
function usedActionHints(st, locationId) {
  const inv = st?.investigators?.[st.currentSeat]
  if (!inv || inv.location !== locationId) return []
  return st.usedActions || []
}

function renderMiniCard(s, reference, exhausted, opts = {}) {
  const code = typeof reference === 'string' ? reference : reference.code
  const d = { ...ahCardDef(s, code), ...(typeof reference === 'object' ? reference : {}) }
  const cd = cardDisplay(d)
  const clsColor = ahClassColor(s, code)
  const typeIcon = AH_TYPE_ICON[cd.type] || (cd.isWeakness ? '⚠️' : '🃏')
  const iconEls = []
  for (const [sk, n] of Object.entries(cd.icons || {})) {
    for (let i = 0; i < (Number(n) || 0); i++) iconEls.push(h('span', { className: 'ah-minicard-icon' }, AH_SKILL_ICON[sk.toLowerCase()] || sk))
  }
  const draggable = !!opts.draggable
  const selected = currentSelection(s)
  // 非手牌、非槽位的小卡也要能被选中/查看：压在调查员底下的牌与直觉牌库揭示的牌用卡号当 key。
  const interactionKey = opts.source === 'hand' ? `hand:${opts.seat ?? 0}:${opts.handIndex}`
    : opts.asset ? `asset:${reference?.id}`
    : opts.beneath ? `beneath:${code}`
    : opts.hunch ? `hunch:${code}` : null
  const staged = opts.source === 'hand' && choiceDraft(s)?.selected.some(item => item.index === opts.handIndex)
  const isSelected = !!staged || (selected?.code === code && (opts.source === 'hand' ? selected.handIndex === opts.handIndex : opts.asset ? selected.assetId === reference?.id : !!interactionKey && selected.key === interactionKey))
  const fan = opts.source === 'hand' ? fanStyle(opts.handCount, opts.handIndex) : null
  const commit = opts.source === 'hand' ? handCommitMove(s, opts.handIndex) : null
  // 「每回合/每场游戏一次」的能力用掉后，按钮会从合法行动里消失；卡面留一个角标，
  // 让玩家不必靠「点开没有反应」来推断。
  const usage = opts.asset ? abilityUsageFor(s.state, reference?.id) : null
  const usedLines = usedAbilityLines(usage)
  const assetStats = opts.asset ? [
    cd.cost != null ? t('game.card.cost', { cost: cd.cost }) : '',
    cd.health != null ? t('game.card.healthValue', { value: cd.health }) : '',
    d.courage ? t('game.card.noSkillIcons') : '',
  ].filter(Boolean).join(' · ') : ''
  const activate = (focusActions = false) => {
    if (state.busy) return
    if (commit) return cardMove(commit, s)
    if (s.state.pendingChoice) return openCardDetail(s, reference)
    if (opts.source === 'hand') return selectCard(s, { code, handIndex: opts.handIndex }, focusActions)
    if (opts.asset) return selectCard(s, { code, assetId: reference.id }, focusActions)
    if (interactionKey) return selectCard(s, { code, key: interactionKey }, focusActions)
    openCardDetail(s, reference)
  }
  return h('div', {
    className: 'ah-minicard' + (opts.source === 'hand' ? ' ah-hand-card' : '') + (d.courage ? ' ah-minicard-courage' : '') + (exhausted ? ' ah-minicard-exhausted' : '') + (draggable ? ' ah-minicard-draggable' : '') + (opts.beneath ? ' ah-minicard-beneath' : '') + (opts.hunch ? ' ah-minicard-hunch' : '') + (isSelected ? ' is-selected' : ''),
    style: fan,
    title: cd.name + (assetStats ? '\n' + assetStats : '') + (usedLines.length ? '\n' + usedLines.join('\n') : '') + (cd.text ? '\n\n' + cd.text : '') + '\n\n' + t('game.mini.clickHint'),
    role: 'button', tabindex: 0,
    'aria-label': cd.name + (assetStats ? t('game.mini.assetStats', { stats: assetStats }) : '') + (usedLines.length ? t('game.mini.used', { list: usedLines.join(t('game.list.semicolon')) }) : '') + (commit ? t('game.mini.commit') : opts.asset ? t('game.mini.assetAbility') : opts.source === 'hand' ? t('game.mini.selectHand') : t('game.mini.view')),
    'aria-pressed': opts.source === 'hand' || opts.asset || opts.beneath || opts.hunch ? String(!!isSelected) : null,
    draggable: 'false',
    'data-interaction': interactionKey,
    'data-card-code': code,
    'data-resource-cost': opts.source === 'hand' ? Math.max(0,Number(cd.cost)||0) : null,
    'data-draggable': draggable ? 'true' : null,
    'data-slot': opts.slot || cd.slot || null,
    onkeydown: event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(true) }
      if (event.key === 'Escape') { state.arkhamSelection = null; render() }
    },
    onclick: () => activate(),
    ondragstart: event => event.preventDefault(),
    ondragend: draggable ? () => clearCardDrag() : null,
  },
    tableArt(h, d.originalCode || ahArtCode(s, code), cd.name),
    renderReactionToggle(s,code),
    h('div', { className: 'ah-minicard-cost' }, cd.cost != null ? cd.cost : ''),
    cd.xp ? h('div', { className: 'ah-minicard-xp' }, '✦' + cd.xp) : null,
    cd.isWeakness ? h('div', { className: 'ah-minicard-weakness' }, '⚠') : null,
    cd.doubleSided ? h('div', { className: 'ah-minicard-ds' }, '⇄') : null,
    h('div', { className: 'ah-minicard-name' }, (exhausted ? '✗ ' : '') + (cd.name || code)),
    usedLines.length ? h('div', {
      className: 'ah-minicard-usage', 'data-ability-used': 'true',
      title: usedLines.join('\n'), 'aria-label': t('game.used.aria', { list: usedLines.join(t('game.list.semicolon')) }),
    }, t('game.used.badge')) : null,
    opts.asset ? placedCardMarkers(h, d) : null,
    iconEls.length ? h('div', { className: 'ah-minicard-icons' }, iconEls) : null,
    h('div', { className: 'ah-minicard-meta' }, typeIcon + ' ' + (cd.klass || '')),
    h('div', { className: 'ah-minicard-bar', style: { background: clsColor } })
  )
}

function renderLocationNode(s, loc, opts = {}) {
  const st = s.state
  // 投影可能给未揭示的双面私人地点换上「门口」那一面的印名（name/nameEn），
  // 统一走卡牌显示名，避免英文界面显示中文占位名。
  const locName = cardDisplayName(loc) || loc.name || ''
  const current = st.investigators[st.currentSeat]?.location === loc.id
  const move = findLocationMove(s, loc.id)
  const choiceMove = choiceTargetMove(s, loc.id)
  const adjacent = !!(move && !current)
  const here = st.investigators.filter((i) => !i.defeated && !i.resigned && i.location === loc.id)
  const enemiesHere = st.enemies.filter((e) => e.location === loc.id)
  const storyHere = (st.storyAssets || []).filter(asset => asset.location === loc.id)
  const attachedCards = locationAttachments(s, loc)
  const attachments = [...attachedCards, ...storyHere.map(asset => ({ ...ahCardDef(s,asset.code), ...asset }))]
  const resourceBadge = (kind, label, value, text) => h('button', {
    className: `ah-loc-badge ah-loc-${kind}`, 'data-map-info': kind, title: `${label} ${value ?? ''}`, 'aria-label': `${locName} · ${label} ${value ?? ''}`,
    onclick: event => { event.stopPropagation(); openCardDetailDef({ ...loc, type: 'location' }, { focusInfo: kind }) },
    onkeydown: event => event.stopPropagation(),
  }, tableIcon(kind === 'clues' ? 'clue' : kind === 'locked' ? 'lock' : kind === 'attached' ? 'book'
    : kind === 'resources' ? 'resource' : kind === 'breach' ? 'doom' : kind === 'brazier' ? 'star'
    : kind === 'spectral' ? 'eye' : kind), value == null ? null : String(value))
  const badges = []
  // [[通道]] 关键字徽记：已揭示地点的印刷特性，或皮博迪先生授予未揭示地点的运行时特性。
  // 放在徽记列表最前，默认主题的徽记区只有两行高度，避免被裁掉；点击打开地点档案并高亮特性。
  for (const pair of locationTraitBadges(loc)) {
    const label = locationTraitLabel(pair)
    badges.push(h('button', {
      className: 'ah-loc-badge ah-loc-trait', 'data-map-info': 'traits', 'data-trait': pair.en || pair.zh,
      title: t('game.location.traitBadgeTitle', { trait: label }),
      'aria-label': t('game.location.traitBadgeAria', { location: locName, trait: label }),
      onclick: event => { event.stopPropagation(); openCardDetailDef({ ...loc, type: 'location' }, { focusInfo: 'traits' }) },
      onkeydown: event => event.stopPropagation(),
    }, label))
  }
  if (loc.clues) badges.push(resourceBadge('clues', t('game.token.clue'), loc.clues, t('game.location.badgeClues', { count: loc.clues })))
  if (loc.locked) badges.push(resourceBadge('locked', t('game.badge.locked'), null, t('game.location.badgeLocked')))
  if (loc.doom) badges.push(resourceBadge('doom', t('game.token.doom'), loc.doom, t('game.location.badgeDoom', { count: loc.doom })))
  if (loc.resources) badges.push(resourceBadge('resources', t('game.token.resource'), loc.resources, t('game.location.badgeResources', { count: loc.resources })))
  if (attachments.length) badges.push(resourceBadge('attached', t('game.location.attachments'), attachments.length,
    attachments.map(item => typeof item === 'string' ? item : cardDisplayName(item) || cardDisplayName(ahCardDef(s, item.code)) || t('game.location.attachments')).join(t('game.list.separator'))))
  // 万象无终（P5）：裂口计数、火盆点燃状态、幽灵地点。都来自公开投影。
  for (const badge of locationTcuBadges(st, loc.id)) badges.push(resourceBadge(badge.kind, badge.label, badge.value, badge.title))
  const view = currentMapView(s)
  const activate = (focusActions = false) => {
    if (choiceMove && opts.humanTurn && !state.busy) return cardMove(choiceMove, s)
    view.selectedId = view.selectedId === loc.id ? null : loc.id
    state.arkhamSelection = null
    render()
    if (focusActions) queueMicrotask(() => document.querySelector('.ah-table-actions .ah-action')?.focus())
  }
  return h('div', {
    className: 'ah-loc ah-loc-map-card' + (current ? ' ah-loc-current' : '') + (adjacent ? ' ah-loc-adjacent' : '') + (choiceMove ? ' ah-choice-target' : '') + (view.selectedId === loc.id ? ' is-selected' : ''),
    style: opts.style || null,
    title: locName + (loc.revealed ? '' : t('game.location.hiddenSuffix')) + (adjacent ? t('game.location.movableSuffix') : ''),
    role: 'button', tabindex: 0,
    'aria-label': locName, 'aria-pressed': String(view.selectedId === loc.id),
    'data-location-id': loc.id,
    'data-interaction': `location:${loc.id}`,
    'data-current-location': current ? 'true' : 'false',
    'data-revealed': loc.revealed ? 'true' : 'false',
    'data-adjacent': adjacent ? 'true' : 'false',
    'data-move-target': move ? move.locationId : null,
    'data-choice-target': choiceMove?.optionId || null,
    onkeydown: event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); activate(true) } },
    onclick: event => { event.stopPropagation(); activate() },
    onpointerenter: () => opts.onPreview?.(loc.id),
    onpointerleave: () => opts.onPreview?.(null),
    onfocus: () => opts.onPreview?.(loc.id),
    onblur: () => opts.onPreview?.(null),
  },
    tableArt(h, loc.originalCode || loc.code || loc.artCode, locName, { face: loc.revealed ? 'front' : 'back' }),
    opts.onDragStart ? h('button', { className: 'ah-map-node-handle', type: 'button',
      'aria-label': t('game.map.moveNodeAria', { name: locName }), title: t('game.map.dragNodeTitle'),
      onpointerdown: event => { event.stopPropagation(); opts.onDragStart(event, loc.id) },
      onclick: event => event.stopPropagation(),
    }, '⠿') : null,
    h('div', { className: 'ah-location-caption' }, locName),
    badges.length ? h('div', { className: 'ah-loc-badges' }, badges) : null,
    here.length ? h('div', { className: 'ah-location-investigators' }, here.map(inv => h('button', {
      className: 'ah-map-investigator', title: inv.name, 'aria-label': t('game.map.viewInvestigator', { name: inv.name }),
      'data-seat': inv.seat,
      'data-inspect-default': 'true',
      'data-interaction': `investigator:${inv.seat}`,
      style: { '--investigator-color': AH_CLASS_COLOR[inv.klass] || '#aaa' },
      onclick: event => { event.stopPropagation(); openCardDetailDef({ ...st.investigatorDefs[inv.code], ...inv, type: 'investigator' }) },
    }, tableArt(h, inv.code, inv.name)))) : null,
    enemiesHere.length ? h('div', { className: 'ah-location-entities', onclick: event => event.stopPropagation(),
      onkeydown: event => event.stopPropagation() }, enemiesHere.map(enemy => renderEnemyChip(s, enemy, { map: true }))) : null,
    attachments.length ? h('div', { className: 'ah-location-story-markers' }, attachments.map((asset,index) => {
      const def = ahCardDef(s, asset.code), name = cardDisplayName(asset) || cardDisplayName(def) || asset.code
      const attached = index < attachedCards.length
      return h('button', { className: 'ah-map-story-marker' + (attached ? ' ah-map-attachment' : ''), 'data-map-info': attached ? 'attachment' : 'story',
        'data-attachment-code': attached ? asset.code : null,
        title: attached ? t('game.map.attachedTo', { location: locName, name }) : name, 'aria-label': attached ? t('game.map.viewAttachment', { name }) : t('game.map.viewStoryCard', { name }),
        onclick: event => { event.stopPropagation(); openCardDetail(s, { ...asset, attachedTo: attached ? { type: 'location', name: locName } : undefined }) }, onkeydown: event => event.stopPropagation(),
        oncontextmenu: event => { event.preventDefault(); event.stopPropagation(); openCardDetail(s,{ ...asset, attachedTo: attached ? { type: 'location', name: locName } : undefined }) },
      }, tableArt(h, asset.originalCode || def.originalCode || asset.code, name), placedCardMarkers(h, asset))
    })) : null
  )
}

function findLocationMove(s, locationId) {
  return (s.state.legalMoves || []).find(move => move.action === 'move' && move.locationId === locationId) || null
}

function findPlayMove(s, code) {
  return (s.state.legalMoves || []).find(move => move.action === 'play' && move.cardId === code) || null
}

function fanStyle(count = 1, index = 0) {
  const distance = index - (count - 1) / 2
  const angle = Math.max(-10, Math.min(10, distance * 3))
  const overlap = Math.max(0, Math.min(30, (count - 5) * 6))
  return `--fan-angle:${angle}deg;--fan-raise:${Math.min(3,Math.abs(distance))}px;--fan-overlap:${overlap}px;z-index:${index + 1}`
}

function assetFitsSlot(def, slot) {
  const restrictedAlly = slot === 'allyRestricted'
  const wanted = restrictedAlly ? 'ally' : slot
  // 米奇·布朗的额外盟友槽只接受非独特盟友。
  if (restrictedAlly && def.unique) return false
  const slots = normalizeAhSlots(def)
  return slots.length ? slots.some(value => (value === 'handx2' ? 'hand' : value) === wanted) : wanted === 'other'
}

function dropMove(s, code, index, kind, slot = null) {
  if (kind === 'choice') {
    const move = handCommitMove(s, index)
    return move ? { move } : { reason: t('game.drop.notCommittable') }
  }
  if (s.state.pendingChoice) return { reason: t('game.drop.finishChoice') }
  const move = findPlayMove(s, code)
  const def = ahCardDef(s, code)
  if (kind === 'equip' && def.type !== 'asset') return { reason: t('game.drop.assetOnly') }
  if (kind === 'equip' && !assetFitsSlot(def, slot)) return { reason: t('game.drop.slotMismatch', { name: cardDisplayName(def) || code }) }
  return move ? { move } : { reason: t('game.drop.notLegal', { name: cardDisplayName(def) || code }) }
}

function clearCardDrag() {
  document.querySelectorAll('.ah-drop-valid, .ah-drop-invalid, .is-dragging').forEach(el =>
    el.classList.remove('ah-drop-valid', 'ah-drop-invalid', 'is-dragging'))
  state.arkhamDragProxy?.remove()
  state.arkhamDragProxy = null
  if (state.arkhamDragKeyHandler) document.removeEventListener('keydown', state.arkhamDragKeyHandler)
  state.arkhamDragKeyHandler = null
  state.arkhamDrag = null
}

function startCardDrag(event, s, code, index) {
  if (!event?.dataTransfer || state.busy) return
  state.arkhamDrag = { sessionId: s.sessionId, revision: s.state.revision, code, index }
  event.dataTransfer.setData('text/plain', code)
  event.dataTransfer.effectAllowed = 'move'
  event.currentTarget.classList.add('is-dragging')
  const def = ahCardDef(s, code)
  const proxy = document.createElement('div')
  proxy.className = 'ah-drag-proxy'
  proxy.textContent = cardDisplayName(def) || code
  document.body.append(proxy)
  state.arkhamDragProxy = proxy
  event.dataTransfer.setDragImage(proxy, 24, 24)
  const mark = (selector, kind, getSlot = () => null) => {
    document.querySelectorAll(selector).forEach(el =>
      el.classList.add(dropMove(s, code, index, kind, getSlot(el)).move ? 'ah-drop-valid' : 'ah-drop-invalid'))
  }
  mark('.ah-table .ah-actions', 'play')
  mark('.ah-table .ah-equip-slot', 'equip', el => el.dataset.slot)
  mark('.ah-table .ah-choice', 'choice')
  state.arkhamDragKeyHandler = keyEvent => { if (keyEvent.key === 'Escape') clearCardDrag() }
  document.addEventListener('keydown', state.arkhamDragKeyHandler)
}

function readDragCard(event) {
  try { return event?.dataTransfer?.getData('text/plain') || '' } catch { return '' }
}

function handlePlayDrop(s, event, kind = 'play', slot = null) {
  event?.preventDefault?.()
  const code = readDragCard(event)
  if (!code) return
  const index = state.arkhamDrag?.index ?? s.state.investigators.find(inv => inv.seat === mySeat(s))?.hand.indexOf(code)
  const result = dropMove(s, code, index, kind, slot)
  clearCardDrag()
  if (!result.move) { state.error = result.reason; render(); return }
  cardMove(result.move, s)
}

function normalizeAhSlots(def) {
  const raw = Array.isArray(def?.slots) && def.slots.length ? def.slots : (def?.slot ? [def.slot] : [])
  return raw.map(slot => {
    const key = String(slot).trim().toLowerCase()
    return key.replace(/^(hand|arcane)\s*x2$/, '$1x2')
  })
}

function ahSlotBonuses(s, inv) {
  const bonus = {}
  for (const asset of inv.assets || []) {
    // 只在这里读取运行时展示数据；真正的槽位合法性仍由服务端 validateMove 决定。
    // 展示容量统一来自服务端静态表（card-defs 从 add:slot / restrictedSlots 派生），
    // 不再按卡号兜底（旧 UI_CARDS.handSlots 表已删除，2026-10-26 原语收敛）。
    const def = ahCardDef(s, asset.code)
    const extra = def.extraSlots || {}
    for (const [slot, amount] of Object.entries(extra)) bonus[slot] = (bonus[slot] || 0) + amount
    // 米奇·布朗：额外盟友槽只放非独特盟友，和普通 extraSlots 分开记账。
    if (def.allySlotsForNonUnique) {
      bonus.allyRestricted = (bonus.allyRestricted || 0) + def.allySlotsForNonUnique
    }
  }
  return bonus
}

function slotBackdrop(kind, mirrored = false) {
  return h('span', { className: 'ah-slot-backdrop' + (mirrored ? ' is-mirrored' : ''), 'data-slot-art': kind, 'aria-hidden': 'true' }, tableIcon(kind))
}

function renderEquipmentSlots(s, inv, humanTurn) {
  const order = ['hand', 'ally', 'arcane', 'accessory', 'body', 'tarot']
  const labels = { hand: t('game.slot.hand'), ally: t('game.slot.ally'), arcane: t('game.slot.arcane'), accessory: t('game.slot.accessory'), body: t('game.slot.body'), tarot: t('game.slot.tarot') }
  const capacity = { hand: 2, ally: 1, arcane: 2, accessory: 1, body: 1, tarot: 1 }
  const bonuses = ahSlotBonuses(s, inv)
  for (const slot of order) capacity[slot] += bonuses[slot] || 0
  // 米奇·布朗：额外 2 个盟友槽只能放非独特盟友，在基础/通用加槽之后单独渲染。
  const restrictedAlly = bonuses.allyRestricted || 0
  const cells = Object.fromEntries(order.map(slot => [slot,
    Array.from({ length: capacity[slot] + (slot === 'ally' ? restrictedAlly : 0) }, () => null)]))
  const other = []
  const allies = []
  for (const asset of inv.assets || []) {
    const def = ahCardDef(s, asset.code)
    const required = normalizeAhSlots(def).flatMap(slot => slot.endsWith('x2') ? [slot.slice(0, -2), slot.slice(0, -2)] : [slot]).filter(slot => cells[slot])
    if (!required.length) { other.push(asset); continue }
    if (required.length === 1 && required[0] === 'ally') { allies.push({ asset, def }); continue }
    required.forEach((slot, index) => {
      let cell = cells[slot].findIndex(value => !value)
      // Retain every public asset even when a temporary state exceeds capacity.
      if (cell < 0) cell = cells[slot].length
      cells[slot][cell] = { asset, linked: index > 0, shared: required.length > 1,
        reason: required.every(value => value === 'hand') ? t('game.equip.twoHands') : required.every(value => value === 'arcane') ? t('game.equip.twoArcane') : t('game.equip.crossSlot') }
    })
  }
  // 独特盟友只能占不受限槽，先放它们，避免非独特盟友先占掉基础槽。
  for (const { asset, def } of allies.sort((a, b) => Number(Boolean(b.def.unique)) - Number(Boolean(a.def.unique)))) {
    const limit = def.unique ? capacity.ally : cells.ally.length
    let cell = -1
    for (let i = 0; i < limit; i++) if (!cells.ally[i]) { cell = i; break }
    if (cell < 0) cell = cells.ally.length
    cells.ally[cell] = { asset, restricted: cell >= capacity.ally }
  }
  const slots = order.flatMap(slot => cells[slot].map((entry, index) => {
    const restrictedSlot = slot === 'ally' && index >= capacity.ally
    const label = slot === 'hand' ? [t('game.equip.leftHand'), t('game.equip.rightHand')][index] || t('game.equip.extraHand', { index: index - 1 })
      : restrictedSlot ? t('game.equip.restrictedAlly', { index: index - capacity.ally + 1 })
      : slot === 'arcane' || cells[slot].length > 1 ? t('game.equip.slotIndex', { slot: labels[slot], index: index + 1 }) : labels[slot]
    const slotId = restrictedSlot ? 'allyRestricted' : slot
    const asset = entry?.asset
    const def = asset ? ahCardDef(s, asset.code) : null
    const used = entry ? 1 : 0
    return h('div', {
      className: 'ah-equip-slot' + (entry ? ' ah-equip-slot-full' : '') + (entry?.linked ? ' is-linked-slot' : '')
        + (restrictedSlot ? ' is-restricted-slot' : ''),
      'data-slot': slotId, 'data-slot-index': index, 'data-interaction': 'slot:' + slotId,
      'data-slot-used': used, 'data-slot-capacity': 1,
      'data-slot-group-used': cells[slot].filter(Boolean).length, 'data-slot-group-capacity': cells[slot].length,
      role: 'button', tabindex: 0, 'aria-label': t('game.equip.slotAria', { label, used }) + (entry?.shared ? ' · ' + entry.reason : ''),
      ondragover: humanTurn ? event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move' } : null,
      ondrop: humanTurn ? event => handlePlayDrop(s, event, 'equip', slotId) : null,
    },
      slotBackdrop(slot, slot === 'hand' && index === 1),
      h('div', { className: 'ah-equip-slot-head' }, h('span', { className: 'ah-equip-slot-label' }, label), h('span', { className: 'ah-equip-slot-count' }, used + '/1')),
      h('div', { className: 'ah-equip-slot-cards' }, entry?.linked
        ? h('button', { className: 'ah-slot-linked', 'data-interaction': 'asset:' + asset.id,
          'aria-label': (cardDisplayName(def) || '') + ' · ' + entry.reason, title: (cardDisplayName(def) || '') + ' · ' + entry.reason,
          onclick: () => openCardDetail(s, asset),
        }, tableArt(h, asset.code, cardDisplayName(def)), h('span', { className: 'ah-slot-occupancy' }, entry.reason))
        : asset ? renderMiniCard(s, asset, asset.exhausted, { slot, asset: true, draggable: false }) : null))
  }))
  slots.push(...[...other, null].map((asset, index) => h('div', {
    className: 'ah-equip-slot ah-equip-other' + (asset ? ' ah-equip-slot-full' : ''),
    'data-slot': 'other', 'data-slot-index': index, 'data-interaction': 'slot:other',
    'data-slot-used': asset ? 1 : 0, 'data-slot-capacity': 1,
    role: 'button', tabindex: 0, 'aria-label': t('game.equip.otherAria', { index: index + 1 }) + (asset ? t('game.equip.equippedSuffix') : t('game.equip.placeableSuffix')),
    ondragover: humanTurn ? event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move' } : null,
    ondrop: humanTurn ? event => handlePlayDrop(s, event, 'equip', 'other') : null,
  },
    slotBackdrop('supply'),
    h('div', { className: 'ah-equip-slot-head' }, h('span', { className: 'ah-equip-slot-label' }, t('game.equip.other'))),
    h('div', { className: 'ah-equip-slot-cards' }, asset ? renderMiniCard(s, asset, asset.exhausted, { slot: 'other', asset: true, draggable: false }) : null)
  )))
  return h('div', { className: 'ah-inv-zone ah-equip-zone' },
    h('div', { className: 'ah-zone-label' }, t('game.equip.zone')), h('div', { className: 'ah-equip-slots' }, slots))
}

function currentMapView(s) {
  const key = `calm:${s.sessionId}:${s.state.scenario?.id || ''}`
  if (state.arkhamMapView?.key !== key) {
    let saved = {}
    try { saved = JSON.parse(localStorage.getItem(`arkham-map:${key}`) || '{}') } catch { /* local storage is optional */ }
    state.arkhamMapView = { key, scale: 1, tx: 0, ty: 0, fitted: false, sceneWidth: null, sceneHeight: null, positions: saved.positions || {} }
  }
  return state.arkhamMapView
}

function saveMapPositions(view) {
  try { localStorage.setItem(`arkham-map:${view.key}`, JSON.stringify({ positions: view.positions })) } catch { /* local storage is optional */ }
}

function mapTransform(view, scene) {
  scene.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`
  scene.dataset.mapScale = String(view.scale)
}

function fitMap(view, viewport, scene) {
  const width = Number(scene.dataset.mapWidth)
  const height = Number(scene.dataset.mapHeight)
  if (!viewport.clientWidth || !viewport.clientHeight) return
  view.scale = Math.max(.3, Math.min(1.3, Math.min((viewport.clientWidth - 24) / width, (viewport.clientHeight - 24) / height)))
  view.tx = (viewport.clientWidth - width * view.scale) / 2
  view.ty = (viewport.clientHeight - height * view.scale) / 2
  view.fitted = true
  mapTransform(view, scene)
}

function setMapEdge(line, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y
  const trim = Math.min(.45, (MAP_CARD_WIDTH / 2 + 14) / Math.abs(dx || .0001), (MAP_CARD_HEIGHT / 2 + 14) / Math.abs(dy || .0001))
  line.setAttribute('x1', String(from.x + MAP_CARD_WIDTH / 2 + dx * trim))
  line.setAttribute('y1', String(from.y + MAP_CARD_HEIGHT / 2 + dy * trim))
  line.setAttribute('x2', String(to.x + MAP_CARD_WIDTH / 2 - dx * trim))
  line.setAttribute('y2', String(to.y + MAP_CARD_HEIGHT / 2 - dy * trim))
}

function mapEdges(geometry, hunterEdges, entryErrors = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'ah-map-edges')
  svg.setAttribute('width', String(geometry.width))
  svg.setAttribute('height', String(geometry.height))
  svg.setAttribute('aria-hidden', 'true')
  const defs = document.createElementNS(svg.namespaceURI, 'defs')
  const marker = document.createElementNS(svg.namespaceURI, 'marker')
  for (const [key, value] of Object.entries({ id: 'ah-map-arrow', viewBox: '0 0 12 12', refX: '10', refY: '6', markerWidth: '12', markerHeight: '12', markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' })) marker.setAttribute(key, value)
  const arrow = document.createElementNS(svg.namespaceURI, 'path')
  arrow.setAttribute('d', 'M1 1 L11 6 L1 11 L4 6 Z')
  arrow.setAttribute('fill', 'context-stroke')
  marker.append(arrow); defs.append(marker); svg.append(defs)
  const blockedMarker = marker.cloneNode(true)
  blockedMarker.setAttribute('id', 'ah-map-arrow-blocked')
  blockedMarker.firstChild.setAttribute('fill', '#ef6464')
  defs.append(blockedMarker)
  for (const edge of geometry.edges) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('data-from', edge.from)
    line.setAttribute('data-to', edge.to)
    line.setAttribute('data-direction', edge.bidirectional ? 'both' : 'forward')
    line.setAttribute('marker-end', entryErrors[edge.to] ? 'url(#ah-map-arrow-blocked)' : 'url(#ah-map-arrow)')
    if (edge.bidirectional) line.setAttribute('marker-start', entryErrors[edge.from] ? 'url(#ah-map-arrow-blocked)' : 'url(#ah-map-arrow)')
    if (entryErrors[edge.to] || (edge.bidirectional && entryErrors[edge.from])) line.classList.add('ah-map-entry-blocked')
    if (hunterEdges.has([edge.from, edge.to].sort().join('\u0000'))) line.classList.add('ah-map-hunter-route')
    const from = geometry.positions[edge.from]
    const to = geometry.positions[edge.to]
    setMapEdge(line, from, to)
    svg.append(line)
  }
  return svg
}

function renderLocationMap(s, humanTurn) {
  const st = s.state
  const view = currentMapView(s)
  const geometry = mapGeometry(st.locations, st.scenario?.layout, view.positions)
  const hunterEdges = hunterRouteEdges(st.locations, st.enemies || [], st.investigators)
  let viewport, scene, drag
  const focusLines = previewId => {
    const id = previewId || view.selectedId
    const linked = new Set()
    scene.classList.toggle('has-focused-route', !!id)
    for (const line of scene.querySelectorAll('.ah-map-edges line')) {
      const related = !!id && (line.dataset.from === id || line.dataset.to === id)
      line.classList.toggle('is-visible', !!view.showAll || related)
      line.classList.toggle('is-related', related)
      if (related) { linked.add(line.dataset.from); linked.add(line.dataset.to); line.parentNode.append(line) }
    }
    for (const node of scene.querySelectorAll('.ah-map-node')) node.classList.toggle('is-connected', linked.has(node.dataset.locationId))
  }
  const scenePoint = (id) => geometry.positions[id]
  const updateLines = id => {
    for (const line of scene.querySelectorAll('.ah-map-edges line')) {
      if (line.dataset.from !== id && line.dataset.to !== id) continue
      const from = scenePoint(line.dataset.from)
      const to = scenePoint(line.dataset.to)
      setMapEdge(line, from, to)
    }
  }
  const startDrag = (event, id = null) => {
    if (event.button !== 0) return
    event.preventDefault()
    drag = { id, x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty,
      point: id ? { ...scenePoint(id) } : null, releaseRender: beginInteraction() }
    viewport.setPointerCapture(event.pointerId)
    viewport.classList.add('is-dragging')
  }
  const moveDrag = event => {
    if (!drag) return
    if (drag.id) {
      const point = { x: drag.point.x + (event.clientX - drag.x) / view.scale,
        y: drag.point.y + (event.clientY - drag.y) / view.scale }
      geometry.positions[drag.id] = point
      view.positions[drag.id] = { ...point }
      const node = [...scene.querySelectorAll('.ah-map-node')].find(el => el.dataset.locationId === drag.id)
      if (node) { node.style.left = point.x + 'px'; node.style.top = point.y + 'px' }
      updateLines(drag.id)
    } else {
      view.tx = drag.tx + event.clientX - drag.x
      view.ty = drag.ty + event.clientY - drag.y
      mapTransform(view, scene)
    }
  }
  const endDrag = () => {
    if (!drag) return
    const current = drag
    const movedNode = !!current.id
    drag = null
    viewport.classList.remove('is-dragging')
    if (movedNode) { saveMapPositions(view); render() }
    current.releaseRender()
  }
  const zoom = (factor, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) => {
    const next = Math.max(.3, Math.min(2.4, view.scale * factor))
    view.tx = x - (x - view.tx) * next / view.scale
    view.ty = y - (y - view.ty) * next / view.scale
    view.scale = next
    view.fitted = true
    mapTransform(view, scene)
  }
  scene = h('div', { className: 'ah-map-scene ah-location-map',
    'data-map-width': geometry.width, 'data-map-height': geometry.height,
    style: { width: geometry.width + 'px', height: geometry.height + 'px' } },
  mapEdges(geometry, hunterEdges, st.locationEntryErrors), st.locations.map(loc => {
    const point = geometry.positions[loc.id]
    const node = renderLocationNode(s, loc, { humanTurn, onDragStart: startDrag, onPreview: focusLines,
      style: { left: point.x + 'px', top: point.y + 'px' } })
    node.classList.add('ah-map-node')
    return node
  }))
  viewport = h('div', { className: 'ah-map-viewport', role: 'group', tabindex: 0, 'aria-label': t('game.map.aria'),
    'aria-description': t('game.map.description'),
    onpointerdown: event => { if (!event.target.closest('.ah-map-node')) startDrag(event) },
    onpointermove: moveDrag, onpointerup: endDrag, onpointercancel: endDrag,
    onclick: event => { if (!event.target.closest('.ah-map-node') && view.selectedId) { view.selectedId = null; render() } },
    ondblclick: event => { if (!event.target.closest('.ah-map-node')) { event.preventDefault(); fitMap(view, viewport, scene) } },
    onwheel: event => {
      if (event.target.closest('.ah-map-node') || !event.deltaY) return
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1)
      zoom(Math.exp(-Math.max(-160, Math.min(160, delta)) * .002), event.clientX - rect.left, event.clientY - rect.top)
    },
    onkeydown: event => {
      if (event.target !== viewport || event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (['+', '=', '-', '0', 'e', 'r', 'l'].includes(key)) event.preventDefault()
      if (key === '+' || key === '=') zoom(1.2)
      if (key === '-') zoom(1 / 1.2)
      if (key === '0') fitMap(view, viewport, scene)
      if (key === 'e') { view.editing = !view.editing; viewport.parentElement.classList.toggle('is-editing', view.editing) }
      if (key === 'l') { view.showAll = !view.showAll; focusLines(null) }
      if (key === 'r') {
        view.positions = {}; view.fitted = false; saveMapPositions(view); render()
        queueMicrotask(() => document.querySelector('.ah-map-viewport')?.focus())
      }
    },
  }, scene)
  const root = h('div', { className: 'ah-map-root' + (view.editing ? ' is-editing' : '') }, viewport)
  focusLines(null)
  // A presentation checkpoint may render inside an animation frame. Waiting
  // for another frame paints the new scene once at its untransformed origin.
  mapTransform(view, scene)
  queueMicrotask(() => {
    if (!root.isConnected) return
    // 地图几何尺寸变化时必须重新适配：进入关卡时先渲染占位地图（1×1），演出结束后换成真实地点，
    // 若只比较视口尺寸就会保留旧 scale/tx/ty，真实节点落在视口外（表现为地图空白）。
    const geometryChanged = view.sceneWidth !== geometry.width || view.sceneHeight !== geometry.height
    if (!view.fitted || geometryChanged || view.viewportWidth !== viewport.clientWidth || view.viewportHeight !== viewport.clientHeight) {
      fitMap(view, viewport, scene)
      view.sceneWidth = geometry.width; view.sceneHeight = geometry.height
    } else mapTransform(view, scene)
    view.viewportWidth = viewport.clientWidth; view.viewportHeight = viewport.clientHeight
    mapResizeObserver?.disconnect()
    const observer = new ResizeObserver(() => {
      if (!root.isConnected) { observer.disconnect(); return }
      if (view.viewportWidth === viewport.clientWidth && view.viewportHeight === viewport.clientHeight) return
      fitMap(view, viewport, scene)
      view.sceneWidth = geometry.width; view.sceneHeight = geometry.height
      view.viewportWidth = viewport.clientWidth; view.viewportHeight = viewport.clientHeight
    })
    mapResizeObserver = observer
    observer.observe(viewport)
  })
  return root
}

function renderEnemyChip(s, e, { map = false } = {}) {
  const st = s.state
  const choiceMove = choiceTargetMove(s, e.id)
  const victoryLevel = Math.min(3, Math.max(0, Math.trunc(Number(e.victory) || 0)))
  const engagedName = e.engagedSeat != null ? (st.investigators[e.engagedSeat] ? st.investigators[e.engagedSeat].name : '?') : null
  const atLoc = st.locations.find((l) => l.id === e.location)
  const canEngage = st.legalMoves?.some(move => move.action === 'engage' && move.enemyId === e.id)
  const kws = []
  if (e.hunter) kws.push(t('game.kw.hunter'))
  if (e.retaliate) kws.push(t('game.kw.retaliate'))
  if (e.alert) kws.push(t('game.kw.alert'))
  if (e.elite) kws.push(t('game.kw.elite'))
  if (e.massive) kws.push(t('game.kw.massive'))
  if (e.prey) kws.push(t('game.kw.prey', { prey: ahPreyLabel(e.prey) }))
  if (e.victory) kws.push(t('game.kw.victoryCompact', { points: e.victory }))
  // 万象无终（P5）：异端者的多面与「不能以任何方式被击败」写在敌人卡上，翻面/放逐动作仍来自 legalMoves。
  const face = enemyFaceBadge(e)
  if (face?.label) kws.push(face.label)
  if (face?.cannotBeDefeated) kws.push(t('game.enemy.cannotBeDefeated'))
  const enemyTitle = choiceMove ? t('game.enemy.selectTarget')
    : `${e.name}${face?.title ? `\n${face.title}` : ''}\n${canEngage ? t('game.enemy.engageHint') : t('game.enemy.clickHint')}`
  const enemyState = engagedName ? t('game.enemy.engagedWith', { name: engagedName }) : e.massive ? t('game.enemy.engagedAll') : t('game.enemy.roaming')
  return h('div', { className: 'ah-enemy' + (e.massive ? ' is-massive' : '') + (victoryLevel ? ` has-victory victory-${victoryLevel}` : '') + (choiceMove ? ' ah-choice-target' : '') + (e.exhausted ? ' is-exhausted' : ''), title: enemyTitle, role: 'button', tabindex: 0,
    'aria-label': t('game.enemy.aria', { name: e.name, health: e.health - (e.damageTaken || 0), max: e.health }) + (e.exhausted ? t('game.enemy.exhaustedSuffix') : '') + (canEngage ? t('game.enemy.engageableSuffix') : ''),
    'data-inspect-default': map ? 'true' : null,
    'data-interaction': `enemy:${e.id}`,
    'data-victory': e.victory > 0 ? e.victory : null,
    'data-choice-target': choiceMove?.optionId || null,
    onkeydown: event => { if (event.key === 'Enter') { if (choiceMove && !state.busy) cardMove(choiceMove, s); else openCardDetail(s, e) } },
    onclick: () => { if (choiceMove && !state.busy) cardMove(choiceMove, s); else openCardDetail(s, e) } },
    tableArt(h, e.originalCode || e.code, e.name),
    placedCardMarkers(h, e, { enemy: true }),
    h('div', { className: 'ah-enemy-name' }, (e.hunter ? '🐺 ' : '👹 ') + e.name + (e.doom ? ' 🌑' + e.doom : '')),
    h('div', { className: 'ah-enemy-stats' },
      t('game.enemy.stats', { fight: enemyFightDisplay(e), evade: e.effectiveEvade ?? e.evade, health: e.health - e.damageTaken, max: e.health }) +
      (e.damage ? t('game.enemy.damageSuffix', { damage: e.damage }) : '') + (e.horror ? t('game.enemy.horrorSuffix', { horror: e.horror }) : '')),
    kws.length ? h('div', { className: 'ah-enemy-kws' }, kws.map((k) => h('span', { className: 'ah-enemy-kw' }, k))) : null,
    h('div', { className: 'ah-enemy-state' },
      t('game.enemy.locationState', { location: atLoc ? atLoc.name : e.location, state: enemyState, exhausted: e.exhausted ? t('game.enemy.exhaustedSuffix') : '' }))
  )
}

// 选中卡牌却没有合法行动时的原因：先问手牌（费用/时机），再看上限账本。
// 上限用光是最容易被误读成「这张卡坏了」的一种，所以把「已用」直接写出来。
function selectionUnavailableReason(s, selection) {
  const hand = handUnavailableReason(s, selection.key, state.busy)
  if (hand) return hand
  const used = selection.assetId ? usedAbilityLines(abilityUsageFor(s.state, selection.assetId)) : []
  if (used.length) return t('game.unavailable.used', { list: used.join(t('game.list.semicolon')) })
  return ''
}

function renderActionButtons(s, humanTurn) {
  if (s.state.pendingChoice) return null
  const moves = s.state.legalMoves || []
  const selection = currentSelection(s)
  const location = !selection ? s.state.locations.find(loc => loc.id === currentMapView(s).selectedId) : null
  if (!moves.length && !selection && !location) {
    return null
  }
  const disabled = state.busy || !humanTurn
  const shown = selection ? [] : location
    ? moves.filter(move => move.locationId === location.id ||
      (location.id === s.state.investigators[s.state.currentSeat]?.location && move.action === 'investigate'))
    : moves.filter(move => ['investigate', 'resource', 'draw', 'endTurn'].includes(move.action)).slice(0, 4)
  const button = m => h('button', { className: 'ah-action', disabled,
    'aria-label': m.label, title: m.label,
    'data-location-move': m.action === 'move' ? m.locationId : null, onclick: () => cardMove(m, s) },
    ahActionLabel(m.action) || m.label)
  const additional = !selection && !location
    ? moves.filter(move => !shown.includes(move) && !move.scriptCard && !['play','ability','fight','evade','engage','parley','parleyCultist','move','locationAbility','discardThreat','purgeThreat','payDebt','advanceAct','drawCultist','interruptRitual','sacrificeLita','freeAction'].includes(move.action))
    : []
  const buttons = [...shown, ...additional].map(button)
  const usedHints = location ? usedActionHints(s.state, location.id) : []
  const def = selection ? entityDefinition(s, selection.key) : null
  return h('div', {
    className: 'ah-actions',
    'data-drop-kind': 'play',
    onkeydown: event => { if (event.key === 'Escape' && selection) { state.arkhamSelection = null; render() } },
    ondragover: humanTurn ? event => { event?.preventDefault?.(); if (event?.dataTransfer) event.dataTransfer.dropEffect = 'move' } : null,
    ondrop: humanTurn ? event => handlePlayDrop(s, event, 'play') : null,
  }, selection ? h('span', { className: 'ah-context-name' }, cardDisplayName(def) || selection.code) : null,
  selection ? h('span', { className: 'ah-context-reason' }, selectedMoves(s, selection).length ? t('game.action.dragOrSelect') : selectionUnavailableReason(s, selection) || t('game.action.unavailable')) : null,
  buttons,
  usedHints.map(hint => h('button', { className: 'ah-action is-used', disabled: true,
    title: hint.reason || t('game.used.thisGame'), 'aria-label': t('game.used.prefix', { label: hint.label }), 'data-ability-used': 'true' },
  t('game.used.prefix', { label: hint.label }))),
  location ? h('span', { className: 'ah-location-context' }, h('strong', {}, location.name),
    location.revealed ? t('game.location.contextSuffix', { shroud: location.shroud, clues: location.clues }) : t('game.location.hiddenSuffix')) : null,
  location ? h('button', { className: 'ah-action secondary', onclick: () => openCardDetailDef({ ...location, type: 'location' }, { runtime: true }) }, t('game.action.viewLocation')) : null,
  location ? h('button', { className: 'ah-action secondary', onclick: () => { currentMapView(s).selectedId = null; render() } }, t('game.action.cancelSelection')) : null,
  selection ? h('button', { className: 'ah-action secondary', onclick: () => openCardDetailDef(def) }, selection.key?.startsWith('location:') ? t('game.action.viewLocation') : t('game.action.viewCard')) : null,
  selection ? h('button', { className: 'ah-action secondary', onclick: () => { state.arkhamSelection = null; state.arkhamDirectActions = null; state.arkhamTargetAbility = null; render() } }, t('game.action.cancelSelection')) : null)
}

