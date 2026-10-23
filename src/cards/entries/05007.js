// 05007 催眠疗法
// 卡面：卡洛琳·弗恩牌库专用
// 卡面：[action]横置催眠疗法：检定[intellect](2)。如果你检定成功，治愈你所在地点一位调查员1点恐惧。
//       然后，该调查员可以抽取1张卡牌。
// 卡面：[reaction]在你的其他卡牌效果治愈调查员的恐惧后，横置催眠疗法：该效果治愈额外1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '05007',
  abilities: [
    {
      kind: 'action',
      label: '催眠疗法：检定智力(2)，治愈 1 点恐惧并可抽 1 张',
      cost: { action: true, exhaust: true },
      resolve: ({ inv, api }) => api.test(inv.seat, 'intellect', 2, {
        source: { label: '催眠疗法', code: '05007', name: '催眠疗法' },
        resolve: result => {
          if (!result.success) return
          const targets = api.investigatorsAt(inv.location).filter(owner => (owner.horror || 0) > 0)
          if (!targets.length) return
          const answer = targets.length === 1 ? String(targets[0].seat) : api.choice({
            kind: 'target', source: '05007', seat: inv.seat,
            prompt: '选择要治愈恐惧的调查员。',
            options: targets.map(owner => ({ id: String(owner.seat), label: `${owner.name}（${owner.horror} 恐惧）` })),
          })
          const target = targets.find(owner => String(owner.seat) === answer)
          if (!target) return
          api.healHorror(target.seat, 1)
          const draw = api.choice({
            kind: 'reaction', source: '05007-draw', seat: target.seat, canSkip: true,
            prompt: `${target.name}：是否抽取 1 张卡牌？`,
            options: [{ id: 'skip', label: '不抽牌' }, { id: 'draw', label: '抽取 1 张' }],
          })
          if (draw === 'draw') api.drawCards(target.seat, 1)
        },
      }),
    },
    {
      kind: 'reaction',
      trigger: 'horrorHealed',
      label: '这次治疗额外治愈 1 点恐惧',
      cost: { exhaust: true },
      criteria: [({ inv, context }) => context?.cardSeat === inv.seat
        && Number.isInteger(context?.healedSeat) && context.amount > 0],
      resolve: ({ api, context }) => {
        api.healHorror(context.healedSeat, 1)
        api.info('催眠疗法让这次治疗额外治愈了 1 点恐惧。')
      },
    },
  ],
  modifiers: [],
}
