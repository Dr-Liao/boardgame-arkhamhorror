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
    // 手牌中敌人形态的攻击/躲避由引擎枚举为 fightHidden/evadeHidden（moves.js），
    // 演示战役的旧 seed 用的是 fight/evade；两种都认，避免真实章节里入口画不出来。
    const enemyMoves = (moves || []).filter(move => ['fight', 'evade', 'fightHidden', 'evadeHidden'].includes(move.action)
      && mine?.codes?.includes(move.cardId || move.enemyId))
    // 只有存在可攻击/躲避入口时才渲染本区块：隐私牌本身已在手牌区可见，弃牌入口也在普通行动按钮里，
    // 没有操作入口时（如只有纯隐私弱点）不再用「隐藏手牌」+兜底提示占牌桌空间。
    if (enemyMoves.length) {
      blocks.push(section(h, 'hidden', t('tde.hidden.title'),
        (model.hidden.seats || []).map(item => h('p', {},
          Array.isArray(item.codes)
            ? t('tde.hidden.own', { count: item.count, codes: item.codes.join(t('tde.list')) })
            : t('tde.hidden.other', { seat: item.seat + 1, count: item.count }))),
        h('div', { className: 'ah-tde-actions' }, enemyMoves.map(move => h('button', {
          type: 'button', className: 'bg-btn secondary', disabled: !canAct, onclick: () => submit?.(move),
        }, move.label)))))
    }
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
    // 只投影已到达的结局（未到达时引擎不传 epilogue），所以这里不再有「结局尚未到达」占位。
    blocks.push(section(h, 'epilogue', t('tde.epilogue.title'),
      (model.epilogue.gates || []).map(gate => h('p', {}, t('tde.epilogue.gate', { name: gate.name || gate.id }))),
      h('p', {}, model.epilogue.title || t('tde.epilogue.reached'))))
  }
  if (!blocks.length) return null
  return h('div', { className: 'ah-scenario-interactions', role: 'region', 'aria-label': t('tde.interactions') }, ...blocks)
}
