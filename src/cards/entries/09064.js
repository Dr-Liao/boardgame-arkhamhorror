// 09064 扒手行窃工具（Thieves' Kit）· 游荡者（Rogue）资产 · 0 经验 · 道具 · 工具 · 违法 · 手部。
// 重印：本卡号是 canonical 实现，跨循环重印 12049 由 cards-data 的别名复用（不另写文件）。
//
// 卡面：使用(6 补给)。
//       [action] 花费 1 补给：调查。你本次调查可以不使用[智力]，改为使用[敏捷]。
//       如果你检定成功，获得 1 资源。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：调查走 actions.js#runInvestigate——`skill` 改写本次调查使用的技能（与礼寻术同一读点），
// `onInvestigateSuccess` 在调查成功后结算「获得 1 资源」（在发现线索之前，与卡面顺序一致）。
//
// P1-8（2026-11-13）：卡面「你本次调查**可以**不使用[智力]，改为使用[敏捷]」是可选项；旧实现
// 硬写 skill:'agility' 永远用敏捷。现在先询问（默认敏捷 = 卡面主用法），选智力时走默认调查技能。
export default {
  code: '09064',
  uses: 6,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'action',
      countsAs: 'investigate',
      cost: { action: true, uses: 1 },
      label: '花费 1 补给：可以用[敏捷]代替[智力]调查；成功后获得 1 资源',
      criteria: [({ source }) => (source?.uses || 0) > 0],
      resolve: ({ inv, api }) => {
        const useAgility = api.choice({
          kind: 'effect', source: '09064', seat: inv.seat,
          prompt: '「扒手行窃工具」：本次调查使用哪项技能？',
          options: [
            { id: 'agility', label: '使用[敏捷]代替[智力]' },
            { id: 'intellect', label: '照常使用[智力]' },
          ],
        }) !== 'intellect'
        api.investigate(inv.seat, {
          ...(useAgility ? { skill: 'agility' } : {}),
          onInvestigateSuccess: () => {
            api.gainResources(inv.seat, 1)
            api.info(`🧰 「扒手行窃工具」：${inv.name} 调查成功，获得 1 资源。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
