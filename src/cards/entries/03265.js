// 03265 指导
// 卡面：选择你所在地点的另一位本轮尚未进行其回合的调查员。该调查员可以在本轮自己回合期间进行额外一次行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03265 指引：同地点另一位调查员获得 1 个额外行动。

export default {
  code: '03265',
  abilities: [
    {
      kind: 'played', label: '同地点另一位调查员 +1 行动',
      resolve: ({ inv, api }) => {
        const targets = api.investigatorsAt(inv.location).filter(other => other.seat !== inv.seat && !other.turnEnded)
        if (!targets.length) return
        const seatId = targets.length === 1 ? targets[0].seat
          : Number(api.choice({ kind: 'investigator', source: '03265', seat: inv.seat,
            prompt: '选择获得额外行动的调查员。', options: targets.map(other => ({ id: String(other.seat), label: other.name })) }))
        api.gainAction(seatId, 1)
      },
    },
  ],
  modifiers: [

  ],
}
