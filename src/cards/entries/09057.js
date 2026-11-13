// 09057 指纹采集工具（Fingerprint Kit）· 探寻者（Seeker）资产 · 4 经验 · 道具 · 工具 · 手部。
//
// 卡面：使用(3 补给)。
//       [action] 横置指纹采集工具并花费 1 补给：调查。你本次调查得到 +2[智力]。
//       如果你检定成功，发现你所在地点额外 2 个线索。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：调查走 actions.js#runInvestigate 的统一入口——`bonus` 是本次检定的固定技能加值，
// `clueBonus` 是成功时的额外线索数（与「发现线索」的 gain 计算同源）。
const CODE = '09057'

export default {
  code: CODE,
  uses: 3,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'action',
      countsAs: 'investigate',
      cost: { action: true, exhaust: true, uses: 1 },
      label: '横置并花费 1 补给：调查，+2[智力]；成功后额外发现 2 个线索',
      criteria: [({ source }) => (source?.uses || 0) > 0],
      resolve: ({ inv, api }) => {
        api.info(`🔎 「指纹采集工具」：${inv.name} 进行调查（+2[智力]，成功额外 2 个线索）。`)
        api.investigate(inv.seat, { bonus: 2, clueBonus: 2 })
      },
    },
  ],
  modifiers: [],
}
