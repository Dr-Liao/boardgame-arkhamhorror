// 60451 玛丽·朗博（Marie Lambeau，入门包 mar）
// 卡面：[reaction] 伤害放置到玛丽·朗博上后：抽 2 张卡牌并弃掉其中 1 张。（每阶段仅限一次）
//       [elder_sign] 效果：+0。如果你检定成功，治疗 1 点伤害。
//
// 读点：
//   · 「伤害放置到玛丽·朗博上后」= `damagePlacedOnSelf` 窗口（enemies.js 在伤害/恐惧实际放置到
//     调查员本人后派发，context: seat/location/damage/horror/direct/attack）。
//     只对 damage > 0 触发（卡面只说伤害，不说恐惧）。
//   · 抽 2 弃 1 = api.drawCards + api.chooseOptionalHandDiscard（每阶段一次由 limit 记账）。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60451',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 0 } },
  elderSign: {
    id: '60451-eldersign',
    label: '旧印：+0；检定成功则治疗 1 点伤害',
    resolve: ({ inv, api }) => {
      api.afterCurrentTest(result => {
        if (result?.success) api.healDamage(inv.seat, 1)
      })
      return { delta: 0 }
    },
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'damagePlacedOnSelf',
    label: '受到伤害后：抽 2 张弃 1 张（每阶段一次）',
    limit: 'oncePerPhase',
    criteria: [ownSeat(), ({ context }) => Number(context?.damage) > 0],
    resolve: ({ inv, api }) => {
      api.drawCards(inv.seat, 2)
      api.chooseOptionalHandDiscard(inv.seat, '60451', { required: true })
    },
  }],
}
