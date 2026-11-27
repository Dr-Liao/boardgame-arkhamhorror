// 10129 静候时机（Bide Your Time）· 中立事件 · 0 资源 · 0 级 · [[双重]]（Double）
// 卡面：
//   作为打出静候时机的额外费用，花费一个行动。
//   在你下个回合期间，你可以进行额外两次行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 「额外费用：花费一个行动」= played 描述子的 `cost: { action: 1 }`
//     （ability.js#playedActionCost 是唯一读点，legalMoves / validateMove / doPlay 三处同源；
//      与 10027 / 10069 等 [[双重]] 卡同一口径）。资源费用 0 来自卡面数据。
//   · 「下个回合期间可以额外行动」= api.grantExtraActionNextTurn（beginInvestigationPhase
//     在目标的下个回合把 inv.extraActionNextTurn 换成 +1 行动后清除）。
//
const CODE = '10129'

export default {
  code: CODE,
  name: 'Bide Your Time',
  abilities: [
    {
      kind: 'played',
      cost: { action: 1 },
      label: '额外花费 1 行动：你的下个回合可以额外进行两次行动',
      resolve: ({ inv, api }) => {
        api.grantExtraActionNextTurn(inv.seat, 2)
        api.info(`⏳ ${inv.name} 打出「静候时机」：下个回合可以额外进行两次行动。`)
      },
    },
  ],
  modifiers: [],
}
