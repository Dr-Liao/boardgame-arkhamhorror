// 08035 登山靴
// 卡面：每位调查员仅限 1 张[[鞋子]]。
//       你得到 +1[agility]。
//       [reaction] 你所在地点的最后一个线索被发现后，横置登山靴：移动到一个至少有 1 个线索，
//       或未揭示的连接地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：clueDiscovered 窗口上下文的 location / lastClue 是唯一读点；候选目的地 = 当前地点的
// 连接地点里「至少有 1 个线索」或「未揭示」的地点；移动走 api.moveInvestigator（横置为费用）。
import { ownSeat } from '../../engine/matcher.js'
import { skillModifier } from './_shared.js'

export default {
  code: '08035',
  modifiers: [
    skillModifier('agility', 1),
  ],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'clueDiscovered',
      label: '横置：移动到一个有线索或未揭示的连接地点',
      criteria: [ownSeat(), ({ inv, context }) => context?.location === inv.location && context?.lastClue === true],
      cost: { exhaust: true },
      resolve: ({ state, inv, api }) => {
        const here = (state.locations || []).find(location => location.id === inv.location)
        const candidates = (here?.connections || [])
          .map(id => (state.locations || []).find(location => location.id === id))
          .filter(location => location && (location.clues > 0 || location.revealed !== true))
        if (!candidates.length) {
          api.info('登山靴：没有符合条件的连接地点。')
          return
        }
        const answer = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'location', source: '08035', seat: inv.seat,
          prompt: '登山靴：选择要移动到的连接地点。',
          options: candidates.map(location => ({ id: location.id, label: api.locName(location.id) })),
        })
        const target = candidates.find(location => location.id === answer) || candidates[0]
        api.moveInvestigator(inv.seat, target.id)
        api.info(`登山靴：移动到「${api.locName(target.id)}」。`)
      },
    },
  ],
}
