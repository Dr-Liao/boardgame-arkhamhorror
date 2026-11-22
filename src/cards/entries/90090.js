// 90090 女主角（致命女郎 / Leading Lady · Femme Fatale）· 中立 · 事件/诡计/即兴 · 萝拉（平行）牌库专用 · 替换。
//
// 卡面（cards-data 90090）：
//   Lola Hayes deck only. Replacement. Fast. Play only during your turn.
//   Play a card from your hand, regardless of your current role (paying its cost). If that card was
//   a Rogue ([rogue]) card, you may either draw 1 card or immediately take an evade action.
//
// 引擎读点（与 90088 同一套）：
//   · 快速/自己回合：`fast: true` + playCondition `ownTurn()`。
//   · 无视角色打出手牌：`api.playCardFromHandFree(seat, code, { discount: 0 })`（正常付费）。
//   · 追加行动：`api.evade(seat, { enemyId })`（api-clue.js → doEvade）；候选 = 与你交战的敌人。
//   · Rogue 判定：cards-data klass/factions 含 'rogue'。

import { ALL_CARDS } from '../cards-data.js'
import { ownTurn } from '../../engine/matcher.js'

const code = '90090'
const CLASS = 'rogue'
const isWeakness = cardCode => String(ALL_CARDS[cardCode]?.subtype || '').toLowerCase().includes('weakness')
const factionsOf = cardCode => {
  const def = ALL_CARDS[cardCode]
  return def?.factions || [def?.klass, def?.klass2, def?.klass3].filter(Boolean)
}
const playableFromHand = (inv, api) => [...new Set(inv.hand || [])]
  .filter(cardCode => ALL_CARDS[cardCode] && !isWeakness(cardCode) && api.playCostOf(inv.seat, cardCode) <= (inv.resources || 0))
const engagedEnemies = (state, inv) => (state.enemies || []).filter(enemy => !enemy.defeated && enemy.engagedSeat === inv.seat)

export default {
  code,
  playCondition: [{ when: ownTurn(), message: '只能在自己的回合打出' }],
  abilities: [{
    kind: 'played',
    fast: true,
    label: '无视角色打出 1 张手牌；若是流浪者卡，抽 1 张或立刻躲避',
    resolve: ({ inv, state, api }) => {
      const candidates = playableFromHand(inv, api)
      if (!candidates.length) {
        api.info('「女主角（致命女郎）」：没有可支付费用的手牌。')
        return
      }
      const chosen = candidates.length === 1 ? candidates[0] : api.choice({
        kind: 'card', source: code, seat: inv.seat, prompt: '选择要无视角色打出的手牌。',
        options: candidates.map(cardCode => ({ id: cardCode, cardCode, label: api.cardName(cardCode) })),
      })
      if (!ALL_CARDS[chosen]) return
      if (!api.playCardFromHandFree(inv.seat, chosen, { discount: 0 })) return
      if (!factionsOf(chosen).includes(CLASS)) return
      const foes = engagedEnemies(state, inv)
      const options = [{ id: 'draw', label: '抽 1 张牌' }]
      if (foes.length) options.push({ id: 'evade', label: '立刻进行一次躲避行动' })
      options.push({ id: 'skip', label: '不追加' })
      const choice = api.choice({ kind: 'effect', source: code, seat: inv.seat,
        prompt: '该卡是流浪者卡：抽 1 张或立刻躲避？', options })
      if (choice === 'draw') api.drawCards(inv.seat, 1)
      else if (choice === 'evade') {
        const enemyId = foes.length === 1 ? foes[0].id : api.choice({ kind: 'target', source: code, seat: inv.seat,
          prompt: '选择要躲避的敌人。', options: foes.map(foe => ({ id: foe.id, label: foe.name || foe.code })) })
        const foe = foes.find(enemy => enemy.id === enemyId)
        if (foe) api.evade(inv.seat, { enemyId: foe.id })
      }
    },
  }],
  modifiers: [],
  note: '近似：api.playCardFromHandFree 只支付费用，不重算被打出卡自身的 playCondition；替换（Replacement）与签名选择由 Lead 的 deckbuilding 接线。',
}
