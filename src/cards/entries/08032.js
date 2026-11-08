// 08032 耶利米·科尔比
// 卡面：你得到 +1[intellect]。
//       [reaction] 在耶利米·科尔比入场后，选择“偶数”或“奇数”：揭示你牌库顶的 5 张卡牌。
//       抽取每张费用符合你选择的卡牌。将剩下的卡牌洗入你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：入场反应 = assetEnteredPlay（criteria 只认本卡入场）；牌库顶 5 张用 api.topDeckCodes
// 读取，符合费用奇偶的用 api.moveCard(deck→hand) 加入手牌，其余洗回（api.shuffleDeck）。
import { ownSeat } from '../../engine/matcher.js'
import { skillModifier } from './_shared.js'

const costParity = (api, code) => {
  const cost = Number(api.cardCost?.(code))
  return Number.isFinite(cost) ? (cost % 2 === 0 ? 'even' : 'odd') : null
}

export default {
  code: '08032',
  modifiers: [
    skillModifier('intellect', 1),
  ],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetEnteredPlay',
      id: 'jeremiahParity',
      criteria: [ownSeat(), ({ context }) => context?.assetCode === '08032'],
      label: '入场后：选择偶数/奇数，揭示牌库顶 5 张，抽取费用符合的卡牌',
      resolve: ({ inv, api }) => {
        const parity = api.choice({
          kind: 'effect', source: '08032', seat: inv.seat,
          prompt: '耶利米·科尔比：选择“偶数”或“奇数”。',
          options: [{ id: 'even', label: '偶数费用' }, { id: 'odd', label: '奇数费用' }],
        })
        const top = api.topDeckCodes(inv.seat, 5)
        if (!top.length) {
          api.info('耶利米·科尔比：牌库是空的。')
          return
        }
        const picked = top.filter(code => costParity(api, code) === parity)
        for (const code of picked) api.moveCard({ code, from: 'deck', to: 'hand' })
        api.shuffleDeck(inv.seat)
        api.info(`耶利米·科尔比：揭示牌库顶 ${top.length} 张，抽取 ${picked.length} 张${parity === 'even' ? '偶数' : '奇数'}费用卡牌，其余洗回牌库。`)
      },
    },
  ],
}
