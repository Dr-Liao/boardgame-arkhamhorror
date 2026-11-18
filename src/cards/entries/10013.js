// 10013 真幻记述（Book of Living Myths）· 支援 · 道具/书籍/祝福/诅咒萦绕 · 手部
// 卡面：鸣神琥珀牌库专用。
//   [reaction] 当一个混乱标记将要在你的地点揭示时，横置真幻记述：查找混乱袋，找出一个
//   [bless] 标记或 [curse] 标记（取混乱袋中数量较多者，若数量相等则由你选择），改为结算该标记。
//
// 读点：
//   · `beforeChaosTokenReveal` 窗口（tests.js 在每次抽标记前开窗，context = {when, seat, location}）；
//     「将要在你的地点揭示」= context.location 与控制者的地点相同（同地点其他调查员的检定也适用）。
//   · 改为结算袋内标记：`api.revealRankedTokenInstead(context, face, faces, { order: 'most' })`
//     （P2 原语：要求 ST.3、context.seat 是检定者、face 必须在袋内且属于数量最多的一方）。
//   · 多数比较：`api.chaosTokens.rank(['bless','curse'], { order: 'most' })`；并列时由玩家选择。

const BLESS = 'bless'
const CURSE = 'curse'
const FACES = [BLESS, CURSE]

function inBag(state, face) {
  return (state.chaosBag || []).includes(face)
}

export default {
  code: '10013',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'beforeChaosTokenReveal',
      id: 'bookOfLivingMyths',
      label: '一个混乱标记将要在你的地点揭示时：横置，改为结算袋内较多的祝福或诅咒',
      criteria: [({ state, inv, context }) => Boolean(context)
        && context.when === 'beforeChaosTokenReveal'
        && context.location === inv.location
        && !context.replacementToken
        && FACES.some(face => inBag(state, face))],
      cost: { exhaust: true },
      resolve: ({ state, inv, api, context }) => {
        const ranked = api.chaosTokens.rank(FACES, { order: 'most' })
        const available = ranked.filter(face => inBag(state, face))
        if (!available.length) return
        const face = available.length === 1 ? available[0] : api.choice({
          kind: 'chaosToken', source: '10013', seat: inv.seat,
          prompt: '祝福与诅咒数量相等：选择要改为结算的标记。',
          options: available.map(id => ({ id, label: id === BLESS ? '祝福' : '诅咒' })),
        })
        if (face !== BLESS && face !== CURSE) return
        if (api.revealRankedTokenInstead(context, face, FACES, { order: 'most' })) {
          api.info(`📖 真幻记述：改为结算混乱袋中的${face === BLESS ? '祝福' : '诅咒'}标记。`)
        }
      },
    },
  ],
  modifiers: [],
}
