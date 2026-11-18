// 10720 矿物隧道（Mineral Tunnel）· 地点 · 共享遭遇组 horrors_in_the_rock
// 归属：战役共用 · theFeastOfHemlockVale/_shared/horrors_in_the_rock。
// 卡面（cards-data 10720）：
//   你调查矿物隧道时，你每有一张手牌，矿物隧道得到 +1 隐藏值
//   （简单/普通难度最多 +6）。
//
// 读点（声明即接线）：地点卡自己的「调查检定开始时」规则 =
//   locationRule.onInvestigationTestInitiated（tests.js#performTest 的唯一派发点；
//   返回值直接加到本次检定的难度上，忽略地点触发走 location-effect-scope 的既有开关）。
//   难度档位读 state.difficulty（easy/standard/hard/expert），简单/普通封顶 6。
const CODE = '10720'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Cave', 'Dark'],
    printedShroud: 0,
    printedClues: 1,
    quantity: 1,
    investigateShroudPerHandCard: 1,
    investigateShroudMaxEasyStandard: 6,
  },
  locationRule: {
    onInvestigationTestInitiated(state, inv) {
      const cards = (inv?.hand || []).length
      const hard = ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
      return hard ? cards : Math.min(6, cards)
    },
  },
  abilities: [],
  note: '调查难度加值走 locationRule.onInvestigationTestInitiated（与印刷「隐藏值」在调查检定中等价）；'
    + '简单/普通最多 +6，困难/专家不封顶（读 state.difficulty）。',
}
