// Presentation only: every clickable option must have a matching server legal move.
import { t } from './i18n.js'
import { chaosTokenFace } from './chaos-token.js'
import { tableIcon } from './table-components.js'
import { cardDisplayName } from './catalog.js'

const operations = {
  seal: 'mechanic.seal', release: 'mechanic.release', claimKey: 'mechanic.claimKey', giveKeys: 'mechanic.giveKeys',
  spendKey: 'mechanic.spendKey', enterVehicle: 'mechanic.enterVehicle', leaveVehicle: 'mechanic.leaveVehicle',
  driveVehicle: 'mechanic.driveVehicle', commitOrigin: 'mechanic.commitOrigin', returnCommitment: 'mechanic.returnCommitment',
  // 七循环《地球边缘》交互操作（P4）：封印/伙伴/钥匙/忒咳哩-哩/牌库顶/跨座位/演武/物资。
  eoteFrost: 'mechanic.eoteFrost', eotePartner: 'mechanic.eotePartner', eoteSeal: 'mechanic.eoteSeal',
  eoteKey: 'mechanic.eoteKey', eoteTekeli: 'mechanic.eoteTekeli', eoteDeckTop: 'mechanic.eoteDeckTop',
  eoteCrossSeat: 'mechanic.eoteCrossSeat', eoteDiscipline: 'mechanic.eoteDiscipline', eoteSupply: 'mechanic.eoteSupply',
  // 八循环《绯红密钥》交互操作（P4）：隐匿揭露/密钥变换/空洞回收/世界地图/定制勾选/跨座位即时行动。
  tskConcealed: 'mechanic.tskConcealed', tskKey: 'mechanic.tskKey', tskHollow: 'mechanic.tskHollow',
  tskMap: 'mechanic.tskMap', tskCustomizable: 'mechanic.tskCustomizable', tskCrossSeat: 'mechanic.tskCrossSeat',
}
// 寒霜标记没有打包卡图时退回 ❄ 字形；其它标记面保持原有 img 行为不变。
const tokenChip = (h, token) => {
  if (token == null) return null
  const face = chaosTokenFace(token)
  if (face.src) return h('img', { className: 'ah-choice-token', src: face.src, alt: '', draggable: false })
  return face.key === 'frost'
    ? h('span', { className: 'ah-choice-token ah-choice-token-fallback', 'data-token': 'frost', 'aria-hidden': 'true' }, '❄')
    : null
}
const colors = { red: 'mechanic.key.red', yellow: 'mechanic.key.yellow', green: 'mechanic.key.green', blue: 'mechanic.key.blue',
  purple: 'mechanic.key.purple', white: 'mechanic.key.white', black: 'mechanic.key.black', unrevealed: 'mechanic.key.unrevealed' }
const stages = { items: 'mechanic.stage.items', recipient: 'mechanic.stage.recipient', driver: 'mechanic.stage.driver', destination: 'mechanic.stage.destination' }
export const keyLabel = color => t(colors[color] || colors.unrevealed)
export const floodLabel = level => t(['mechanic.flood.dry', 'mechanic.flood.partial', 'mechanic.flood.full'][level] || 'mechanic.flood.dry')
let focusKey = null

// ── 取消选择后的焦点恢复（P4-C 验收口径）─────────────────────────────────────────
// 机制选择的来源可能是「点击卡牌动作条」而非真实聚焦卡牌，面板关闭后焦点会掉到 body。
// 这里记住最近的桌面交互实体（点击/聚焦均可），取消后按来源 key 重新查找渲染后的新实体；
// 找不到时退回牌桌动作条，保证 Escape 取消后键盘焦点不丢失。
let lastInteractionKey = null
let interactionTrackingInstalled = false
const restoreKeys = new Map()
function ensureInteractionTracking() {
  if (interactionTrackingInstalled || typeof document === 'undefined') return
  interactionTrackingInstalled = true
  const remember = event => {
    const target = event.target instanceof Element ? event.target.closest('[data-interaction]') : null
    if (target?.dataset?.interaction) lastInteractionKey = target.dataset.interaction
  }
  document.addEventListener('click', remember, true)
  document.addEventListener('focusin', remember, true)
}
function rememberRestoreKey(sessionId, choice) {
  const id = `${sessionId}:${choice.id}`
  if (restoreKeys.has(id)) return restoreKeys.get(id)
  const active = typeof document !== 'undefined' ? document.activeElement : null
  const focusedKey = active?.closest?.('[data-interaction]')?.dataset?.interaction || null
  const key = focusedKey || lastInteractionKey || null
  restoreKeys.set(id, key)
  if (restoreKeys.size > 32) restoreKeys.delete(restoreKeys.keys().next().value)
  return key
}
function interactionElement(key) {
  if (!key || typeof document === 'undefined') return null
  return [...document.querySelectorAll('[data-interaction]')].find(element => element.dataset.interaction === key) || null
}
function restoreChoiceFocus(key) {
  if (typeof document === 'undefined') return
  // 多阶段选择会立刻渲染下一个面板：此时由新面板的自动聚焦接管，不抢焦点。
  if (document.querySelector('.ah-mechanic-choice')) return
  const target = interactionElement(key) || interactionElement(lastInteractionKey)
    || document.querySelector('.ah-table-actions .ah-action') || document.querySelector('.ah-table-actions')
  target?.focus?.({ preventScroll: true })
}
function restoreAfterChoice(result, key) {
  const restore = () => queueMicrotask(() => restoreChoiceFocus(key))
  if (result && typeof result.then === 'function') result.then(restore, restore)
  else setTimeout(restore, 0)
}
// 尽早挂载：机制选择可能由「点击卡牌动作条」触发，安装监听必须早于那次点击。
if (typeof document !== 'undefined') ensureInteractionTracking()

export function renderTokenSequence(h, tokens = []) {
  if (!tokens.length) return null
  return h('ol', { className: 'ah-mechanic-tokens', 'aria-label': t('mechanic.sequence') }, tokens.map(item => {
    const face = chaosTokenFace(item.face)
    return h('li', { 'data-token-index': item.index, 'data-token': item.face },
      face.src ? h('img', { className: 'ah-choice-token', src: face.src, alt: '', draggable: false }) : null,
      h('span', {}, `${item.index + 1}. ${face.label}`),
      item.as && item.as !== item.face ? h('small', {}, t('mechanic.treatedAs', { token: chaosTokenFace(item.as).label })) : null,
      h('small', {}, item.cancelled ? t('mechanic.cancelled') : Number.isFinite(item.modifier) ? `${item.modifier >= 0 ? '+' : ''}${item.modifier}` : '—'))
  }))
}

export function renderMechanicChoice(h, session, { disabled, busy, onSubmit, inspectCard }) {
  const state = session.state, choice = state.pendingChoice
  if (choice?.kind !== 'mechanic') return null
  const moves = (state.legalMoves || []).filter(move => move.action === 'choose' && move.choiceId === choice.id)
  const options = (choice.options || []).map(option => ({ ...option, move: moves.find(move => move.optionId === option.id) }))
  const enabled = !disabled && !busy
  ensureInteractionTracking()
  const restoreKey = rememberRestoreKey(session.sessionId, choice)
  const submit = option => {
    if (!enabled || !option?.move) return
    const result = onSubmit(option.move)
    // 取消（Escape 或取消按钮）：等 HTTP move 结算并重渲染后，把焦点还给来源实体。
    if (option.id === 'cancel') restoreAfterChoice(result, restoreKey)
  }
  const tokenLabel = option => option.token != null ? chaosTokenFace(option.token).label
    : option.keyColor ? keyLabel(option.keyColor)
      : option.cardCode ? cardDisplayName(state.cards?.[option.cardCode]) || option.cardCode : option.label
  const action = option => {
    const label = option.id === 'cancel' ? t('mechanic.cancel') : option.id === 'confirm' ? t('mechanic.confirm') : tokenLabel(option)
    return h('button', { type: 'button', className: 'ah-tcu-option' + (['cancel', 'confirm'].includes(option.id) ? ' is-secondary' : ''),
      'data-option-id': option.id, 'data-mechanic-option': option.id,
      ...(option.id.startsWith('pick:') ? { 'aria-pressed': String(!!option.selected) } : {}),
      disabled: !enabled || !option.move, title: option.label,
      'aria-label': option.id.startsWith('pick:') ? t('mechanic.option', { label, index: Number(option.id.slice(5)) + 1 }) : label,
      onfocus: () => { focusKey = { sessionId: session.sessionId, optionId: option.id } }, onclick: () => submit(option),
    }, tokenChip(h, option.token),
    option.selected ? '✓ ' : '', label,
    option.id.startsWith('pick:') ? h('small', {}, `#${Number(option.id.slice(5)) + 1}`) : null)
  }
  const panel = h('section', { className: 'ah-choice ah-direct-prompt ah-tcu-panel ah-mechanic-choice', role: 'region',
    'aria-label': t(operations[choice.source?.operation] || 'mechanic.choice'), 'data-choice-kind': 'mechanic',
    'data-choice-id': choice.id,
    'data-mechanic-choice': choice.source?.operation, 'aria-busy': String(!!busy),
    onkeydown: event => {
      if (event.key === 'Escape' && enabled) {
        const cancel = options.find(option => option.id === 'cancel' && option.move)
        if (cancel) { event.preventDefault(); event.stopPropagation(); submit(cancel) }
      }
    },
  }, h('header', { className: 'ah-tcu-head' }, h('h2', {}, t(operations[choice.source?.operation] || 'mechanic.choice'))),
  h('p', { className: 'ah-tcu-note', role: 'status' }, busy ? t('mechanic.submitting') : disabled ? t('mechanic.waiting')
    : `${t(stages[choice.source?.stage] || stages.items)} · ${t('mechanic.selection', { count: choice.source?.selectedCount || 0, min: choice.source?.min, max: choice.source?.max })}`),
  renderTokenSequence(h, state.mechanics?.tokens),
  h('div', { className: 'ah-mechanic-options' }, options.filter(option => option.id.startsWith('pick:')).map(option =>
    h('div', { className: 'ah-mechanic-option-cell' }, action(option),
      option.cardCode ? h('button', { type: 'button', className: 'bg-btn secondary', disabled: busy,
        'data-mechanic-detail': option.cardCode, 'data-focus-key': `mechanic-detail:${option.cardCode}`, 'aria-label': t('game.choice.inspectAria', { name: tokenLabel(option) }),
        onfocus: () => { focusKey = { sessionId: session.sessionId, detailCode: option.cardCode } },
        onclick: () => { focusKey = { sessionId: session.sessionId, detailCode: option.cardCode }; inspectCard(option.cardCode) } }, t('game.choice.inspect')) : null))),
  h('div', { className: 'ah-tcu-actions' }, options.filter(option => !option.id.startsWith('pick:')).map(action)),
  !options.length ? h('p', { className: 'ah-tcu-note' }, t('mechanic.empty')) : null)
  queueMicrotask(() => {
    if (!panel.isConnected || !enabled || document.querySelector('.ah-carddetail-modal')) return
    const detail = focusKey?.sessionId === session.sessionId && focusKey.detailCode
      ? [...panel.querySelectorAll('[data-mechanic-detail]')].find(item => item.dataset.mechanicDetail === focusKey.detailCode) : null
    const button = detail || [...panel.querySelectorAll('[data-mechanic-option]:not(:disabled)')]
      .find(item => focusKey?.sessionId === session.sessionId && item.dataset.mechanicOption === focusKey.optionId)
      || panel.querySelector('button:not(:disabled)')
    if (!panel.contains(document.activeElement)) button?.focus({ preventScroll: true })
  })
  return panel
}

export function renderMechanicSummary(h, state, { seat = 0, moves = [], canAct = false, submit = null } = {}) {
  const model = state.mechanics
  if (!model || (!model.water && !model.keys && !model.vehicles && !model.eote && !model.tsk)) return null
  const water = model.water?.investigators.find(item => item.seat === seat)
  const holderName = holder => {
    const [kind, ...parts] = holder.split(':'), id = parts.join(':')
    const entity = kind === 'enemy' ? state.enemies.find(item => item.id === id) : kind === 'asset'
      ? [...(state.storyAssets || []), ...state.investigators.flatMap(inv => inv.assets || [])].find(item => item.id === id) : null
    if (entity) return cardDisplayName(entity) || cardDisplayName(state.cards?.[entity.code]) || id
    return kind === 'location' ? state.locations.find(item => item.id === id)?.name || id
      : kind === 'investigator' ? state.investigators.find(item => item.seat === Number(id))?.name || id
        : holder === 'reference' ? t('mechanic.reference') : id
  }
  const cardName = code => cardDisplayName(state.cards?.[code]) || code
  const seatName = value => state.investigators.find(item => item.seat === value)?.name || String(value)
  const eote = model.eote
  const partnerStatus = status => t({
    safe: 'mechanic.eote.status.safe', mia: 'mechanic.eote.status.mia',
    eliminated: 'mechanic.eote.status.eliminated', resolute: 'mechanic.eote.status.resolute',
  }[status] || 'mechanic.eote.status.safe')
  const sealKind = kind => t('mechanic.eote.sealKind', { kind })
  const sealState = seal => {
    if (seal.locationId != null) return t(seal.active ? 'mechanic.eote.seal.placed' : 'mechanic.eote.seal.dormant')
    if (seal.placedBySeat != null) return t(seal.active ? 'mechanic.eote.seal.active' : 'mechanic.eote.seal.held')
    return t('mechanic.eote.seal.dormant')
  }
  const sealPlacement = seal => seal.locationId != null
    ? holderName(`location:${seal.locationId}`)
    : seal.placedBySeat != null ? seatName(seal.placedBySeat) : t('mechanic.eote.seal.unheld')
  // ── 八循环《绯红密钥》P4 交互摘要（公开/本人可见；未揭露迷你卡不显示真身）──────────────
  const tsk = model.tsk
  const positionLabel = position => t({
    left: 'mechanic.tsk.positionLeft', middle: 'mechanic.tsk.positionMiddle', right: 'mechanic.tsk.positionRight',
  }[position] || 'mechanic.tsk.positionAtLocation')
  const keyHolder = holder => holder.type === 'investigator'
    ? seatName(holder.seat)
    : holder.type === 'enemy' ? t('mechanic.tsk.holderEnemy') : t('mechanic.tsk.holderNone')
  const tskSummary = tsk ? h('div', { className: 'ah-tsk-summary' },
    tsk.concealed?.length ? h('section', { className: 'ah-tsk-concealed', 'aria-label': t('mechanic.tsk.concealed') },
      h('h3', {}, t('mechanic.tsk.concealed')),
      h('p', { 'data-tsk-concealed-count': String(tsk.concealed.length), 'data-tsk-concealed-hidden': String(tsk.concealed.filter(card => !card.visible).length) },
        t('mechanic.tsk.concealedLine', { count: tsk.concealed.length })),
      tsk.concealed.map((card, index) => h('p', {
        'data-tsk-concealed': String(index), 'data-location': card.locationId,
        'data-position': card.position || 'atLocation', 'data-visible': String(card.visible),
      }, holderName(`location:${card.locationId}`), ' · ', positionLabel(card.position),
      ' · ', card.visible ? (card.decoy ? t('mechanic.tsk.decoy') : t('mechanic.tsk.realEnemy')) : t('mechanic.tsk.hiddenIdentity')))) : null,
    tsk.keys?.length ? h('section', { className: 'ah-tsk-keys', 'aria-label': t('mechanic.tsk.keys') },
      h('h3', {}, t('mechanic.tsk.keys')),
      tsk.keys.map(key => {
        const mine = key.holder.type === 'investigator' && key.holder.seat === seat
        const shiftMove = mine && canAct ? moves.find(move => move.action === 'shiftKey' && move.keyId === key.id) : null
        const transferMoves = mine && canAct ? moves.filter(move => move.action === 'transferKey' && move.keyId === key.id) : []
        return h('p', {
          'data-tsk-key': key.id, 'data-stable': String(key.stable), 'data-holder-type': key.holder.type,
          'data-shifted-this-round': String(key.shiftedThisRound),
        }, key.id, ' · ', key.stable ? t('mechanic.tsk.face.stable') : t('mechanic.tsk.face.unstable'), ' · ', keyHolder(key.holder),
        key.shiftedThisRound ? ` · ${t('mechanic.tsk.shifted')}` : '',
        shiftMove ? h('button', { type: 'button', className: 'bg-btn', 'data-tsk-key-shift': key.id,
          disabled: !submit, onclick: () => submit?.(shiftMove) }, t('mechanic.tsk.shift')) : null,
        ...transferMoves.map(move => h('button', { type: 'button', className: 'bg-btn secondary',
          'data-tsk-key-transfer': key.id, 'data-to-seat': String(move.toSeat),
          disabled: !submit, onclick: () => submit?.(move) },
        t('mechanic.tsk.transfer', { seat: seatName(move.toSeat) }))))
      })) : null,
    tsk.hollows ? h('section', { className: 'ah-tsk-hollows', 'aria-label': t('mechanic.tsk.hollows') },
      h('h3', {}, t('mechanic.tsk.hollows')),
      h('p', { 'data-tsk-hollow-count': String(tsk.hollows.count) }, t('mechanic.tsk.hollowCount', { count: tsk.hollows.count })),
      (tsk.hollows.cards || []).map(card => h('p', { 'data-tsk-hollow-card': card.code }, t('mechanic.tsk.hollowCard', { code: card.code })))) : null,
    tsk.map ? h('section', { className: 'ah-tsk-map', 'aria-label': t('mechanic.tsk.map') },
      h('h3', {}, t('mechanic.tsk.map')),
      h('p', { 'data-tsk-map-current': tsk.map.current || '', 'data-tsk-map-time': String(tsk.map.time) },
        t('mechanic.tsk.mapLine', { current: tsk.map.current || '', time: tsk.map.time, unlocked: tsk.map.unlocked.length })),
      tsk.map.forced ? h('p', { className: 'ah-tcu-note', 'data-tsk-map-forced': tsk.map.forced }, t('mechanic.tsk.mapForced', { destination: tsk.map.forced })) : null) : null,
    // 2026-11-13 P1-12：章节公开状态摘要（计数/位置/布尔；数据来自 mechanic-view 的声明式投影）。
    tsk.scenarioFlags?.length ? h('section', { className: 'ah-tsk-scenario-flags', 'aria-label': t('mechanic.tsk.scenarioFlags') },
      h('h3', {}, t('mechanic.tsk.scenarioFlags')),
      tsk.scenarioFlags.map(row => h('p', { 'data-tsk-flag': row.key, 'data-flag-kind': row.kind },
        `${row.label}：${row.value}`))) : null,
    tsk.statusReports ? h('section', { className: 'ah-tsk-status', 'aria-label': t('mechanic.tsk.statusReports') },
      h('h3', {}, t('mechanic.tsk.statusReports')),
      h('p', { 'data-tsk-status-pending': String(tsk.statusReports.pending.length) },
        t('mechanic.tsk.statusLine', { pending: tsk.statusReports.pending.length, triggered: tsk.statusReports.triggered.length }))) : null,
    tsk.dossiers ? h('section', { className: 'ah-tsk-dossiers', 'aria-label': t('mechanic.tsk.dossiers') },
      h('h3', {}, t('mechanic.tsk.dossiers')),
      h('p', { 'data-tsk-dossier-unlocked': String(tsk.dossiers.unlocked.length), 'data-tsk-dossier-read': String(tsk.dossiers.read.length) },
        t('mechanic.tsk.dossierLine', { unlocked: tsk.dossiers.unlocked.length, read: tsk.dossiers.read.length })),
      tsk.dossiers.unlocked.map(key => h('p', {
        'data-tsk-dossier': key, 'data-read': String(tsk.dossiers.read.includes(key)),
      }, t('mechanic.tsk.dossierItem', { key }), tsk.dossiers.read.includes(key) ? ` · ${t('mechanic.tsk.dossierRead')}` : ''))) : null,
    tsk.customizations?.length ? h('section', { className: 'ah-tsk-customizations', 'aria-label': t('mechanic.tsk.customizations') },
      h('h3', {}, t('mechanic.tsk.customizations')),
      tsk.customizations.map(row => h('p', {
        'data-tsk-customization': row.code, 'data-level': String(row.level), 'data-checked': String(row.checked.length),
      }, row.code, ' · ', t('mechanic.tsk.customizationLine', { level: row.level, checked: row.checked.length })))) : null,
    tsk.crossSeat?.length ? h('section', { className: 'ah-tsk-cross-seat', 'aria-label': t('mechanic.tsk.crossSeat') },
      h('h3', {}, t('mechanic.tsk.crossSeat')),
      tsk.crossSeat.map(row => h('p', { 'data-tsk-cross-seat': String(row.targetSeat), 'data-from-seat': String(row.from) },
        t('mechanic.tsk.crossSeatLine', { from: seatName(row.from), to: seatName(row.targetSeat) })))) : null) : null
  return h('details', { className: 'ah-mechanic-summary ah-tcu-panel' }, h('summary', {}, t('mechanic.summary'),
    water ? h('span', { className: 'ah-mechanic-air', 'data-air-required': String(water.airRequired) },
      floodLabel(water.level), ' · ', water.airRequired ? t('mechanic.airRisk', { damage: water.damage }) : t('mechanic.airSafe')) : null),
    renderTokenSequence(h, model.tokens),
    model.keys ? h('section', { 'aria-label': t('mechanic.keys') }, h('h3', {}, t('mechanic.keys')),
      model.keys.length ? model.keys.map((item, index) => h('p', { 'data-key-color': item.color, 'data-key-holder': item.holder, 'data-key-index': index }, keyLabel(item.color), ' · ', holderName(item.holder)))
        : h('p', {}, t('mechanic.noKeys'))) : null,
    model.vehicles?.map(vehicle => h('section', { 'data-vehicle-id': vehicle.id }, h('h3', {}, vehicle.name || vehicle.id),
      h('p', {}, t(vehicle.running ? 'mechanic.running' : 'mechanic.stopped'), ' · ', holderName(`location:${vehicle.location}`), ' · ',
        t('mechanic.capacity', { count: vehicle.passengers.length, capacity: vehicle.capacity })),
      h('p', {}, t('mechanic.driver'), '：', vehicle.driver == null ? t('mechanic.noDriver') : holderName(`investigator:${vehicle.driver}`)),
      h('p', {}, t('mechanic.passenger'), '：', vehicle.passengers.map(seat => holderName(`investigator:${seat}`)).join(' · ') || t('mechanic.empty')),
      vehicle.enterReason ? h('p', { className: 'ah-tcu-note', 'data-vehicle-enter-reason': vehicle.id }, vehicle.enterReason) : null,
      vehicle.leaveReason ? h('p', { className: 'ah-tcu-note' }, vehicle.leaveReason) : null)),
    // ── 七循环《地球边缘》公开/私有交互摘要（P4-B）。既有条目以上保持不变，EotE 分组只追加在末尾。
    eote ? h('div', { className: 'ah-eote-summary' },
      eote.frost ? h('p', { className: 'ah-eote-frost', 'data-eote-frost': String(eote.frost.remaining), 'data-eote-frost-limit': String(eote.frost.limit) },
        t('mechanic.eote.frostRemaining', { remaining: eote.frost.remaining, limit: eote.frost.limit })) : null,
      eote.partners?.length ? h('section', { className: 'ah-eote-partners', 'aria-label': t('mechanic.eote.partners') }, h('h3', {}, t('mechanic.eote.partners')),
        eote.partners.map(partner => h('p', { 'data-eote-partner': partner.code, 'data-partner-code': partner.code, 'data-partner-status': partner.status },
          cardName(partner.code), ' · ', partnerStatus(partner.status),
          partner.damage > 0 ? ` · ${t('mechanic.eote.damage', { damage: partner.damage })}` : '',
          partner.horror > 0 ? ` · ${t('mechanic.eote.horror', { horror: partner.horror })}` : '',
          partner.resolute ? ` · ${cardName(partner.resolute)}` : ''))) : null,
      eote.seals?.length ? h('section', { className: 'ah-eote-seals', 'aria-label': t('mechanic.eote.seals') }, h('h3', {}, t('mechanic.eote.seals')),
        eote.seals.map(seal => h('p', { 'data-eote-seal': seal.kind, 'data-seal-kind': seal.kind, 'data-seal-active': String(seal.active) },
          sealKind(seal.kind), ' · ', sealState(seal), ' · ', sealPlacement(seal)))) : null,
      eote.tekeli ? h('p', { className: 'ah-eote-tekeli', 'data-eote-tekeli': String(eote.tekeli.count) },
        t('mechanic.eote.tekeli', { count: eote.tekeli.count })) : null,
      eote.deckTop?.length ? h('section', { className: 'ah-eote-deck-top', 'aria-label': t('mechanic.eote.deckTop') }, h('h3', {}, t('mechanic.eote.deckTop')),
        eote.deckTop.map(row => h('p', { 'data-eote-deck-top': String(row.seat), 'data-deck-top-code': row.code },
          cardName(row.code), row.public ? ` · ${t('mechanic.eote.deckTopPublic')}` : ''))) : null,
      eote.crossSeat?.length ? h('section', { className: 'ah-eote-cross-seat', 'aria-label': t('mechanic.eote.crossSeat') }, h('h3', {}, t('mechanic.eote.crossSeat')),
        eote.crossSeat.map(row => h('p', { 'data-eote-cross-seat': String(row.fromSeat), 'data-from-seat': String(row.fromSeat) },
          t('mechanic.eote.crossSeatLine', { name: seatName(row.fromSeat), count: row.codes.length }),
          row.costSplit ? ` · ${t('mechanic.eote.crossSeatSplit', { self: row.costSplit.self ?? 0, owner: row.costSplit.owner ?? 0 })}` : ''))) : null,
      eote.disciplines?.length ? h('section', { className: 'ah-eote-disciplines', 'aria-label': t('mechanic.eote.disciplines') }, h('h3', {}, t('mechanic.eote.disciplines')),
        eote.disciplines.map(row => h('p', {
          'data-eote-discipline': row.unbrokenCode, 'data-discipline-face': row.face,
          'data-unbroken-code': row.unbrokenCode, 'data-broken-code': row.brokenCode,
        }, row.face === 'broken' ? t('mechanic.eote.broken') : t('mechanic.eote.unbroken'), ' · ',
        cardName(row.face === 'broken' ? row.brokenCode : row.unbrokenCode),
        ` · ${t('mechanic.eote.burden', { name: cardName(row.burdenCode) })}`))) : null,
      eote.supplies?.length || eote.droppedSupplies?.length ? h('section', { className: 'ah-eote-supplies', 'aria-label': t('mechanic.eote.supplies') }, h('h3', {}, t('mechanic.eote.supplies')),
        (eote.supplies || []).map(row => h('p', { 'data-eote-supplies': String(row.seat), 'data-supply-count': String(row.count) },
          t('mechanic.eote.suppliesLine', { name: seatName(row.seat), count: row.count }))),
        (eote.droppedSupplies || []).map(row => h('p', { 'data-eote-dropped': row.locationId, 'data-dropped-count': String(row.count) },
          t('mechanic.eote.droppedSupplies', { location: holderName(`location:${row.locationId}`), count: row.count })))) : null) : null,
    tskSummary)
}
