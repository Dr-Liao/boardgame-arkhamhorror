// Presentation only: every clickable option must have a matching server legal move.
import { t } from './i18n.js'
import { chaosTokenFace } from './chaos-token.js'
import { tableIcon } from './table-components.js'
import { cardDisplayName } from './catalog.js'

const operations = {
  seal: 'mechanic.seal', release: 'mechanic.release', claimKey: 'mechanic.claimKey', giveKeys: 'mechanic.giveKeys',
  spendKey: 'mechanic.spendKey', enterVehicle: 'mechanic.enterVehicle', leaveVehicle: 'mechanic.leaveVehicle',
  driveVehicle: 'mechanic.driveVehicle', commitOrigin: 'mechanic.commitOrigin', returnCommitment: 'mechanic.returnCommitment',
}
const colors = { red: 'mechanic.key.red', yellow: 'mechanic.key.yellow', green: 'mechanic.key.green', blue: 'mechanic.key.blue',
  purple: 'mechanic.key.purple', white: 'mechanic.key.white', black: 'mechanic.key.black', unrevealed: 'mechanic.key.unrevealed' }
const stages = { items: 'mechanic.stage.items', recipient: 'mechanic.stage.recipient', driver: 'mechanic.stage.driver', destination: 'mechanic.stage.destination' }
export const keyLabel = color => t(colors[color] || colors.unrevealed)
export const floodLabel = level => t(['mechanic.flood.dry', 'mechanic.flood.partial', 'mechanic.flood.full'][level] || 'mechanic.flood.dry')
let focusKey = null

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
  const submit = option => { if (enabled && option?.move) onSubmit(option.move) }
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
    }, option.token != null && chaosTokenFace(option.token).src ? h('img', { className: 'ah-choice-token', src: chaosTokenFace(option.token).src, alt: '', draggable: false }) : null,
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

export function renderMechanicSummary(h, state, { seat = 0 } = {}) {
  const model = state.mechanics
  if (!model || (!model.water && !model.keys && !model.vehicles)) return null
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
      vehicle.leaveReason ? h('p', { className: 'ah-tcu-note' }, vehicle.leaveReason) : null)))
}
