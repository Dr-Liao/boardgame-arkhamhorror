// 01527 警徽
// 卡面：你得到+1[willpower]。
// 卡面：[free]你所在地点的调查员在进行自己回合时，弃掉警徽：该调查员本回合可以进行额外2次行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01527 警徽：+1 意志；[免费]弃掉：本回合行动中的调查员获得 2 次额外行动。

import { skillModifier } from './_shared.js'

export default {
  code: '01527',
  modifiers: [
    skillModifier('willpower', 1),
  ],
  abilities: [
    {
      kind: 'free', label: '弃掉：本回合调查员 +2 行动',
      cost: { discardSelf: true },
      resolve: ({ state, inv, api }) => {
        const candidates = api.investigatorsAt(inv.location)
        if (!candidates.length) return
        const answer = candidates.length === 1 ? String(candidates[0].seat)
          : api.choice({ kind: 'target', source: '01527', seat: inv.seat, prompt: '选择获得额外行动的研究员。',
            options: candidates.map(other => ({ id: String(other.seat), label: other.name })) })
        const target = candidates.find(other => String(other.seat) === String(answer))
        if (!target) return
        api.gainAction(target.seat, 2)
        if (state.currentSeat === target.seat) target.actionsLeft += 0
      },
    },
  ],
}
