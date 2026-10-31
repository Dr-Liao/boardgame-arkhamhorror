// 06200 夜盗
// 卡面：[action] 横置夜盗：调查。如果你检定成功，不发现线索，改为获得 2 资源，
//       你检定成功且每超过难度 1 点，额外 +1 资源（最大 +3）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：行动 = 一次调查（使用地点自己的调查技能/隐藏值），检定成功时不发现线索，
// 改为获得「2 + min(3, 成功超出点数)」资源；失败无事。调查难度走引擎的
// api.locationShroud（与 doInvestigate 同一份隐藏值读点：帷幕 + 临时修正 + 雾）。

export default {
  code: '06200',
  abilities: [
    {
      kind: 'action',
      label: '横置：调查；成功改为获得 2 资源（每超过难度 1 点再 +1，最多 +3）',
      cost: { action: true, exhaust: true },
      resolve: ({ state, inv, api }) => {
        const location = state.locations.find(item => item.id === inv.location)
        if (!location) return
        const skill = location.investigateSkill || 'intellect'
        const shroud = api.locationShroud(inv.location)
        const difficulty = shroud != null ? shroud : (location.shroud || 0) + (location.shroudMod || 0)
        api.test(inv.seat, skill, difficulty, {
          source: { label: '夜盗', name: location.name, code: '06200' },
          resolve: result => {
            if (!result.success) return
            const successBy = Math.max(0, Number(result.value || 0) - Number(result.difficulty ?? difficulty))
            const amount = 2 + Math.min(3, successBy)
            api.gainResources(inv.seat, amount)
            api.info(`${inv.name} 使用「夜盗」调查成功：不发现线索，改为获得 ${amount} 资源。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
