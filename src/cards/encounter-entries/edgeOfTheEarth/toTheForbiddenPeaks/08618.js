// 08618 矿物标本（Mineral Specimen）· storyAsset
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   使用(3充能)。
//   [action]花费1充能：调查。以基础值为5的[intellect]调查。取消本次检定期间揭示的所有[frost]标记。
//   如果你检定成功，发现你所在地点额外1个线索。
//
// 读点：action 描述子 → legalMoves/doAbility；调查走 api.investigate（doInvestigate 的
// options.baseValue = 5 覆盖基础技能值，标准发现线索与调查窗口全部保留），成功后
// api.discoverClue 额外发现 1 个线索。
// approximation: 「取消本次检定期间揭示的所有 [frost] 标记」没有通用的「取消已揭示标记」原语，
//   其余按印刷实现；已在 behavior.scenarioGaps 登记。
export default {
  code: '08618',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'charges',
  flags: { expedition: true },
  abilities: [{
    kind: 'action',
    actionKind: 'investigate',
    label: '花费 1 充能：以基础值 5 的[智力]调查；成功后在此地额外发现 1 个线索',
    cost: { action: true, exhaust: false, uses: 1 },
    resolve: ({ inv, api }) => {
      api.investigate(inv.seat, { baseValue: 5 })
      const result = api.testResult?.()
      if (result?.success) {
        api.discoverClue(inv.seat, 1, inv.location)
        api.info('🔬 矿物标本：检定成功，在所在地点额外发现 1 个线索。')
      }
    },
  }],
}
