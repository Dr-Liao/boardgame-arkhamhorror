// 08696 古老者守卫（Elder Thing Guardian）· 敌人 · elder_things
// 卡面：猎手。强制 - 在你对古老者守卫造成伤害时：每造成 1 点伤害，弃掉你牌库顶的 1 张卡牌。
//   抽取所有以此方式弃掉的弱点。
// 读点：forced + trigger 'enemyDamaged'；弃牌/弱点抽取与 08695 同一口径。
import { isWeaknessCode } from '../../../_shared.js'

export default {
  code: '08696', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyDamaged',
    label: '古老者守卫受到伤害：每 1 点伤害弃掉牌库顶 1 张并抽取其中的弱点',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id && Number.isSafeInteger(context?.seat),
    resolve: ({ context, api }) => {
      const count = Math.max(0, Number(context.amount ?? context.damage) || 0)
      if (!count) return
      const discarded = api.discardTopOfDeck(context.seat, count) || []
      const weaknesses = discarded.filter(code => isWeaknessCode(code))
      for (const code of weaknesses) api.moveCard({ code, from: 'discard', to: 'deckTop', ownerSeat: context.seat })
      if (weaknesses.length) api.drawCards(context.seat, weaknesses.length)
      api.info('「古老者守卫」：弃掉牌库顶 ' + count + ' 张（其中 ' + weaknesses.length + ' 张弱点已抽取）。')
    },
  }],
}

