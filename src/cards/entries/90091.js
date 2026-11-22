// 90091 女主角（魔女 / Leading Lady · Enchantress）· 中立 · 事件/仪式/即兴 · 萝拉（平行）牌库专用 · 替换。
//
// 卡面（cards-data 90091）：
//   Lola Hayes deck only. Replacement. Fast. Play only during your turn.
//   Play a card from your hand, regardless of your current role (paying its cost). If that card was
//   a Mystic ([mystic]) card, you may either draw 1 card or remove 1 doom from a player card at
//   your location.
//
// 引擎读点（与 90088 同一套）：
//   · 快速/自己回合：`fast: true` + playCondition `ownTurn()`。
//   · 无视角色打出手牌：`api.playCardFromHandFree(seat, code, { discount: 0 })`（正常付费）。
//   · 移除玩家卡上的毁灭：`api.removeDoomFromCard(card, 1)`（api-misc.js → act-agenda.js）。
//     候选 = 你所在地点的调查员控制下 doom > 0 的支援（玩家卡；含自己与队友）。
//   · Mystic 判定：cards-data klass/factions 含 'mystic'。

import { ALL_CARDS } from '../cards-data.js'
import { ownTurn } from '../../engine/matcher.js'

const code = '90091'
const CLASS = 'mystic'
const isWeakness = cardCode => String(ALL_CARDS[cardCode]?.subtype || '').toLowerCase().includes('weakness')
const factionsOf = cardCode => {
  const def = ALL_CARDS[cardCode]
  return def?.factions || [def?.klass, def?.klass2, def?.klass3].filter(Boolean)
}
const playableFromHand = (inv, api) => [...new Set(inv.hand || [])]
  .filter(cardCode => ALL_CARDS[cardCode] && !isWeakness(cardCode) && api.playCostOf(inv.seat, cardCode) <= (inv.resources || 0))
const doomedPlayerCards = (state, inv) => state.investigators
  .filter(owner => owner.location === inv.location)
  .flatMap(owner => (owner.assets || []).filter(asset => (asset.doom || 0) > 0))

export default {
  code,
  playCondition: [{ when: ownTurn(), message: '只能在自己的回合打出' }],
  abilities: [{
    kind: 'played',
    fast: true,
    label: '无视角色打出 1 张手牌；若是潜修者卡，抽 1 张或移除 1 个毁灭',
    resolve: ({ inv, state, api }) => {
      const candidates = playableFromHand(inv, api)
      if (!candidates.length) {
        api.info('「女主角（魔女）」：没有可支付费用的手牌。')
        return
      }
      const chosen = candidates.length === 1 ? candidates[0] : api.choice({
        kind: 'card', source: code, seat: inv.seat, prompt: '选择要无视角色打出的手牌。',
        options: candidates.map(cardCode => ({ id: cardCode, cardCode, label: api.cardName(cardCode) })),
      })
      if (!ALL_CARDS[chosen]) return
      if (!api.playCardFromHandFree(inv.seat, chosen, { discount: 0 })) return
      if (!factionsOf(chosen).includes(CLASS)) return
      const doomed = doomedPlayerCards(state, inv)
      const options = [{ id: 'draw', label: '抽 1 张牌' }]
      if (doomed.length) options.push({ id: 'doom', label: '移除 1 个毁灭标记' })
      options.push({ id: 'skip', label: '不追加' })
      const choice = api.choice({ kind: 'effect', source: code, seat: inv.seat,
        prompt: '该卡是潜修者卡：抽 1 张或移除 1 个毁灭？', options })
      if (choice === 'draw') api.drawCards(inv.seat, 1)
      else if (choice === 'doom') {
        const id = doomed.length === 1 ? doomed[0].id : api.choice({ kind: 'target', source: code, seat: inv.seat,
          prompt: '选择要移除毁灭的玩家卡。', options: doomed.map(card => ({ id: card.id, cardCode: card.code, label: api.cardName(card.code) })) })
        const card = doomed.find(item => item.id === id)
        if (card) api.removeDoomFromCard(card, 1)
      }
    },
  }],
  modifiers: [],
  note: '近似：api.playCardFromHandFree 只支付费用，不重算被打出卡自身的 playCondition；毁灭候选只扫支援（玩家卡附属/威胁区卡另有读点，未纳入）。替换（Replacement）与签名选择由 Lead 的 deckbuilding 接线。',
}
