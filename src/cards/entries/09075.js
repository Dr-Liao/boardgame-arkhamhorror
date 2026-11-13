// 09075 扒手行窃工具（Thieves' Kit）· 游荡者支援 · 3 经验。
// 卡面：使用(6 补给)。[action] 花费 1 补给：调查。本次调查你可以不使用[intellect]改为使用[agility]，
//       且你得到 +1 技能值。如果你检定成功，获得 1 资源（如果你检定成功且超过难度至少 2 点，改为 2 资源）。
//
// 读点：以 api.investigate 发起真实调查检定（skill 来源可选敏捷/智识，bonus 为本次 +1）；
// 成功结算走 onInvestigateSuccess（发现线索之前），资源按检定结果的成功差值结算。
export default {
  code: '09075',
  uses: 6,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'action',
      label: '花费 1 补给：用敏捷调查，+1 技能值；成功后获得 1 资源（成功 2 点以上改为 2）',
      cost: { action: true, uses: 1 },
      countsAs: 'investigate',
      resolve: ({ inv, api }) => {
        const skill = api.choice({
          kind: 'effect', source: '09075', seat: inv.seat,
          prompt: '选择本次调查使用的技能。',
          options: [
            { id: 'agility', label: '使用敏捷' },
            { id: 'intellect', label: '使用智识' },
          ],
        }) === 'intellect' ? 'intellect' : 'agility'
        api.investigate(inv.seat, {
          skill,
          bonus: 1,
          onInvestigateSuccess: (result, context) => {
            const successBy = Number(result.value || 0) - Number(result.difficulty || 0)
            const amount = successBy >= 2 ? 2 : 1
            api.gainResources(context.inv.seat, amount)
            api.info(`🪝 「扒手行窃工具」：调查成功，获得 ${amount} 资源。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
