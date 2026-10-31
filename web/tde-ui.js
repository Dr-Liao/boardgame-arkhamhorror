// 食梦者交互 3–10 的牌桌条。只读 view.scenarioInteractions 与 legalMoves，不判断规则。
import { t } from './i18n.js'

function section(h, id, title, ...body) {
  return h('section', { className: 'ah-tde-interaction', 'data-interaction': id },
    h('h3', {}, title), ...body)
}

export function renderScenarioInteractions(h, model, { moves = [], submit, canAct = true } = {}) {
  if (!model) return null
  const blocks = []
  if (model.swarm) {
    blocks.push(section(h, 'swarm', t('tde.swarm.title'),
      model.swarm.length ? model.swarm.map(host => h('p', {},
        t('tde.swarm.host', { name: host.name || host.hostId, count: host.count }),
        host.blockedReason ? h('small', {}, host.blockedReason) : null))
        : h('p', {}, t('tde.swarm.empty'))))
  }
  if (model.tokenBag) {
    const bags = model.tokenBag.bags || []
    blocks.push(section(h, 'tokenBag', t('tde.bag.title'),
      bags.length ? bags.map(bag => h('p', {},
        t('tde.bag.count', { id: bag.id, count: bag.count }),
        bag.revealed?.length ? h('small', {}, t('tde.bag.revealed', { tokens: bag.revealed.join(t('tde.list')) })) : h('small', {}, t('tde.bag.noneRevealed'))))
        : h('p', {}, t('tde.bag.empty')),
      h('p', {}, t('tde.bag.infested', { count: model.tokenBag.infestedCount || 0 }))))
  }
  if (model.alarm) {
    blocks.push(section(h, 'alarm', t('tde.alarm.title'),
      h('p', {}, (model.alarm.seats || []).map(item => t('tde.alarm.seat', { seat: item.seat + 1, value: item.value, max: model.alarm.max })).join(t('tde.list'))) || t('tde.alarm.empty')))
  }
  if (model.hidden) {
    const mine = (model.hidden.seats || []).find(item => Array.isArray(item.codes))
    const enemyMoves = (moves || []).filter(move => ['fight', 'evade'].includes(move.action)
      && mine?.codes?.includes(move.cardId || move.enemyId))
    blocks.push(section(h, 'hidden', t('tde.hidden.title'),
      (model.hidden.seats || []).map(item => h('p', {},
        Array.isArray(item.codes)
          ? t('tde.hidden.own', { count: item.count, codes: item.codes.join(t('tde.list')) })
          : t('tde.hidden.other', { seat: item.seat + 1, count: item.count }))),
      enemyMoves.length
        ? h('div', { className: 'ah-tde-actions' }, enemyMoves.map(move => h('button', {
          type: 'button', className: 'bg-btn secondary', disabled: !canAct, onclick: () => submit?.(move),
        }, move.label)))
        : h('p', {}, t('tde.hidden.noEnemy'))))
  }
  if (model.veiled) {
    blocks.push(section(h, 'veiled', t('tde.veiled.title'),
      model.veiled.map(location => {
        const move = (moves || []).find(item => item.action === 'flipVeiled' && item.locationId === location.id)
        const reason = location.flipped ? null : (location.reason || (location.here ? null : t('tde.veiled.notHere')))
        return h('p', {},
          h('span', {}, location.name || location.id),
          location.flipped ? h('small', {}, location.storyCode ? t('tde.veiled.story', { code: location.storyCode }) : t('tde.veiled.flipped')) : null,
          !location.flipped && move ? h('button', {
            type: 'button', className: 'bg-btn', disabled: !canAct, onclick: () => submit?.(move),
          }, move.label) : null,
          !location.flipped && !move ? h('small', {}, reason || t('tde.veiled.blocked')) : null)
      })))
  }
  if (model.markers) {
    blocks.push(section(h, 'markers', t('tde.markers.title'),
      model.markers.length
        ? model.markers.map(item => h('p', {}, t('tde.markers.count', { id: item.id, count: item.count })))
        : h('p', {}, t('tde.markers.empty'))))
  }
  if (model.vertical) {
    blocks.push(section(h, 'vertical', t('tde.vertical.title'),
      h('ol', {}, model.vertical.map(location => h('li', { 'data-vertical': location.index },
        location.name || location.id)))))
  }
  if (model.epilogue) {
    blocks.push(section(h, 'epilogue', t('tde.epilogue.title'),
      (model.epilogue.gates || []).map(gate => h('p', {}, t('tde.epilogue.gate', { name: gate.name || gate.id }))),
      model.epilogue.status === 'reached'
        ? h('p', {}, model.epilogue.title || t('tde.epilogue.reached'))
        : h('p', {}, t('tde.epilogue.pending'))))
  }
  if (!blocks.length) return null
  return h('div', { className: 'ah-scenario-interactions', role: 'region', 'aria-label': t('tde.interactions') }, ...blocks)
}
