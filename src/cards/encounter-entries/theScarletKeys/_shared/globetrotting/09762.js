// 09762 福林探员（Inspector Flint）· 剧情支援（盟友）· globetrotting
// 卡面：[reaction] 在你揭露诱饵时，横置福林探员：取消揭露该诱饵，将其翻至正面朝下，
//   并抽取 1 张卡牌或选择揭露该地点另一张隐匿迷你卡牌。
// tskWouldExpose 在取出迷你卡前派发；取消时原诱饵继续正面朝下，另一个目标走正常揭露管线。
const CODE = '09762'

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  flags: { ally: true, agency: true, detective: true },
  abilities: [{
    kind: 'reaction',
    trigger: 'tskWouldExpose',
    label: '你揭露诱饵时，横置福林探员：取消揭露，然后抽 1 张卡或揭露该地点另一张迷你卡',
    cost: { exhaust: true },
    criteria: ({ inv, context }) => context?.decoy === true && context?.seat === inv.seat && !context.cancelled,
    resolve: ({ inv, context, api }) => {
      const concealed = api.tsk.concealed
      if (!concealed.cancelExpose(context)) return false
      const others = api.concealedTargetsForEffect(inv.seat, context.locationId).filter(card => card.id !== context.id)
      const picked = others.length ? api.choose({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '福林探员：抽取 1 张卡牌，或揭露该地点的另一张隐匿迷你卡牌。',
        options: [{ id: 'draw', label: '抽取 1 张卡牌' }, ...others.map((card, index) => ({
          id: card.id, label: `揭露第 ${index + 1} 张其他隐匿迷你卡牌`,
        }))],
      }) : 'draw'
      if (picked === 'draw') api.drawCards(inv.seat, 1)
      else if (others.some(card => card.id === picked)) api.exposeConcealedByEffect(inv.seat, context.locationId, picked)
      return true
    },
  }],
}
