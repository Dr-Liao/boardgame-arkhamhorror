// 90088 女主角（女英雄 / Leading Lady · Heroine）· 中立 · 事件/策略/即兴 · 萝拉（平行）牌库专用 · 替换。
//
// 卡面（cards-data 90088）：
//   Lola Hayes deck only. Replacement. Fast. Play only during your turn.
//   Play a card from your hand, regardless of your current role (paying its cost). If that card was
//   a Guardian ([guardian]) card, you may either draw 1 card or immediately take a fight action.
//
// 引擎读点：
//   · 快速 / 只在自己回合：`fast: true` + playCondition `ownTurn()`（play-condition.js 唯一读点）。
//   · 「无视当前角色打出手牌」：`api.playCardFromHandFree(seat, code, { discount: 0 })`（api-misc.js）
//     直接走 doPlay 并支付正常费用（discount 0 = 不打折）；它不经过角色限制的打出校验，
//     正好实现「regardless of your current role」。（近似：也不检查该卡自身的打出条件，见 note）
//   · 职业判定：cards-data 的 klass/factions；Guardian 卡 = factions 含 'guardian'。
//   · 追加行动：draw 用 `api.drawCards`；fight 用 `api.fight(seat, enemyId)`（combat.js；只列出
//     本地点可攻击敌人；没有敌人时该选项不出现）。

import { ALL_CARDS } from '../cards-data.js'
import { ownTurn } from '../../engine/matcher.js'

const code = '90088'
const CLASS = 'guardian'
const isWeakness = cardCode => String(ALL_CARDS[cardCode]?.subtype || '').toLowerCase().includes('weakness')
const factionsOf = cardCode => {
  const def = ALL_CARDS[cardCode]
  return def?.factions || [def?.klass, def?.klass2, def?.klass3].filter(Boolean)
}
const playableFromHand = (inv, api) => [...new Set(inv.hand || [])]
  .filter(cardCode => ALL_CARDS[cardCode] && !isWeakness(cardCode) && api.playCostOf(inv.seat, cardCode) <= (inv.resources || 0))
const enemiesHere = (state, inv) => (state.enemies || []).filter(enemy => !enemy.defeated
  && enemy.location === inv.location && !enemy.aloof)

export default {
  code,
  playCondition: [{ when: ownTurn(), message: '只能在自己的回合打出' }],
  abilities: [{
    kind: 'played',
    fast: true,
    label: '无视角色打出 1 张手牌；若是守卫者卡，抽 1 张或立刻攻击',
    resolve: ({ inv, state, api }) => {
      const candidates = playableFromHand(inv, api)
      if (!candidates.length) {
        api.info('「女主角（女英雄）」：没有可支付费用的手牌。')
        return
      }
      const chosen = candidates.length === 1 ? candidates[0] : api.choice({
        kind: 'card', source: code, seat: inv.seat, prompt: '选择要无视角色打出的手牌。',
        options: candidates.map(cardCode => ({ id: cardCode, cardCode, label: api.cardName(cardCode) })),
      })
      if (!ALL_CARDS[chosen]) return
      if (!api.playCardFromHandFree(inv.seat, chosen, { discount: 0 })) return
      if (!factionsOf(chosen).includes(CLASS)) return
      const foes = enemiesHere(state, inv)
      const options = [{ id: 'draw', label: '抽 1 张牌' }]
      if (foes.length) options.push({ id: 'fight', label: '立刻进行一次攻击行动' })
      options.push({ id: 'skip', label: '不追加' })
      const choice = api.choice({ kind: 'effect', source: code, seat: inv.seat,
        prompt: '该卡是守卫者卡：抽 1 张或立刻攻击？', options })
      if (choice === 'draw') api.drawCards(inv.seat, 1)
      else if (choice === 'fight') {
        const enemyId = foes.length === 1 ? foes[0].id : api.choice({ kind: 'target', source: code, seat: inv.seat,
          prompt: '选择攻击目标。', options: foes.map(foe => ({ id: foe.id, label: foe.name || foe.code })) })
        const foe = foes.find(enemy => enemy.id === enemyId)
        if (foe) api.fight(inv.seat, foe.id, {})
      }
    },
  }],
  modifiers: [],
  note: '近似：api.playCardFromHandFree 只支付费用，不重算被打出卡自身的 playCondition（角色限制已绕过，符合卡面）；替换（Replacement）与签名选择由 Lead 的 deckbuilding 接线。',
}
