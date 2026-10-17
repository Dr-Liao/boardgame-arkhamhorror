// 诡镇奇谈 · 卡牌版 Mod 的浏览器 UI
//
// 由大厅按 /mods/arkhamhorror/catalog.js 动态加载（见 lib/mods.js 的 web 契约）。
// 大厅只提供通用宿主能力（h/api/render/state），本文件负责全部诡镇专属展示：
// 战役选择、卡组构筑、对局界面、卡牌详情与全卡图鉴。
// 不要把这些逻辑写回大厅的 public/app.js。

import { createCatalogUI, getCardPresentation, renderDetailContent, renderImage, cardFaceText } from './catalog.js'
import { createHubUI } from './hub.js'
import { createMusicPlayer } from './music-player.js'
import { createChaosBagView } from './chaos-bag-view.js'
import { createSituationView } from './situation-view.js'
import { createRulebook } from './rulebook.js'
import { cardRuleIds, openRule, ruleLink } from './rulebook-data.js'
import { renderRulesText, cardSymbol } from './card-text.js'
import { tableArt, retainTableArt } from './table-art.js'
import { createTableRegions } from './table-regions.js'
import { renderTableLog } from './table-timeline.js'
import { mapGeometry, hunterRouteEdges, MAP_CARD_WIDTH, MAP_CARD_HEIGHT } from './map-layout.js'
import { createTablePresentation } from './table-presentation.js'
import { tableIcon, classIcon, cardAttachmentReferences, cardMarkerData, placedCardMarkers } from './table-components.js'
import { choicePresentation, entityMoves, mountCardInteractions, cancelTableGesture, handUnavailableReason } from './card-interactions.js'
import { reactionEnabled, setReactionEnabled, reactionChoices, reactionView } from './reaction-preferences.js'
import { presentationAttributes, campaignPlaylistId } from './campaign-presentation.js'
import { captureScrollState, restoreScrollWhenMounted } from './scroll-state.js'

let h, api, render, state, reset, leave
let beginInteraction = () => () => {}
let hubUi
let tableRegions
let presentation
let mapResizeObserver
let musicPlayer
let chaosBagView
let situationView
// The session last painted on the table (after presentation/reaction views).
let tableSession = null
let rulebook
let lastReactionPass = null
const mySeat = s => s.mySeat ?? s.observerSeat ?? 0
const canAct = (s, seat) => seat === mySeat(s) && (!s.online || (state.online?.connected && !state.online?.busy && state.online?.room?.members.some(member => member.host && member.online)))
// 演出期间只读视图必须使用正在播放的牌桌快照，避免提前泄露尚未演出的结果。
const viewSession = () => (presentation?.isBlocking && tableSession?.sessionId === state.session?.sessionId && tableSession) || state.session

function automaticReactionPass(session) {
  const choice = session.state.pendingChoice, items = reactionChoices(session.state)
  if (!items.length || !canAct(session, choice.seat)
      || items.some(item => !item.code || reactionEnabled(session.sessionId, choice.seat, item.code))) return
  const skip = session.state.legalMoves.find(move => move.action === 'choose' && move.optionId === 'skip')
  const key = `${session.sessionId}:${session.state.revision}:${choice.id}`
  return skip ? { choice, items, skip, key } : null
}

function scheduleReactionPass(session) {
  const pass = automaticReactionPass(session)
  if (!pass) return false
  const { choice, items, skip, key } = pass
  // Keep the automatic choice hidden while another render is caused by the
  // presentation or by the in-flight skip request.
  if (state.busy || presentation.isBlocking) return true
  if (key === lastReactionPass) return state.movePending?.sessionId === session.sessionId
  lastReactionPass = key
  queueMicrotask(() => {
    if (state.busy || presentation.isBlocking || state.session?.sessionId !== session.sessionId
        || state.session.state.revision !== session.state.revision || key !== lastReactionPass) return
    if (items.some(item => reactionEnabled(session.sessionId,choice.seat,item.code))) return
    cardMove(skip,session)
  })
  return true
}

function renderReactionToggle(s, code) {
  if (!s || !ahCardDef(s,code).hasReactionPrompt) return null
  const seat = s.observerSeat ?? s.players.find(player => player.role === 'human')?.seat
  const inv = s.state.investigators.find(inv => inv.seat === seat)
  if (!inv || !(inv.code === code || inv.hand?.includes(code) || [...(inv.assets || []),...(inv.threat || [])].some(card => card.code === code))) return null
  const enabled = reactionEnabled(s.sessionId,seat,code)
  return h('button', { className:'ah-reaction-toggle'+(enabled?' is-on':''), 'data-reaction-toggle':code,
    role:'switch', 'aria-checked':String(enabled), 'aria-label':(ahCardDef(s,code).name || code)+'的快速反应',
    title:enabled?'快速反应已开启，点击关闭本局提示':'快速反应已关闭，点击恢复提示',
    disabled:presentation.isBlocking,
    onpointerdown:event=>event.stopPropagation(), onkeydown:event=>event.stopPropagation(),
    onclick:event=>{event.stopPropagation();setReactionEnabled(s.sessionId,seat,[code],!enabled);lastReactionPass=null;render()},
  },tableIcon('action'),enabled?'反应开':'反应关')
}

/** 大厅在加载 Mod 时调用一次，注入宿主能力并拿回本 Mod 的 UI 接口。 */
export function createUI(host) {
  ;({ h, api, render, state, reset, leave } = host)
  beginInteraction = host.beginInteraction || beginInteraction
  musicPlayer ||= createMusicPlayer(h)
  chaosBagView ||= createChaosBagView(h,render)
  rulebook ||= createRulebook(h,render)
  presentation ||= createTablePresentation({ art: (code, name, options) => tableArt(h, code, name, options), onChange: () => render() })
  const openChaosBag = () => { if (state.session) chaosBagView.open(state.session.sessionId) }
  tableRegions = createTableRegions(h, { openDetail: (def, options) => openCardDetailDef(def, options), openChaosBag })
  situationView ||= createSituationView(h, { render: () => render(), openChaosBag: () => openChaosBag(),
    effStat: (s, inv, skill) => ahEffStat(s, inv, skill), mySeat: s => mySeat(s),
    openDetail: (def, options) => openCardDetailDef(def, options), openCard: (s, reference) => openCardDetail(s, reference),
    cardName: (s, code) => ahCardDef(s, code).name })
  hubUi = createHubUI({ ...host, canAct, submitMove: cardMove, refreshSession: refreshCardSession,
    catalogOpen: () => arkhamCatalog.open(), rulebookOpen: () => openRule(), inspectCard: code => openCardDetailDef({...ahCardDef(state.session,code),code}, {runtime:false}) })
  return {
    onOpenSetup: game => { state.cardDetail = null; state.arkhamZoneOpen = null; state.arkhamDeckOpen = false; if (arkhamCatalog.isOpen) arkhamCatalog.close(); hubUi.onOpenSetup(game) },
    onDeactivate: () => { musicPlayer.render(false); rulebook.render(false); chaosBagView.reset(); situationView.reset(); state.arkhamZoneOpen = null; tableSession = null },
    isModalOpen: () => !!(state.cardDetail || state.arkhamZoneOpen || state.arkhamDeckOpen || arkhamCatalog.isOpen || chaosBagView.opened || situationView.opened),
    renderSetupModal: game => hubUi.renderSetupModal(game),
    renderGame: session => {
      session = presentation.sync(session)
      if (session.state.hubFlow && session.state.uiState !== 'inScenario') { tableSession = null; return hubUi.renderGame(session) }
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
    renderOverlays: () => [
      chaosBagView.render(state.view==='game'?viewSession():null,false),
      rulebook.render(state.setup?.game?.id === 'arkhamhorror' || (state.view === 'game' && state.session?.modId === 'arkhamhorror')),
      musicPlayer.render(state.view === 'game' && state.session?.modId === 'arkhamhorror'
        && (!state.session.state?.hubFlow || state.session.state.uiState === 'inScenario'),
        campaignPlaylistId(state.session?.state)),
      situationView.render(state.view === 'game' ? tableSession : null, {
        sync: tableSession && state.arkhamSync?.sessionId === tableSession.sessionId ? state.arkhamSync.message : null }),
      !presentation.isBlocking && state.arkhamZoneOpen && tableSession ? renderCardZoneModal(tableSession) : null,
      !presentation.isBlocking && state.arkhamDeckOpen && state.session ? hubUi.renderDeckModal(state.session) : null,
      arkhamCatalog.isOpen ? arkhamCatalog.render() : null,
      state.cardDetail ? renderCardDetailModal(state.cardDetail) : null,
    ].filter(Boolean),
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
const AH_CLASS_NAME = { guardian: '守卫者', seeker: '探求者', mystic: '秘术师', rogue: '游荡者', survivor: '幸存者', neutral: '中立', mythos: '神话' }
const AH_CLASS_COLOR = { guardian: '#3b82f6', seeker: '#f59e0b', mystic: '#8b5cf6', rogue: '#10b981', survivor: '#ef4444', neutral: '#9ca3af', mythos: '#6b21a8' }
const AH_SKILL_ICON = { willpower: '🧠', intellect: '📖', combat: '⚔️', agility: '👟', wild: '❓' }
const AH_SKILL_NAME = { willpower: '意志', intellect: '智识', combat: '战斗', agility: '敏捷', wild: '野性' }
const AH_TYPE_ICON = { asset: '🛠️', event: '⚡', skill: '🎯', investigator: '🕵️', enemy: '👹', treachery: '🃏', location: '📍', act: '📜', agenda: '🌑' }
const AH_TYPE_LABEL = { asset: '支援', event: '事件', skill: '技能', investigator: '调查员', enemy: '敌人', treachery: '诡计', location: '地点', act: '场景', agenda: '密谋', story: '故事', scenario: '剧本' }
const AH_PREY_LABEL = { bearer: '仅持有者', highestCombat: '战斗最高者', lowestHealth: '生命最低者', mostClues: '线索最多者', lowestSanity: '理智最低者', lowestAgility: '敏捷最低者', lowestCombat: '战斗最低者', fewestHand: '手牌最少者' }
const AH_SLOT_LABEL = { hand: '手部', 'hand x2': '双手', ally: '盟友', arcane: '法术', accessory: '饰品', body: '身体', tarot: '塔罗' }

function slotLabel(slot) {
  if (!slot) return ''
  return AH_SLOT_LABEL[String(slot).toLowerCase()] || slot
}

function ahCardDef(s, code) {
  return (s.state && s.state.cards && s.state.cards[code]) || {}
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
  if (loc.barricade || loc.barricades?.length) include('01038', Math.max(loc.barricades?.length || 0, loc.barricade ? 1 : 0))
  if (loc.arcaneBarriers) include('02102', loc.arcaneBarriers)
  if (loc.sordidAndSilent) include('02089', loc.sordidAndSilent)
  if (loc.searchingForIzzieSeat != null) include('02011')
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
  if (!markers.length && !attachments.length && !host && !card.exhausted) return null
  const hostLabel = host && (host.name || ({ location: '地点', enemy: '敌人', act: '当前场景', agenda: '当前密谋' })[host.type] || '卡牌')
  return h('section', { className: 'ah-runtime-card-state', 'aria-label': '当前卡牌状态' },
    h('h3', {}, '当前卡牌状态'),
    markers.length ? h('div', { className: 'ah-runtime-markers' }, markers.map(([kind, icon, label, value]) =>
      h('span', { className: 'ah-runtime-marker ah-runtime-marker-' + kind, 'data-runtime-marker': kind,
        title: `${label} ${value}`, 'aria-label': `${label} ${value}` }, tableIcon(icon), h('b', {}, value), h('small', {}, label)))) : null,
    card.exhausted ? h('p', { className: 'ah-runtime-host' }, '状态：已横置') : null,
    hostLabel ? h('p', { className: 'ah-runtime-host' }, `附着于：${hostLabel}`) : null,
    attachments.length ? h('div', { className: 'ah-detail-attachments' },
      h('h4', {}, `附属卡（${attachments.length}）`),
      attachments.map(attachment => {
        const name = attachment.nameZh || attachment.name || attachment.code
        return h('button', { type: 'button', className: 'ah-detail-attachment-card',
          'data-attachment-code': attachment.code, 'aria-label': `查看附属卡 ${name}`,
          onclick: () => openCardDetail(s, { ...attachment, attachedTo: {
            type: card.type || (enemy ? 'enemy' : 'card'), name: card.nameZh || card.name || card.code,
          } }) }, tableArt(h, attachment.originalCode || attachment.code, name), h('span', {}, name))
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
  return {
    code: def.code,
    name: def.nameZh || def.name || def.code || '?',
    nameEn: def.nameEn || (def.nameZh && def.name !== def.nameZh ? def.name : ''),
    subname: def.subnameZh || def.subname || '',
    klass: (def.klass || 'neutral').toLowerCase(),
    type: def.type || (isEnemy ? 'enemy' : (isLoc ? 'location' : '')),
    cost: def.cost,
    xp: def.xp ?? 0,
    slot: def.slot || (Array.isArray(def.slots) && def.slots[0]) || null,
    slots: def.slots || (def.slot ? [def.slot] : []),
    icons: def.icons || {},
    text: def.textZh || def.text || '',
    flavor: def.flavorZh || def.flavor || '',
    traits: def.traitsZh || def.traits || [],
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
  return code === '03103' && enemy.fight === -2 ? 'X' : enemy.fight
}

function renderSkillIcons(icons) {
  if (!icons) return null
  const parts = []
  for (const [sk, n] of Object.entries(icons)) {
    const k = sk.toLowerCase()
    for (let i = 0; i < (Number(n) || 0); i++) {
      parts.push(h('span', { className: 'ah-rule-symbol', title: AH_SKILL_NAME[k] || sk, 'aria-label': AH_SKILL_NAME[k] || sk, role: 'img' }, tableIcon(({willpower:'star',intellect:'book',combat:'sword',agility:'leaf',wild:'star'})[k])))
    }
  }
  return parts.length ? h('div', { className: 'ah-card-full-icons' }, parts) : null
}

// 完整卡牌渲染（用于卡牌详情弹窗与卡组构筑）。
function renderFullCard(def) {
  const d = cardDisplay(def)
  if (!d) return h('div', { className: 'ah-card-full' }, '?')
  const color = (state.session && state.session.state.classColors && state.session.state.classColors[d.klass]) || AH_CLASS_COLOR[d.klass] || '#9ca3af'
  const clsName = (state.session && state.session.state.classNames && state.session.state.classNames[d.klass]) || AH_CLASS_NAME[d.klass] || d.klass

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
      d.health != null ? h('span', null, cardSymbol(h, 'health'), ' 生命值 ' + d.health) : null,
      d.sanity != null ? h('span', null, cardSymbol(h, 'sanity'), ' 神智值 ' + d.sanity) : null
    ))
  }
  if (d.isEnemy) {
    statRows.push(h('div', { className: 'ah-card-full-stats' },
      h('span', null, '⚔️ ' + enemyFightDisplay(d)),
      h('span', null, '💨 ' + d.evade),
      h('span', null, '❤️ ' + d.health),
      h('span', null, '🗡️ ' + (d.damage || 0)),
      h('span', null, '😱 ' + (d.horror || 0))
    ))
    const enemyKws = []
    if (d.hunter) enemyKws.push('猎手')
    if (d.retaliate) enemyKws.push('反击')
    if (d.alert) enemyKws.push('警戒')
    if (d.elite) enemyKws.push('精英')
    if (d.massive) enemyKws.push('庞大')
    if (d.victory) enemyKws.push('胜利点 ' + d.victory)
    if (enemyKws.length) statRows.push(h('div', { className: 'ah-card-full-kws' },
      enemyKws.map((k) => h('span', { className: 'ah-kw ah-kw-flag' }, k))))
  }
  if (d.isLoc) {
    statRows.push(h('div', { className: 'ah-card-full-stats' },
      d.shroud != null ? h('span', null, '帷幕 ' + d.shroud) : null,
      h('span', null, '🔍 ' + (d.cluesPerInvestigator != null ? d.cluesPerInvestigator + '/人' : (d.clues || 0)))
    ))
  }

  const kws = []
  if (d.slot) kws.push('槽位 ' + slotLabel(d.slot))
  if (d.traits && d.traits.length) kws.push('特性：' + d.traits.join(' / '))
  const flags = []
  if (d.isWeakness) flags.push('弱点')
  if (d.unique) flags.push('唯一')
  if (d.permanent) flags.push('常驻')
  if (d.exceptional) flags.push('特例')
  if (d.exile) flags.push('流放')
  if (d.doubleSided) flags.push('双面')
  if (d.victory && !d.isEnemy) flags.push('胜利点 ' + d.victory)
  if (flags.length) kws.push(flags.join(' · '))

  return h('div', { className: 'ah-card-full', style: { borderTop: '3px solid ' + color } },
    h('div', { className: 'ah-card-full-top' },
      h('div', { className: 'ah-card-full-badges' }, badges),
      h('div', { className: 'ah-card-full-meta' }, tableIcon(({act:'book',agenda:'eye',enemy:'sword',investigator:'ally',asset:'supply',location:'clue',treachery:'doom'})[d.type] || 'star'), ' ' + (AH_TYPE_LABEL[d.type] || d.type) + ' · ' + clsName)
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

function renderLocationDetail(detail) {
  const s = viewSession(), st = s.state
  const loc = st.locations.find(item => item.id === detail.locationId) || detail.def
  const front = detail.side === 'front' && loc.revealed
  const face = cardFaceText(detail.entry?.card || detail.def, detail.entry?.linkedCard, front ? 'front' : 'back')
  const rules = front ? face.textZh || face.text : [face.text === '通用卡背或此面没有独立卡文。' ? '' : face.text, face.flavor].filter(Boolean).join('\n\n')
  const plain = text => String(text || '').replace(/<[^>]+>/g, '').replace(/\[action\]/g, '行动：').replace(/\[reaction\]/g, '反应：')
    .replace(/\[(willpower|intellect|combat|agility)\]/g, (_,key) => ({willpower:'意志',intellect:'智识',combat:'战斗',agility:'敏捷'})[key])
  const entryEffect = loc.onEnter
  const entering = [entryEffect?.damage ? `受到 ${entryEffect.damage} 点伤害` : '', entryEffect?.horror ? `受到 ${entryEffect.horror} 点恐惧` : '',
    entryEffect?.test ? `进行${st.skillNames?.[entryEffect.test.skill] || ({willpower:'意志',intellect:'智识',combat:'战斗',agility:'敏捷'})[entryEffect.test.skill]}检定（难度 ${entryEffect.test.difficulty}）` : ''].filter(Boolean)
  const counters = [
    ['shroud','eye','帷幕',loc.revealed ? (loc.shroud ?? 0) + (loc.shroudMod || 0) + (st.fogMod || 0) : '？'],
    ['clues','clue','线索',loc.clues || 0],['doom','doom','毁灭',loc.doom || 0],['resources','resource','资源',loc.resources || 0],
  ]
  const decision = st.pendingChoice?.seat ?? st.currentSeat
  const moves = !state.busy && !presentation.isBlocking && canAct(s, decision) ? entityMoves(st,'location:' + loc.id) : []
  const people = st.investigators.filter(inv => inv.location === loc.id && !inv.defeated && !inv.resigned)
  const enemies = st.enemies.filter(enemy => enemy.location === loc.id)
  const attachments = [...locationAttachments(s, loc), ...(st.storyAssets || []).filter(asset => asset.location === loc.id).map(asset => ({...ahCardDef(s,asset.code),...asset}))]
  return h('div', { className: 'ah-location-dossier' },
    h('header', {}, h('small', {}, '调查档案 · 地点'),h('h2', {},loc.name),h('span', {className:'ah-location-state'},loc.revealed ? '已揭示' : '未揭示')),
    h('div',{className:'ah-location-detail-layout'},
      h('div',{className:'ah-location-detail-art'},
        renderImage(h,detail.entry?.images || detail.entry?.card?.images || detail.def.images,front ? 'front' : 'back'),
        h('nav',{'aria-label':'地点卡面'},[['front','已揭示'],['back','未揭示']].map(([side,label]) => h('button',{
          disabled:side === 'front' && !loc.revealed,'aria-pressed':String(detail.side === side),
          onclick:()=>{detail.side=side;render()},title:side === 'front' && !loc.revealed ? '进入地点后揭示' : '查看'+label+'卡面',
        },label)))),
      h('div',{className:'ah-location-detail-info'},
        h('div',{className:'ah-location-counters','aria-label':'地点当前状态'},counters.map(([key,icon,label,value]) => h('div',{
          className:detail.focusInfo === key ? 'is-focused' : '', 'data-location-stat':key,
        },tableIcon(icon),h('strong',{},value),h('small',{},label)))),
        front ? h('section',{className:'ah-location-entry-effect'},h('h3',{},'进入地点'),h('p',{},entering.length ? entering.join('；') : '没有额外的进入惩罚。'))
          : h('section',{className:'ah-location-entry-effect'},h('h3',{},'探索未知'),h('p',{},loc.revealed ? '正在查看此地点揭示前的卡面。' : '进入后翻开地点，并结算进入效果。')),
        h('section',{className:'ah-location-rules'},h('h3',{},front ? '地点效果' : '地点描述'),
          h('p',{},renderRulesText(h,plain(rules) || (front ? '此地点没有额外的卡面效果。' : '进入此地点以揭示更多信息。'))),
          h('div',{},...cardRuleIds(loc).map(id=>ruleLink(h,id)),ruleLink(h,'clues','调查与线索'),ruleLink(h,'encounter','揭示效果')),
          front && loc.resign ? h('span',{className:'ah-location-trait'},'可在此撤退') : null,
          front && loc.victory ? h('span',{className:'ah-location-trait'},`胜利点 ${loc.victory}`) : null,
          loc.locked ? h('span',{className:'ah-location-trait is-danger'},'上锁中') : null),
        h('section',{className:'ah-location-occupants'},h('h3',{},'此处的调查员与敌人'),
          people.length || enemies.length ? h('div',{},
            people.map(inv=>h('button',{className:'is-investigator',onclick:()=>openCardDetailDef({...st.investigatorDefs[inv.code],...inv,type:'investigator'})},tableArt(h,inv.code,inv.name),h('span',{},inv.name))),
            enemies.map(enemy=>h('button',{className:'is-enemy',onclick:()=>openCardDetail(s,enemy)},tableArt(h,enemy.originalCode || enemy.code,enemy.name),h('span',{},enemy.name)))) : h('p',{},'目前无人停留。')),
        attachments.length ? h('section',{className:'ah-location-attachments'+(detail.focusInfo === 'attached' ? ' is-focused' : '')},h('h3',{},'附属卡'),
          attachments.map(card=>h('button',{onclick:()=>openCardDetail(s,{...card,attachedTo:{type:'location',name:loc.name}})},card.nameZh || card.name || card.code))) : null,
        h('section',{className:'ah-location-connections'},h('h3',{},'通往'),h('div',{},(loc.connections || []).map(id=>st.locations.find(item=>item.id===id)).filter(Boolean).map(other=>
          h('button',{onclick:()=>openCardDetailDef({...other,type:'location'})},'→ '+other.name)))),
        h('footer',{className:'ah-location-detail-actions'},moves.length ? moves.map(move=>h('button',{className:'ah-action',onclick:()=>{state.cardDetail=null;cardMove(move,s)}},move.label || ({move:'移动到此处',investigate:'调查',locationAbility:'使用地点能力'})[move.action] || '执行行动'))
          : h('span',{},'此处暂无可执行的行动')))),
    detail.loading ? h('p',{className:'ah-location-loading',role:'status'},'正在展开地点档案…') : null,
    detail.error ? h('p',{className:'ah-location-loading',role:'status'},'卡牌资料暂时无法加载，仍可查看当前地点状态。') : null)
}

function renderCardDetailModal(detail) {
  const close = () => { state.cardDetail = null; render() }
  return h('div', { className: 'bg-backdrop ah-carddetail-backdrop' },
    h('div', { className: 'bg-modal ah-carddetail-modal' + (detail.locationId ? ' ah-location-detail' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': '卡牌详情', onclick: event => event.stopPropagation(), onkeydown: event => { if (event.key === 'Escape') close() } },
      h('button', { className: 'ah-carddetail-close', 'aria-label': '关闭卡牌详情', onclick: close }, '关闭'),
      detail.locationId ? renderLocationDetail(detail) : renderDetailContent(h, detail, renderFullCard, render, viewSession()?.state),
      !detail.locationId ? renderRuntimeCardState(detail) : null,
      !detail.locationId ? renderReactionToggle(viewSession(),detail.def.code) : null,
      !detail.locationId && detail.interactionKey && state.session && !presentation.isBlocking && !state.session.state.pendingChoice &&
        canAct(state.session, state.session.state.currentSeat) && entityMoves(state.session.state, detail.interactionKey).length
        ? h('button', { className: 'ah-action', disabled: state.busy, onclick: () => {
          state.cardDetail = null; selectEntity(state.session, detail.interactionKey)
        } }, '对该目标行动') : null
    )
  )
}

function zoneCards(s, kind) {
  if (kind === 'victory') return (s.state.victoryDisplay || []).map(card => typeof card === 'string' ? { code: card } : card)
  return (s.state.setAsideCards || []).flatMap(card =>
    Array.from({ length: Math.max(0, card.count || 1) }, () => ({ ...card, count: undefined })))
}

function renderCardZoneModal(s) {
  const opened = state.arkhamZoneOpen
  if (!opened || opened.sessionId !== s.sessionId) return null
  const victory = opened.kind === 'victory'
  const cards = zoneCards(s, opened.kind)
  const title = victory ? '胜利区' : '放在一边的卡牌'
  const close = () => { state.arkhamZoneOpen = null; render() }
  const points = victory ? cards.reduce((sum, card) => sum + (card.victory ?? ahCardDefRaw(s, card.code).victory ?? 0), 0) : 0
  return h('div', { className: 'bg-backdrop ah-card-zone-backdrop', onclick: close },
    h('section', { className: 'ah-card-zone-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title,
      onclick: event => event.stopPropagation(), onkeydown: event => { if (event.key === 'Escape') close() } },
      h('header', {},
        h('div', {}, h('small', {}, victory ? 'SCENARIO / VICTORY DISPLAY' : 'SCENARIO / SET ASIDE'),
          h('h2', {}, tableIcon(victory ? 'star' : 'supply'), title),
          h('p', {}, victory ? `${cards.length} 张卡牌 · 共 ${points} 胜利点` : `${cards.length} 张卡牌仍在场外等待`)),
        h('button', { className: 'ah-card-zone-close', 'aria-label': `关闭${title}`, onclick: close }, '关闭')),
      cards.length ? h('div', { className: 'ah-card-zone-grid', role: 'group', 'aria-label': `${title}中的卡牌` },
        cards.map((card, index) => {
          const def = { ...ahCardDefRaw(s, card.code), ...card }
          const name = def.nameZh || def.name || card.code
          const code = def.originalCode || card.originalCode || card.code
          return h('button', { className: 'ah-card-zone-card', 'data-zone-card': card.code,
            'aria-label': `查看${name}`, title: `查看卡牌详情 · ${name}`, onclick: () => openCardDetail(s, def) },
            h('span', { className: 'ah-card-zone-art' }, tableArt(h, code, name)),
            h('span', { className: 'ah-card-zone-caption' }, h('strong', {}, name),
              victory ? h('small', {}, `胜利点 ${def.victory || 0}`) : h('small', {}, `档案 ${String(index + 1).padStart(2, '0')}`)))
        })) : h('div', { className: 'ah-card-zone-empty' }, tableIcon(victory ? 'star' : 'supply'),
          h('strong', {}, victory ? '胜利区还是空的' : '没有放在一边的卡牌'),
          h('span', {}, victory ? '击败带有胜利点的敌人或完成地点调查后，卡牌会出现在这里。' : '本剧本当前没有仍放在一边的卡牌。')),
      h('footer', {}, victory ? '胜利区会随剧本结算实时更新。' : '点击卡牌可查看正面资料；卡牌仍由剧本效果决定何时入场。')))
}

async function cardMove(move, displayedSession) {
  const session = state.session
  if (!session || state.busy || presentation.isBlocking || session.sessionId !== displayedSession.sessionId) return
  const st = session.state
  const pending = st.pendingChoice
  const seat = pending ? pending.seat : st.currentSeat
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
    const r = await api('POST', '/move', { sessionId: session.sessionId, ...version, ...(batchChoices
      ? { batchChoices } : { move: { ...mv, ...version } }) })
    if (sameSession()) {
      state.session = r.session
      if (batchChoices) state.arkhamChoiceDraft = null
      state.arkhamSelection = null
      if (state.arkhamMapView) state.arkhamMapView.selectedId = null
      clearCardDrag()
      const feedback = { sessionId: session.sessionId, revision: r.session.state.revision, label: move.label || '行动已确认' }
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
      state.error = String(e.message)
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
  if (!moves.length) return null
  const grouped = new Map()
  for (const move of moves) {
    const group = move.targetId ? `${move.action}:${move.assetId}:${move.abilityIndex}:${move.optionIndex ?? ''}` : JSON.stringify(move)
    if (!grouped.has(group)) grouped.set(group, [])
    grouped.get(group).push(move)
  }
  const popover = h('div', { className: 'ah-card-action-popover', role: 'group', 'aria-label': '卡牌操作' },
    [...grouped.values()].map(group => {
      const m = group[0]
      return h('button', { className: 'ah-action', disabled: state.busy || !humanTurn, title: m.label, 'aria-label': m.label, 'data-location-move': m.action === 'move' ? m.locationId : null,
        onclick: () => {
          if (group.length === 1) cardMove(m, s)
          else { state.arkhamTargetAbility = { sessionId: s.sessionId, revision: s.state.revision, assetId: m.assetId, abilityIndex: m.abilityIndex, optionIndex: m.optionIndex }; state.arkhamDirectActions = null; render() }
        } }, tableIcon(({ fight: 'sword', evade: 'leaf', move: 'action', investigate: 'clue', ability: 'star' })[m.action] || 'book'),
      group.length > 1 ? '指向目标' : ({ fight: '攻击', evade: '躲避', engage: '交战', move: '移动至此', investigate: '调查', advanceAct: '推进场景', drawCultist: '抽取异教徒' })[m.action] || renderRulesText(h,m.label,{links:false}))
    }),
    h('button', { className: 'ah-action secondary', onclick: () => { state.arkhamSelection = null; state.arkhamDirectActions = null; state.arkhamTargetAbility = null; render() } }, '取消'))
  requestAnimationFrame(() => {
    if (!popover.isConnected) return
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
        message: response.busy ? '服务端仍在结算，请稍后再次刷新；不会自动重新提交行动。' : '局势已刷新，请根据当前合法选项操作。',
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
  const items = choicePresentation(s.state)
  const reactions = reactionChoices(s.state)
  const names = { turnOrder: '准备开始行动', mulligan: '点选手牌换牌', commit: '拖入卡牌以投入检定',
    discard: '点选或拖出要弃掉的牌', 'discard-hand': '选择弃牌', assetReplacement: '点选装备腾出槽位',
    'assign-damage': '点选角色或装备承受伤害', 'assign-horror': '点选角色或装备承受恐惧',
    prey: '选择交战角色 · 点击头像或将怪物拖向角色', target: '点选发光的目标', investigator: '点选角色', playerWindow: '点选装备使用能力', reaction: '点选卡牌发动反应' }
  const ordering = choice.kind === 'scry' && choice.options?.some(option => option.cardCodes?.length)
  const offers = ordering ? [] : items.filter(item => !item.control && (!item.key || !item.key.startsWith('hand:')))
  const assigningHarm = ['assign-damage', 'assign-horror'].includes(choice.kind)
  const test = assigningHarm ? null : s.state.skillTest, testSource = test?.source
  const staged = humanTurn ? choiceDraft(s)?.selected || [] : []
  const skillName = ({ intellect: '智识', combat: '战斗', agility: '敏捷', willpower: '意志' })[test?.skill] || '技能'
  const testValue = test?.value ?? test?.baseValue ?? '—'
  const testBase = test?.printedValue ?? test?.baseValue ?? testValue
  const testDelta = Number.isFinite(testValue) && Number.isFinite(testBase) ? testValue - testBase : 0
  return h('section', { className: 'ah-choice ah-direct-prompt', role: 'region', 'aria-label': '待决选择',
    'aria-busy': String(!!state.busy), 'data-choice-id': choice.id, 'data-choice-kind': choice.kind,
    'data-choice-seat': choice.seat, 'data-interaction': choice.kind === 'commit' ? 'zone:commit' : 'zone:discard' },
    h('div', { className: 'ah-direct-instruction', role: 'status' },
      h('strong', { className: test ? 'ah-test-context' : '' }, test ? `${testSource?.label || '技能检定'} · ${testSource?.name || skillName + '检定'}` : humanTurn ? names[choice.kind] || '结算卡牌效果' : '等待队友操作'),
      h('span', { className: 'ah-choice-prompt' }, renderRulesText(h,choice.prompt,{links:false}))),
    testSource?.code ? h('button', { className: 'ah-test-source', 'data-card-code': testSource.code, title: '查看检定来源：' + testSource.name,
      onclick: () => openCardDetailDef({ ...ahCardDef(s, testSource.code), code: testSource.code, name: testSource.name }) }, tableArt(h, testSource.code, testSource.name)) : null,
    test ? h('div', { className: 'ah-test-preview',
      'aria-label': `${skillName}：基础 ${testBase}，修正 ${testDelta>=0?'+':''}${testDelta}，当前 ${testValue}，难度 ${test.difficulty}` },
      tableIcon(({ intellect: 'book', combat: 'sword', agility: 'leaf', willpower: 'star' })[s.state.skillTest.skill]),
      h('strong', {}, skillName + ' ' + testBase,
        testDelta ? h('small', { className: 'ah-test-modifier ' + (testDelta > 0 ? 'is-positive' : 'is-negative') }, `${testDelta>0?'+':''}${testDelta}`) : null,
        ' / 难度 ' + test.difficulty),
      h('span', {}, '已投入 ' + (s.state.skillTest.committed?.length || 0) + ' 张' + (staged.length ? ` · 待确认 ${staged.length} 张` : ''))) : null,
    staged.length ? h('div', { className: 'ah-choice-staged', role: 'status', 'aria-label': '本机待确认卡牌' },
      `本机已选 ${staged.length} 张，点击已选卡牌可撤销；确认后同步`,
      h('div', { className: 'ah-committed-cards' }, staged.map(item => tableArt(h, item.code, ahCardDef(s, item.code).name || item.code)))) : null,
    test?.committed?.length ? h('div', { className: 'ah-committed-cards', 'aria-label': '已投入卡牌' },
      s.state.skillTest.committed.map(card => tableArt(h, card.code, ahCardDef(s, card.code).name || card.code))) : null,
    items.filter(item => item.control).flatMap(item => {
      const assisting = choice.kind === 'commit' && s.state.skillTest?.seat != null && s.state.skillTest.seat !== choice.seat
      const finish = choice.kind === 'commit' && item.move.optionId === 'done'
      const button = (label, title, onclick, extra = '') => h('button', { className: 'ah-action ah-choice-option' + extra,
        'data-option-id': item.move.optionId, disabled: state.busy || !humanTurn, title, onclick }, label)
      // A helper's staged card is only sent once they explicitly submit it.
      if (finish && assisting && staged.length) return [
        button('提交投入', `投入已选的 ${staged.length} 张牌协助检定`, () => cardMove(item.move, s), ' ah-commit-submit'),
        button('放弃协助', '撤销已选卡牌，不投入任何牌', () => {
          const draft = choiceDraft(s)
          if (draft) draft.selected = []
          cardMove(item.move, s)
        }, ' secondary'),
      ]
      return [button(finish ? assisting ? '放弃协助' : '开始检定' : renderChoiceText(h,item.label),
        choice.kind === 'commit' && item.move.optionId === 'help' ? '完成自己的投入，询问同地点队友是否协助' : item.label,
        () => cardMove(item.move, s))]
    }),
    humanTurn && reactions.length && reactions.every(item=>item.code) ? h('button',{
      className:'ah-action secondary ah-mute-reaction',disabled:state.busy,
      title:'关闭本次可选卡牌的反应提示，可在卡牌上的开关重新开启',
      onclick:()=>{setReactionEnabled(s.sessionId,choice.seat,reactions.map(item=>item.code),false);lastReactionPass=null;render()},
    },'本局不再询问') : null,
    ordering ? renderScryOrder(s, humanTurn) : null,
    offers.length ? h('div', { className: 'ah-visual-choices', 'aria-label': '卡牌效果' }, offers.map(item => {
      const cards = item.cards.length ? item.cards : item.code ? [{ code: item.code, name: item.label }] : []
      const optionIcon = ({ intellect: 'book', combat: 'sword', agility: 'leaf', willpower: 'star' })[item.move.optionId]
        || (choice.kind === 'token' ? 'star' : choice.kind === 'payment' ? 'clue' : 'book')
      return h('button', { className: 'ah-choice-option ah-visual-option' + (cards.length ? ' has-art' : ' ah-effect-option'),
        'aria-label': item.label,
        'data-option-id': item.move.optionId, 'data-choice-offer': item.key, 'data-keep-offer': choice.kind === 'prey' || assigningHarm ? 'true' : null,
        'data-interaction': choice.kind === 'prey' ? item.key : null, disabled: state.busy || !humanTurn,
        title: item.label, onclick: () => cardMove(item.move, s) },
        cards.length ? h('span', { className: 'ah-offer-cards' }, cards.map(card => tableArt(h, card.code, card.nameZh || card.name))) :
          tableIcon(optionIcon),
        h('span', {}, renderChoiceText(h,item.label)))
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
  const amount=h('input',{type:'number',min,max,step:1,value,role:'spinbutton','aria-label':'支付线索数量',disabled:!enabled})
  const submit=h('button',{className:'ah-action ah-payment-confirm',disabled:!enabled,
    onclick:()=>{const move=moves.find(move=>Number(move.optionId)===state.arkhamCluePayment.value);if(move&&enabled)cardMove(move,s)}},`确认支付 ${value} 个线索`)
  const minus=h('button',{type:'button','aria-label':'减少支付线索',disabled:!enabled||value<=min,onclick:()=>setValue(state.arkhamCluePayment.value-1)},'−')
  const plus=h('button',{type:'button','aria-label':'增加支付线索',disabled:!enabled||value>=max,onclick:()=>setValue(state.arkhamCluePayment.value+1)},'+')
  const setValue=next=>{
    if(!enabled)return
    const clamped=Math.max(min,Math.min(max,Math.trunc(Number(next)||min)))
    const legal=values.reduce((best,n)=>Math.abs(n-clamped)<Math.abs(best-clamped)?n:best,min)
    state.arkhamCluePayment.value=legal;amount.value=String(legal)
    minus.disabled=legal<=min;plus.disabled=legal>=max;submit.textContent=`确认支付 ${legal} 个线索`
  }
  amount.onchange=()=>setValue(amount.value)
  amount.onblur=()=>setValue(amount.value)
  amount.onkeydown=event=>{
    if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){
      event.preventDefault();setValue(event.key==='Home'?min:event.key==='End'?max:state.arkhamCluePayment.value+(event.key==='ArrowUp'?1:-1))
    }
    if(event.key==='Enter'){event.preventDefault();setValue(amount.value);submit.click()}
  }
  return h('section',{className:'ah-choice ah-clue-payment',role:'region','aria-label':'共同支付线索','data-choice-id':choice.id,'data-choice-kind':'payment','aria-busy':String(!!state.busy)},
    h('header',{},tableIcon('clue'),h('div',{},h('small',{},`第 ${payment.round||1} 轮分摊`),h('h2',{},'共同支付线索'))),
    payment.required!=null?h('div',{className:'ah-payment-progress'},
      h('span',{},'总需求 ',h('b',{},payment.required)),h('span',{},'已支付 ',h('b',{},payment.paid)),h('span',{},'还需 ',h('b',{},payment.remaining))):h('p',{},renderRulesText(h,choice.prompt,{links:false})),
    h('div',{className:'ah-payment-payer'},inv?.code?tableArt(h,inv.code,inv.name):null,
      h('div',{},h('strong',{},inv?.name||'调查员'),h('span',{},`持有 ${payment.available??inv?.clues??0} 个线索`))),
    humanTurn?h('div',{},h('div',{className:'ah-payment-dial'},minus,amount,plus),
      h('p',{className:'ah-payment-range'},`本次至少 ${min} 个，最多 ${max} 个`),submit):h('p',{role:'status'},'等待该调查员确认支付数量…'),
    h('small',{className:'ah-payment-note'},'未付清时继续轮询调查员；没有可用线索的席位自动跳过。'))
}

function renderScryOrder(s, humanTurn) {
  const choice = s.state.pendingChoice
  const key = `${s.sessionId}:${s.state.revision}:${choice.id}`
  if (state.arkhamScryOrder?.key !== key) state.arkhamScryOrder = { key, codes: [...choice.options.find(option => option.cardCodes?.length).cardCodes] }
  const codes = state.arkhamScryOrder.codes
  const reorder = (from, to) => { if (state.busy || !humanTurn || from === to) return; codes.splice(to,0,codes.splice(from,1)[0]); render() }
  const chosen = choice.options.find(option => option.cardCodes?.join('|') === codes.join('|'))
  const move = s.state.legalMoves.find(m => m.choiceId === choice.id && m.optionId === chosen?.id)
  return h('div', { className: 'ah-scry-order', 'aria-label': '排列牌库顶' },
    h('strong', {}, '从左到右：牌库顶 → 底'),
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
      tableArt(h,code,ahCardDef(s,code).name || code),
      h('span', {}, h('button',{ disabled: !humanTurn || state.busy || index === 0, 'aria-label': `将第 ${index+1} 张牌前移`, onclick: () => reorder(index,index-1) },'←'),
        String(index+1),h('button',{ disabled: !humanTurn || state.busy || index === codes.length-1, 'aria-label': `将第 ${index+1} 张牌后移`, onclick: () => reorder(index,index+1) },'→'))))),
    h('button', { className: 'ah-action', disabled: !humanTurn || state.busy || !move, onclick: () => move && cardMove(move,s) }, '确认牌序'))
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
  const reason = !act ? '当前场景已结束' : !costsClues ? '完成卡面目标后推进' : !enough ? `线索不足，还需 ${required - available} 个${location ? '（仅计算' + location + '）' : ''}`
    : !humanTurn ? '等待你的行动或回答窗口' : !move ? '线索已足够，等待本场景规定的推进窗口' : `共同支付 ${required} 个线索推进当前场景`
  return h('button', { className: 'ah-act-advance' + (!disabled ? ' is-ready' : ''), disabled,
    'aria-label': '推进场景', title: reason, onclick: () => move && cardMove(move, s) },
    h('strong', {}, tableIcon('book'), '推进场景'),
    h('span', {}, tableIcon('clue'), costsClues ? `线索 ${available} / ${required}` : '完成场景目标'),
    h('small', {}, location ? `仅限${location}` : costsClues ? (!enough ? `还需 ${required - available}` : move ? '可推进' : '等待推进窗口') : '按卡面条件推进'))
}

// 当前场景/密谋卡面赋予的行动，排在剧本书与提示卡之后。推进场景已有独立按钮，不重复显示。
// 服务端 scriptActions 列出卡面行动（含暂不可执行的原因），可执行时匹配同一条合法动作提交。
function renderScriptActions(s, humanTurn) {
  const st = s.state
  if (st.status !== 'playing') return null
  const same = (a, b) => a.action === b.action && (a.rule ?? null) === (b.rule ?? null) && (a.skill ?? null) === (b.skill ?? null)
  const legal = (st.legalMoves || []).filter(m => ['act', 'agenda'].includes(m.scriptCard) && m.action !== 'advanceAct')
  const hints = st.scriptActions || []
  const items = [...hints.map(hint => ({ hint, move: hint.reason ? null : legal.find(m => same(m, hint)) })),
    ...legal.filter(m => !hints.some(hint => same(m, hint))).map(move => ({ hint: move, move }))]
    .sort((a, b) => (a.hint.scriptCard === 'act' ? 0 : 1) - (b.hint.scriptCard === 'act' ? 0 : 1))
  if (!items.length) return null
  return h('div', { className: 'ah-script-actions', role: 'group', 'aria-label': '剧本可执行操作' },
    h('span', { className: 'ah-script-actions-title' }, tableIcon('book'), '剧本行动'),
    items.map(({ hint, move }) => {
      const source = hint.scriptCard === 'act' ? '场景' : '密谋'
      const text = String(hint.label || '').replace(/^[^\p{L}\p{N}（(]+/u, '')
      const reason = hint.reason || (!move ? '当前不能执行' : !humanTurn ? '尚未轮到你行动' : null)
      return h('button', { className: 'ah-script-action' + (reason ? ' is-unavailable' : ''), type: 'button',
        disabled: !!reason || state.busy, 'data-script-card': hint.scriptCard,
        title: `${source}：${text}${reason ? `（${reason}）` : ''}`, 'aria-label': `${source}：${text}`, onclick: () => move && cardMove(move, s) },
        h('small', {}, source), h('span', {}, text), reason ? h('em', { className: 'ah-script-action-reason' }, reason) : null)
    }))
}

function renderCardGame(s, autoPassing = false) {
  const st = s.state
  const over = st.status !== 'playing'
  const decisionSeat = st.pendingChoice ? st.pendingChoice.seat : st.currentSeat
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
    statusText = st.outcome === 'victory' ? '调查队获胜！' : st.outcome === 'survived' ? '调查队幸存（献祭结局）' : st.outcome === 'defeat' ? '调查队失败' : '对局结束'
  } else if (autoPassing) {
    statusText = '正在继续结算…'
  } else if (st.pendingChoice) {
    const inv = st.investigators.find(item => item.seat === decisionSeat)
    statusText = humanTurn
      ? '请你回答待决选择（' + (inv?.name || current.name) + '）'
      : '等待 ' + (inv?.name || current?.name || 'AI 队友') + ' 回答待决选择…'
  } else {
    const inv = st.investigators[st.currentSeat]
    statusText = humanTurn
      ? '轮到你行动（' + (inv ? inv.name : '') + ' · 剩余 ' + (inv ? inv.actionsLeft : 0) + ' 行动）'
      : (current ? current.name : '') + (activity.presenting ? ' · 行动演出中' : activity.processing ? ' · AI 回合 · 思考中…' : ' · 等待继续行动')
  }
  if (!over && humanFinished && !humanTurn) statusText = '你的回合已结束 · ' + statusText
  else if (!over && humanTurn && activity.processing) statusText = activity.presenting ? '正在结算你的行动…' : '正在提交你的行动…'

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
          'aria-label': `查看胜利区，共 ${zoneCards(s, 'victory').length} 张卡牌`,
          'aria-haspopup': 'dialog', 'aria-expanded': String(state.arkhamZoneOpen?.kind === 'victory'),
          onclick: () => { state.arkhamZoneOpen = { sessionId: s.sessionId, kind: 'victory' }; render() } },
        tableIcon('star'), h('span', {}, '胜利区'), h('b', {}, zoneCards(s, 'victory').length)),
        h('button', { className: 'bg-btn secondary ah-card-zone-launcher ah-aside-launcher',
          'aria-label': `查看放在一边的卡牌，共 ${zoneCards(s, 'aside').length} 张`,
          'aria-haspopup': 'dialog', 'aria-expanded': String(state.arkhamZoneOpen?.kind === 'aside'),
          onclick: () => { state.arkhamZoneOpen = { sessionId: s.sessionId, kind: 'aside' }; render() } },
        tableIcon('supply'), h('span', {}, '放在一边'), h('b', {}, zoneCards(s, 'aside').length)),
        h('button', { className: 'bg-btn secondary', 'data-situation-toggle': 'true', 'aria-haspopup': 'dialog',
          'aria-expanded': String(situationView.opened), title: '查看调查局势', onclick: () => situationView.open(s.sessionId) }, '局势'),
        h('button', { className: 'bg-btn secondary', onclick: () => arkhamCatalog.open() }, '全卡图鉴'),
        h('button', { className: 'bg-btn secondary ah-header-rulebook', title: '规则书 · F1', onclick: () => openRule() }, tableIcon('book'), '规则书'),
        h('button', { className: 'bg-btn secondary', 'aria-label': '刷新局势', title: '刷新局势', disabled: state.busy, onclick: () => refreshCardSession(s) }, '↻'),
        h('details', { className: 'ah-session-menu' }, h('summary', { 'aria-label': '对局菜单' }, '•••'),
        h('div', { className: 'ah-session-menu-items' },
        h('button', { className: 'bg-btn secondary', 'aria-pressed': String(presentation.preferences.sound), onclick: () => { presentation.toggleSound(); render() } }, presentation.preferences.sound ? '音效：开' : '音效：关'),
        h('button', { className: 'bg-btn secondary', 'aria-pressed': String(presentation.preferences.fast), onclick: () => { presentation.toggleFast(); render() } }, presentation.preferences.fast ? '动画：快速' : '动画：标准'),
        !st.hubFlow ? h('button', { className: 'bg-btn secondary', disabled: state.busy, onclick: reset }, '再来一局') : null,
        h('button', { className: 'bg-btn secondary', disabled: state.busy, onclick: leave }, '退出')
        ))
      )
    ),
    state.arkhamAcceptedFx?.sessionId === s.sessionId
      ? h('div', { className: 'ah-accepted-feedback', role: 'status' }, '✓ ' + state.arkhamAcceptedFx.label) : null,
    h('div', { className: 'bg-game-body ah-table-viewport' }, body),
    renderCardActionPopover(s, humanTurn)
  )
  mountCardInteractions(root, s, { state, submit: cardMove, beginInteraction,
    canInteract: () => !presentation.isBlocking && canAct(s, st.pendingChoice?.seat ?? st.currentSeat),
    selectedKey: () => currentSelection(s)?.key,
    select: key => selectEntity(s, key), inspect: key => inspectEntity(s, key),
    showActions: moves => { state.arkhamDirectActions = { sessionId: s.sessionId, revision: st.revision, moves }; render() },
    feedback: message => { state.error = message; render() } })
  const highlightResources = target => {
    const card=target?.closest?.('.ah-hand-card'), pool=root.querySelector('.ah-pool-resource')
    if(!pool)return
    const cost=Number(card?.dataset.resourceCost || 0)
    pool.classList.toggle('is-cost-preview',cost>0)
    pool.querySelector('.ah-pool-hint').textContent=cost>0 ? `牌面费用 ${cost}` : '可用资源'
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
    role: 'img', 'aria-label': (player.name || '玩家') + '的头像' })
}

function renderPlayerDock(s, inv, humanTurn) {
  const hand = inv.hand || []
  const selected = currentSelection(s)
  const preview = selected ? entityDefinition(s, selected.key) : null
  // Match the engine's enemiesEngagedWith rule, including co-located massive enemies.
  const engaged = s.state.enemies.filter(enemy => enemy.engagedSeat === inv.seat || (enemy.massive && enemy.location === inv.location))
  return h('div', { className: 'ah-player-board' },
    !engaged.length ? h('div', { className: 'ah-engage-drop', 'data-interaction': 'zone:engage', role: 'region', 'aria-label': '拖入敌人交战' },
      tableIcon('sword'), h('strong', {}, '拉入交战'), h('span', {}, '将同地点敌人拖到这里 · 消耗 1 行动')) : null,
    h('section', { className: 'ah-equipment-battlefield', 'aria-label': '装备与威胁' },
      h('div', { className: 'ah-play-surface' + (preview?.code ? ' has-card' : ''), 'data-interaction': 'zone:play', role: 'button', tabindex: 0, 'aria-label': '出牌区' },
        preview?.code ? tableArt(h, preview.originalCode || preview.code, preview.name) : [slotBackdrop('star'), h('span', { className: 'ah-play-label' }, '出牌区')]),
      renderEquipmentSlots(s, inv, humanTurn),
      inv.threat?.length ? h('div', { className: 'ah-threat-row', 'aria-label': `威胁区，共 ${inv.threat.length} 张` },
        h('span', { className: 'ah-threat-label' }, '威胁区'),
        h('div', { className: 'ah-threat-cards' }, inv.threat.map(card => renderMiniCard(s, card, false, { asset: true })))) : null),
    h('div', { className: 'ah-player-dock' },
    h('div', { className: 'ah-dock-investigator' },
      h('span', { className: 'ah-dock-portrait', 'aria-hidden': 'true' }, tableArt(h, inv.code, inv.name)),
      h('span', { className: 'ah-dock-kicker', title: (s.players[inv.seat]?.name || 'player') + ' · 调查员档案' }, renderPlayerAvatar(s.players[inv.seat]), (s.players[inv.seat]?.name || 'player') + ' · 调查员档案'),
      h('button', { className: 'ah-dock-name', 'data-interaction': `investigator:${inv.seat}`, onclick: () => openCardDetailDef({ ...s.state.investigatorDefs[inv.code], ...inv, type: 'investigator' }) },
        tableIcon(classIcon(inv.klass)), ' ', inv.name),
      h('div', { className: 'ah-dock-vitals' }, [['health','生命',inv.maxHealth,inv.damage],['sanity','理智',inv.maxSanity,inv.horror]].map(([kind,label,max,loss])=>{
        const current=Math.max(0,max-(loss || 0)), fill=max>0 ? Math.min(100,current/max*100) : 0
        return h('div',{className:'ah-vital ah-vital-'+kind,'aria-label':`${label} ${current} / ${max}`},
          tableIcon(kind),h('span',{className:'ah-vital-label'},label),h('span',{className:'ah-vital-value'},h('strong',{},current),h('small',{},'/ '+max)),
          h('span',{className:'ah-vital-track','aria-hidden':'true'},h('i',{style:{width:fill+'%'}})))
      })),
      h('div', {className:'ah-dock-skills','aria-label':'当前人物属性'}, ['willpower','intellect','combat','agility'].map(skill=>{
        const base=inv[skill] || 0, value=ahEffStat(s,inv,skill), delta=value-base
        const label=(s.state.skillNames || {})[skill] || skill
        return h('div', {className:'ah-dock-skill','data-skill':skill,title:`${label}：基础 ${base}，额外 ${delta>=0?'+':''}${delta}，当前 ${value}`,'aria-label':`${label}：基础 ${base}，额外 ${delta>=0?'+':''}${delta}，当前 ${value}`},
          tableIcon(({willpower:'star',intellect:'book',combat:'sword',agility:'leaf'})[skill]),
          h('div',{className:'ah-skill-value'},h('strong',{},base),delta ? h('small',{className:delta>0?'is-positive':'is-negative'},`${delta>0?'+':''}${delta}`) : null),h('span',{},label))
      })),
      h('div', { className: 'ah-dock-actions ah-action-points' + (inv.actionsLeft>0?'':' is-empty'), 'aria-label': `剩余 ${inv.actionsLeft} 行动` },
        h('strong',{className:'ah-action-count'},Math.max(0,inv.actionsLeft || 0)),h('small',{},'行动点'),
        h('div',{className:'ah-action-pips','aria-hidden':'true'},Array.from({ length: Math.max(3,Math.min(6,inv.actionsLeft || 0)) }, (_, index) =>
          h('span', { className: index < inv.actionsLeft ? 'is-ready' : '' }, tableIcon('action')))))),
    h('div',{className:'ah-personal-pools','aria-label':'资源与线索'},[['resource','资源',inv.resources],['clue','线索',inv.clues || 0]].map(([kind,label,value])=>
      h('section',{className:'ah-token-pool ah-pool-'+kind,'aria-label':label+'盘','data-pool':kind},
        h('div',{className:'ah-pool-tokens','aria-hidden':'true'},Array.from({length:Math.min(6,Math.max(0,value))},(_,i)=>h('i',{style:{'--token-index':i}},tableIcon(kind)))),
        h('strong',{},value),h('span',{},label),h('small',{className:'ah-pool-hint'},kind==='resource'?'可用资源':'已发现')))),
    h('div', { className: 'ah-hand-area' },
      h('div', { className: 'ah-cards ah-hand', 'data-hand-seat': inv.seat, 'data-hand-count': hand.length, 'aria-label': '手牌' },
        hand.length ? hand.map((card, index) => renderMiniCard(s, card, false, {
          source: 'hand', handIndex: index, handCount: hand.length, seat: inv.seat,
          draggable: humanTurn && !state.busy && (!s.state.pendingChoice || s.state.pendingChoice.kind === 'commit'),
        })) : h('span', { className: 'ah-hand-empty' }, '当前没有手牌'))),
    h('div', { className: 'ah-dock-tools' },
      h('button', { className: 'ah-dock-equipment', 'aria-label': '查看弃牌堆', onclick: () => { state.arkhamDiscardOpen = !state.arkhamDiscardOpen; render() } }, `弃牌 ${inv.discard?.length || 0}`),
      h('button', { className: 'ah-dock-deck', title: '点击牌库抽牌', 'aria-label': '从牌库抽牌', disabled: state.busy || !humanTurn || !s.state.legalMoves.some(m => m.action === 'draw'),
        onclick: () => { const move = s.state.legalMoves.find(m => m.action === 'draw'); if (move) cardMove(move, s) } },
        h('img', { className: 'ah-deck-back', src: '/mods/arkhamhorror/img/backs/back_player.webp', alt: '' }),
        h('span', {}, `牌库 ${inv.deckSize ?? inv.deck?.length ?? 0} · 弃牌 ${inv.discard?.length || 0}`))),
    state.arkhamDiscardOpen ? h('section', { className: 'ah-discard-tray', 'aria-label': '弃牌堆' },
      h('button', { 'aria-label': '关闭弃牌堆', onclick: () => { state.arkhamDiscardOpen = false; render() } }, '关闭'),
      (inv.discard || []).map((code, index) => h('div', { 'data-interaction': index === inv.discard.length - 1 ? 'discard:top' : null }, renderMiniCard(s, code))),
      !inv.discard?.length ? h('span', {}, '弃牌堆为空') : null) : null),
    engaged.length ? h('section', { className: 'ah-engagement-zone', 'aria-label': '交战区', 'data-engaged-count': engaged.length, 'data-interaction': 'zone:engage' },
      h('div', { className: 'ah-engagement-heading' }, tableIcon('sword'), h('span', {}, '交战中'), h('b', {}, `${engaged.length} 名敌人`)),
      h('div', { className: 'ah-engagement-cards' }, engaged.map(enemy=>h('div',{className:'ah-engaged-enemy'},renderEnemyChip(s,enemy),
        h('div',{className:'ah-engaged-enemy-stats'},tableIcon('health'),`${Math.max(0,enemy.health-(enemy.damageTaken||0))}`,tableIcon('sword'),enemyFightDisplay(enemy),tableIcon('leaf'),enemy.evade)))),
      h('small',{className:'ah-engagement-hint'},'拖动武器或角色至敌人 · 点击选择行动')) : null)
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
  const staged = opts.source === 'hand' && choiceDraft(s)?.selected.some(item => item.index === opts.handIndex)
  const isSelected = !!staged || selected?.code === code && (opts.source === 'hand' ? selected.handIndex === opts.handIndex : selected.assetId === reference?.id)
  const fan = opts.source === 'hand' ? fanStyle(opts.handCount, opts.handIndex) : null
  const commit = opts.source === 'hand' ? handCommitMove(s, opts.handIndex) : null
  const assetStats = opts.asset ? [
    cd.cost != null ? `费用 ${cd.cost}` : '',
    cd.health != null ? `生命值 ${cd.health}` : '',
    cd.sanity != null ? `神智值 ${cd.sanity}` : '',
    d.courage ? '技能图标：无' : '',
  ].filter(Boolean).join(' · ') : ''
  const activate = (focusActions = false) => {
    if (state.busy) return
    if (commit) return cardMove(commit, s)
    if (s.state.pendingChoice) return openCardDetail(s, reference)
    if (opts.source === 'hand') return selectCard(s, { code, handIndex: opts.handIndex }, focusActions)
    if (opts.asset) return selectCard(s, { code, assetId: reference.id }, focusActions)
    openCardDetail(s, reference)
  }
  return h('div', {
    className: 'ah-minicard' + (opts.source === 'hand' ? ' ah-hand-card' : '') + (d.courage ? ' ah-minicard-courage' : '') + (exhausted ? ' ah-minicard-exhausted' : '') + (draggable ? ' ah-minicard-draggable' : '') + (isSelected ? ' is-selected' : ''),
    style: fan,
    title: cd.name + (assetStats ? '\n' + assetStats : '') + (cd.text ? '\n\n' + cd.text : '') + '\n\n（点击选择；可在动作栏查看详情和合法操作）',
    role: 'button', tabindex: 0,
    'aria-label': cd.name + (assetStats ? `，${assetStats}` : '') + (commit ? '，投入技能检定' : opts.asset ? '，查看资产能力' : opts.source === 'hand' ? '，选择手牌' : '，查看详情'),
    'aria-pressed': opts.source === 'hand' || opts.asset ? String(!!isSelected) : null,
    draggable: 'false',
    'data-interaction': opts.source === 'hand' ? `hand:${opts.seat ?? 0}:${opts.handIndex}` : opts.asset ? `asset:${reference.id}` : null,
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
    tableArt(h, d.originalCode || code, cd.name),
    renderReactionToggle(s,code),
    h('div', { className: 'ah-minicard-cost' }, cd.cost != null ? cd.cost : ''),
    opts.asset && cd.sanity != null ? h('div', {
      className: 'ah-minicard-capacity ah-minicard-sanity',
      title: `神智值 ${cd.sanity}`,
      'aria-label': `神智值 ${cd.sanity}`,
    }, tableIcon('sanity'), h('b', {}, String(cd.sanity))) : null,
    cd.xp ? h('div', { className: 'ah-minicard-xp' }, '✦' + cd.xp) : null,
    cd.isWeakness ? h('div', { className: 'ah-minicard-weakness' }, '⚠') : null,
    cd.doubleSided ? h('div', { className: 'ah-minicard-ds' }, '⇄') : null,
    h('div', { className: 'ah-minicard-name' }, (exhausted ? '✗ ' : '') + (cd.name || code)),
    opts.asset ? placedCardMarkers(h, d) : null,
    iconEls.length ? h('div', { className: 'ah-minicard-icons' }, iconEls) : null,
    h('div', { className: 'ah-minicard-meta' }, typeIcon + ' ' + (cd.klass || '')),
    h('div', { className: 'ah-minicard-bar', style: { background: clsColor } })
  )
}

function renderLocationNode(s, loc, opts = {}) {
  const st = s.state
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
    className: `ah-loc-badge ah-loc-${kind}`, 'data-map-info': kind, title: `${label} ${value ?? ''}`, 'aria-label': `${loc.name} · ${label} ${value ?? ''}`,
    onclick: event => { event.stopPropagation(); openCardDetailDef({ ...loc, type: 'location' }, { focusInfo: kind }) },
    onkeydown: event => event.stopPropagation(),
  }, tableIcon(kind === 'clues' ? 'clue' : kind === 'locked' ? 'lock' : kind === 'attached' ? 'book' : kind === 'resources' ? 'resource' : kind), value == null ? null : String(value))
  const badges = []
  if (loc.clues) badges.push(resourceBadge('clues', '线索', loc.clues, `此地点有 ${loc.clues} 个线索。`))
  if (loc.locked) badges.push(resourceBadge('locked', '上锁', null, '此地点目前处于上锁状态。'))
  if (loc.doom) badges.push(resourceBadge('doom', '毁灭', loc.doom, `此地点有 ${loc.doom} 个毁灭标记。`))
  if (loc.resources) badges.push(resourceBadge('resources', '资源', loc.resources, `此地点有 ${loc.resources} 个资源。`))
  if (attachments.length) badges.push(resourceBadge('attached', '附属卡', attachments.length,
    attachments.map(item => typeof item === 'string' ? item : item.name || ahCardDef(s, item.code).name || '附属卡').join('、')))
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
    title: loc.name + (loc.revealed ? '' : ' · 未揭示') + (adjacent ? ' · 可移动' : ''),
    role: 'button', tabindex: 0,
    'aria-label': loc.name, 'aria-pressed': String(view.selectedId === loc.id),
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
    tableArt(h, loc.originalCode || loc.code || loc.artCode, loc.name, { face: loc.revealed ? 'front' : 'back' }),
    opts.onDragStart ? h('button', { className: 'ah-map-node-handle', type: 'button',
      'aria-label': `调整「${loc.name}」位置`, title: '拖动调整本地地图位置',
      onpointerdown: event => { event.stopPropagation(); opts.onDragStart(event, loc.id) },
      onclick: event => event.stopPropagation(),
    }, '⠿') : null,
    h('div', { className: 'ah-location-caption' }, loc.name),
    badges.length ? h('div', { className: 'ah-loc-badges' }, badges) : null,
    here.length ? h('div', { className: 'ah-location-investigators' }, here.map(inv => h('button', {
      className: 'ah-map-investigator', title: inv.name, 'aria-label': `查看调查员 ${inv.name}`,
      'data-seat': inv.seat,
      'data-inspect-default': 'true',
      'data-interaction': `investigator:${inv.seat}`,
      style: { '--investigator-color': AH_CLASS_COLOR[inv.klass] || '#aaa' },
      onclick: event => { event.stopPropagation(); openCardDetailDef({ ...st.investigatorDefs[inv.code], ...inv, type: 'investigator' }) },
    }, tableArt(h, inv.code, inv.name)))) : null,
    enemiesHere.length ? h('div', { className: 'ah-location-entities', onclick: event => event.stopPropagation(),
      onkeydown: event => event.stopPropagation() }, enemiesHere.map(enemy => renderEnemyChip(s, enemy, { map: true }))) : null,
    attachments.length ? h('div', { className: 'ah-location-story-markers' }, attachments.map((asset,index) => {
      const def = ahCardDef(s, asset.code), name = asset.nameZh || asset.name || def.nameZh || def.name || asset.code
      const attached = index < attachedCards.length
      return h('button', { className: 'ah-map-story-marker' + (attached ? ' ah-map-attachment' : ''), 'data-map-info': attached ? 'attachment' : 'story',
        'data-attachment-code': attached ? asset.code : null,
        title: (attached ? '附着于' + loc.name + ' · ' : '') + name, 'aria-label': `查看${attached ? '附属卡' : '场景卡'} ${name}`,
        onclick: event => { event.stopPropagation(); openCardDetail(s, { ...asset, attachedTo: attached ? { type: 'location', name: loc.name } : undefined }) }, onkeydown: event => event.stopPropagation(),
        oncontextmenu: event => { event.preventDefault(); event.stopPropagation(); openCardDetail(s,{ ...asset, attachedTo: attached ? { type: 'location', name: loc.name } : undefined }) },
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
  const slots = normalizeAhSlots(def)
  return slots.length ? slots.some(value => (value === 'handx2' ? 'hand' : value) === slot) : slot === 'other'
}

function dropMove(s, code, index, kind, slot = null) {
  if (kind === 'choice') {
    const move = handCommitMove(s, index)
    return move ? { move } : { reason: '这张手牌不能投入当前检定；请选择待决选择中的合法选项。' }
  }
  if (s.state.pendingChoice) return { reason: '请先完成当前待决选择。' }
  const move = findPlayMove(s, code)
  const def = ahCardDef(s, code)
  if (kind === 'equip' && def.type !== 'asset') return { reason: '只有支援卡可以放入装备栏。' }
  if (kind === 'equip' && !assetFitsSlot(def, slot)) return { reason: `「${def.nameZh || def.name || code}」不能占用这个装备槽。` }
  return move ? { move } : { reason: `「${def.nameZh || def.name || code}」当前不在服务端合法动作列表中；请检查资源、行动点和时机。` }
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
  proxy.textContent = def.nameZh || def.name || code
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
    const def = ahCardDef(s, asset.code)
    // Older sessions only exposed Daisy's tote bag by card code.
    const extra = def.extraSlots || { ...def.passive?.extraSlots,
      hand: def.passive?.handSlotsBonus || (asset.code === '01008' ? 2 : 0) }
    for (const [slot, amount] of Object.entries(extra)) bonus[slot] = (bonus[slot] || 0) + amount
  }
  return bonus
}

function slotBackdrop(kind, mirrored = false) {
  return h('span', { className: 'ah-slot-backdrop' + (mirrored ? ' is-mirrored' : ''), 'data-slot-art': kind, 'aria-hidden': 'true' }, tableIcon(kind))
}

function renderEquipmentSlots(s, inv, humanTurn) {
  const order = ['hand', 'ally', 'arcane', 'accessory', 'body', 'tarot']
  const labels = { hand: '手部', ally: '盟友', arcane: '法术', accessory: '饰品', body: '身体', tarot: '塔罗' }
  const capacity = { hand: 2, ally: 1, arcane: 2, accessory: 1, body: 1, tarot: 1 }
  const bonuses = ahSlotBonuses(s, inv)
  for (const slot of order) capacity[slot] += bonuses[slot] || 0
  const cells = Object.fromEntries(order.map(slot => [slot, Array.from({ length: capacity[slot] }, () => null)]))
  const other = []
  for (const asset of inv.assets || []) {
    const def = ahCardDef(s, asset.code)
    const required = normalizeAhSlots(def).flatMap(slot => slot.endsWith('x2') ? [slot.slice(0, -2), slot.slice(0, -2)] : [slot]).filter(slot => cells[slot])
    if (!required.length) { other.push(asset); continue }
    required.forEach((slot, index) => {
      let cell = cells[slot].findIndex(value => !value)
      // Retain every public asset even when a temporary state exceeds capacity.
      if (cell < 0) cell = cells[slot].length
      cells[slot][cell] = { asset, linked: index > 0, shared: required.length > 1,
        reason: required.every(value => value === 'hand') ? '双手占用' : required.every(value => value === 'arcane') ? '双法术位占用' : '跨槽占用' }
    })
  }
  const slots = order.flatMap(slot => cells[slot].map((entry, index) => {
    const label = slot === 'hand' ? ['左手', '右手'][index] || '额外手部 ' + (index - 1)
      : slot === 'arcane' || cells[slot].length > 1 ? labels[slot] + ' ' + (index + 1) : labels[slot]
    const asset = entry?.asset
    const def = asset ? ahCardDef(s, asset.code) : null
    const used = entry ? 1 : 0
    return h('div', {
      className: 'ah-equip-slot' + (entry ? ' ah-equip-slot-full' : '') + (entry?.linked ? ' is-linked-slot' : ''),
      'data-slot': slot, 'data-slot-index': index, 'data-interaction': 'slot:' + slot,
      'data-slot-used': used, 'data-slot-capacity': 1,
      'data-slot-group-used': cells[slot].filter(Boolean).length, 'data-slot-group-capacity': capacity[slot],
      role: 'button', tabindex: 0, 'aria-label': label + '装备槽 ' + used + '/1' + (entry?.shared ? ' · ' + entry.reason : ''),
      ondragover: humanTurn ? event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move' } : null,
      ondrop: humanTurn ? event => handlePlayDrop(s, event, 'equip', slot) : null,
    },
      slotBackdrop(slot, slot === 'hand' && index === 1),
      h('div', { className: 'ah-equip-slot-head' }, h('span', { className: 'ah-equip-slot-label' }, label), h('span', { className: 'ah-equip-slot-count' }, used + '/1')),
      h('div', { className: 'ah-equip-slot-cards' }, entry?.linked
        ? h('button', { className: 'ah-slot-linked', 'data-interaction': 'asset:' + asset.id,
          'aria-label': (def.nameZh || def.name) + ' · ' + entry.reason, title: (def.nameZh || def.name) + ' · ' + entry.reason,
          onclick: () => openCardDetail(s, asset),
        }, tableArt(h, asset.code, def.nameZh || def.name), h('span', { className: 'ah-slot-occupancy' }, entry.reason))
        : asset ? renderMiniCard(s, asset, asset.exhausted, { slot, asset: true, draggable: false }) : null))
  }))
  slots.push(...[...other, null].map((asset, index) => h('div', {
    className: 'ah-equip-slot ah-equip-other' + (asset ? ' ah-equip-slot-full' : ''),
    'data-slot': 'other', 'data-slot-index': index, 'data-interaction': 'slot:other',
    'data-slot-used': asset ? 1 : 0, 'data-slot-capacity': 1,
    role: 'button', tabindex: 0, 'aria-label': '其他资产 ' + (index + 1) + (asset ? ' · 已装备' : ' · 可放置'),
    ondragover: humanTurn ? event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move' } : null,
    ondrop: humanTurn ? event => handlePlayDrop(s, event, 'equip', 'other') : null,
  },
    slotBackdrop('supply'),
    h('div', { className: 'ah-equip-slot-head' }, h('span', { className: 'ah-equip-slot-label' }, '其他资产')),
    h('div', { className: 'ah-equip-slot-cards' }, asset ? renderMiniCard(s, asset, asset.exhausted, { slot: 'other', asset: true, draggable: false }) : null)
  )))
  return h('div', { className: 'ah-inv-zone ah-equip-zone' },
    h('div', { className: 'ah-zone-label' }, '装备栏'), h('div', { className: 'ah-equip-slots' }, slots))
}

function currentMapView(s) {
  const key = `calm:${s.sessionId}:${s.state.scenario?.id || ''}`
  if (state.arkhamMapView?.key !== key) {
    let saved = {}
    try { saved = JSON.parse(localStorage.getItem(`arkham-map:${key}`) || '{}') } catch { /* local storage is optional */ }
    state.arkhamMapView = { key, scale: 1, tx: 0, ty: 0, fitted: false, positions: saved.positions || {} }
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
  viewport = h('div', { className: 'ah-map-viewport', role: 'group', tabindex: 0, 'aria-label': '可缩放地点地图',
    'aria-description': '空白处滚轮缩放、拖动平移、双击适配。键盘加减号缩放，0 适配，E 调整排布，R 重置排布。',
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
    if (!view.fitted || view.viewportWidth !== viewport.clientWidth || view.viewportHeight !== viewport.clientHeight) fitMap(view, viewport, scene)
    else mapTransform(view, scene)
    view.viewportWidth = viewport.clientWidth; view.viewportHeight = viewport.clientHeight
    mapResizeObserver?.disconnect()
    const observer = new ResizeObserver(() => {
      if (!root.isConnected) { observer.disconnect(); return }
      if (view.viewportWidth === viewport.clientWidth && view.viewportHeight === viewport.clientHeight) return
      fitMap(view, viewport, scene)
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
  if (e.hunter) kws.push('猎手')
  if (e.retaliate) kws.push('反击')
  if (e.alert) kws.push('警戒')
  if (e.elite) kws.push('精英')
  if (e.massive) kws.push('庞大')
  if (e.prey) kws.push('猎物·' + (AH_PREY_LABEL[e.prey] || e.prey))
  if (e.victory) kws.push('胜利点' + e.victory)
  return h('div', { className: 'ah-enemy' + (e.massive ? ' is-massive' : '') + (victoryLevel ? ` has-victory victory-${victoryLevel}` : '') + (choiceMove ? ' ah-choice-target' : '') + (e.exhausted ? ' is-exhausted' : ''), title: choiceMove ? '选择此敌人作为目标' : `${e.name} · ${canEngage ? '拖向你的角色或交战区以主动交战（1 行动） · ' : ''}点击查看详情`, role: 'button', tabindex: 0,
    'aria-label': `${e.name} · 生命 ${e.health - (e.damageTaken || 0)}/${e.health}${e.exhausted ? ' · 已横置' : ''}`,
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
      '战斗' + enemyFightDisplay(e) + ' · 躲避' + e.evade + ' · 生命 ' + (e.health - e.damageTaken) + '/' + e.health +
      (e.damage ? ' · 伤' + e.damage : '') + (e.horror ? ' · 惧' + e.horror : '')),
    kws.length ? h('div', { className: 'ah-enemy-kws' }, kws.map((k) => h('span', { className: 'ah-enemy-kw' }, k))) : null,
    h('div', { className: 'ah-enemy-state' },
      (atLoc ? atLoc.name : e.location) + ' · ' +
      (engagedName ? '与「' + engagedName + '」交战' : (e.massive ? '与同地点所有人交战' : '游荡中')) +
      (e.exhausted ? ' · 已横置' : ''))
  )
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
    ({ draw: '抽牌', resource: '资源', investigate: '调查', endTurn: '结束回合', move: '移动至此' })[m.action] || m.label)
  const additional = !selection && !location
    ? moves.filter(move => !shown.includes(move) && !move.scriptCard && !['play','ability','fight','evade','engage','parley','parleyCultist','move','locationAbility','discardThreat','purgeThreat','payDebt','advanceAct','drawCultist','interruptRitual','sacrificeLita','freeAction'].includes(move.action))
    : []
  const buttons = [...shown, ...additional].map(button)
  const def = selection ? entityDefinition(s, selection.key) : null
  return h('div', {
    className: 'ah-actions',
    'data-drop-kind': 'play',
    onkeydown: event => { if (event.key === 'Escape' && selection) { state.arkhamSelection = null; render() } },
    ondragover: humanTurn ? event => { event?.preventDefault?.(); if (event?.dataTransfer) event.dataTransfer.dropEffect = 'move' } : null,
    ondrop: humanTurn ? event => handlePlayDrop(s, event, 'play') : null,
  }, selection ? h('span', { className: 'ah-context-name' }, def.nameZh || def.name || selection.code) : null,
  selection ? h('span', { className: 'ah-context-reason' }, selectedMoves(s, selection).length ? '拖动或点选发光目标 · 右键查看卡牌 · Esc 取消' : handUnavailableReason(s, selection.key, state.busy) || '当前不能使用；检查费用、行动点与时机。') : null,
  buttons,
  location ? h('span', { className: 'ah-location-context' }, h('strong', {}, location.name),
    location.revealed ? ` · 帷幕 ${location.shroud} · 线索 ${location.clues}` : ' · 未揭示') : null,
  location ? h('button', { className: 'ah-action secondary', onclick: () => openCardDetailDef({ ...location, type: 'location' }, { runtime: true }) }, '查看地点详情') : null,
  location ? h('button', { className: 'ah-action secondary', onclick: () => { currentMapView(s).selectedId = null; render() } }, '取消选择') : null,
  selection ? h('button', { className: 'ah-action secondary', onclick: () => openCardDetailDef(def) }, selection.key?.startsWith('location:') ? '查看地点详情' : '查看卡牌详情') : null,
  selection ? h('button', { className: 'ah-action secondary', onclick: () => { state.arkhamSelection = null; state.arkhamDirectActions = null; state.arkhamTargetAbility = null; render() } }, '取消选择') : null)
}

