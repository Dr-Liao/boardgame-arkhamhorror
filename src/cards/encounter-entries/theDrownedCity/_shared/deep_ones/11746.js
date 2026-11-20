// 11746 深潜者奴仆（Deep One Thrall）· 敌人 · 共享遭遇组 deep_ones（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/deep_ones。
// 卡面（cards-data 11746）：
//   强制 - 深潜者奴仆与你交战后：随机弃掉你手牌中的1张卡牌。
//
// 读点（声明即接线）：
//   · 战斗/躲避/生命/伤害/恐惧 = cards-data；
//   · 「与你交战后」= enemyEngaged 窗口（enemies.js#engageEnemy → triggerReaction，
//     该 when 同时作为能力层窗口派发；context 带 enemy/seat）；
//   · 「随机弃 1 张手牌」= api.discardRandomFromHand(seat, 1)（deck-ops 的随机弃手牌管线）。
const CODE = '11746'

export default {
  code: CODE,
  name: '深潜者奴仆',
  scope: 'enemy',
  implemented: true,
  flags: {
    traits: ['Humanoid', 'Monster', 'Deep One'],
    quantity: 2,
    fight: 3,
    evade: 3,
    health: 2,
    damage: 1,
    horror: 1,
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyEngaged',
    silent: true,
    label: '与你交战后：随机弃掉 1 张手牌',
    criteria: ({ source, context }) => Boolean(source?.id) && context?.enemy?.id === source.id,
    resolve: ({ context, api }) => {
      api.discardRandomFromHand?.(context.seat, 1)
      api.info?.('🐟 「深潜者奴仆」与调查员交战，随机弃掉其 1 张手牌。')
    },
  }],
  note: '「交战后随机弃 1 手牌」走 enemyEngaged 窗口 + api.discardRandomFromHand（随机弃手牌的唯一管线）。',
}
