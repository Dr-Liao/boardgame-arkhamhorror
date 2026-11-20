import { cardDisplayName } from './catalog.js'
import { t } from './i18n.js'

const targetLabels = { fight: 'game.action.fight', evade: 'game.action.evade' }

export function renderTdcInteractionSummary(h, state, { moves, canAct, submit }) {
  const model = state.mechanics?.tdc
  if (!model) return null
  const name = item => cardDisplayName(item) || item?.name || item?.id || ''
  const locName = id => name(state.locations.find(item => item.id === id)) || id
  const section = (key, rows) => h('section', { 'aria-label': t(key) }, h('h3', {}, t(key)),
    rows.length ? rows : h('p', { className: 'ah-tcu-note' }, t('mechanic.empty')))
  const button = (part, action) => {
    const move = moves.find(item => item.enemyId === part.id && item.action === action)
    const reason = model.targets?.[part.id]?.[action] || t('game.script.unavailable')
    const label = t(targetLabels[action])
    return h('span', {},
      h('button', { type: 'button', className: 'bg-btn secondary', 'data-tdc-target': action,
        'aria-label': `${label} · ${name(part)}`, title: move && canAct ? label : reason,
        disabled: !move || !canAct, onclick: () => move && submit(move) }, label),
      !move || !canAct ? h('small', { className: 'ah-tcu-note', 'data-target-reason': action }, reason) : null)
  }
  const task = model.task
  const enemies = state.enemies || []
  return h('div', { className: 'ah-tcu-panel', 'data-tdc-summary': 'true' },
    task ? section('mechanic.tdc.tasks', [
      h('p', { 'data-tdc-task': task.seat }, task.label
        ? t('mechanic.tdc.progress', { name: cardDisplayName(state.cards?.[task.code]) || task.label, count: task.progress })
        : task.remaining ? t('mechanic.tdc.taskAvailable', { count: task.remaining }) : t('mechanic.tdc.noTasks')),
    ]) : null,
    section('mechanic.tdc.routes', [
      ...model.routes.map(row => h('p', { 'data-tdc-route': row.id, 'data-selected': String(row.selected) },
        row.label, ' · ', t(row.selected ? 'mechanic.tdc.selected' : model.route ? 'mechanic.tdc.otherRoute' : 'mechanic.tdc.unselected'))),
      ...model.regions.map(row => h('p', { 'data-tdc-region': row.id, 'data-crossed': String(row.crossed) },
        row.crossed ? h('del', {}, row.label) : row.label, ' · ',
        t(row.crossed ? 'mechanic.tdc.crossed' : row.available ? 'mechanic.tdc.available'
          : model.route ? 'mechanic.tdc.otherRoute' : 'mechanic.tdc.routeRequired'))),
    ]),
    section('mechanic.tdc.glyphs', [h('ul', { className: 'ah-tdc-glyphs' },
      model.glyphs.map(glyph => h('li', { 'data-tdc-glyph': glyph.letter, 'data-translated': String(glyph.translated) },
        h('strong', {}, glyph.letter), ' ', glyph.translated ? glyph.text || t('mechanic.tdc.translated') : t('mechanic.tdc.unknown'))))]),
    section('mechanic.tdc.artifacts', model.artifacts.map(row => h('p', { 'data-tdc-artifact': row.code,
      'data-holder': row.holder == null ? null : String(row.holder) }, name(row) || row.code,
      ' · ', row.holder == null ? t('mechanic.tdc.unassigned') : name(state.investigators.find(inv => inv.seat === row.holder))))),
    section('mechanic.tdc.map', model.map.map(cell => h('p', { 'data-tdc-cell': cell.id, 'data-x': cell.x, 'data-y': cell.y },
      locName(cell.id), ' · ', t('mechanic.tdc.coordinates', { x: cell.x, y: cell.y }), ' · ',
      cell.connections.map(locName).join(' / ') || t('mechanic.tdc.noConnections')))),
    section('mechanic.tdc.board', enemies.filter(enemy => enemy.hasParts).map(body => h('div', {
      className: 'ah-tcu-panel', 'data-tdc-board': body.id,
    }, h('h4', {}, name(body), ' · ', locName(body.location)),
    enemies.filter(part => part.partOf === body.id).map(part => h('div', { 'data-tdc-part': part.id },
      h('p', {}, name(part), ' · ', t('game.enemy.stats', {
        fight: part.effectiveFight ?? part.fight, evade: part.effectiveEvade ?? part.evade,
        health: part.health - (part.damageTaken || 0), max: part.health,
      })),
      h('div', { className: 'ah-tcu-actions' }, button(part, 'fight'), button(part, 'evade'))))))),
  )
}
