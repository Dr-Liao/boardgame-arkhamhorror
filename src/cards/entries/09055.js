// 09055 媒体通行证（Press Pass）· 探寻者（Seeker）资产 · 2 经验 · 饰品。
//
// 卡面：[reaction] 你花费线索或将线索放到你所在地点后，横置媒体通行证：本回合期间你可以进行额外
//       一次行动（如果现在不是你的回合，则你的下一个回合期间）。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：clueDiscovered 窗口（locations.js#discoverClueAt 在发现线索后开窗，context 带 seat/location）
// ——这是引擎唯一「你的线索变动后」的窗口。
// approximation: 卡面的触发还包括「花费线索」；引擎对 spendClues 没有窗口（api.spendClues 直接记账），
// 因此这里以「发现/放置线索后」的窗口近似，另写原语请求 primitive-requests/09055.json
// （new.cluesSpentWindow）。测试断言近似后的真实行为：横置 + 本回合额外行动 / 非本回合改为下回合额外行动。
const CODE = '09055'

export default {
  code: CODE,
  simplified: true,
  note: 'approximation: 以 clueDiscovered 窗口覆盖「花费线索或放置线索后」；花费线索的独立窗口见 primitive-requests/09055.json。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'clueDiscovered',
      cost: { exhaust: true },
      label: '你花费/放置线索后：横置媒体通行证，本回合（非本回合则下个回合）额外一次行动',
      criteria: [({ inv, source, context }) => {
        if (!source || source.exhausted) return false
        return Number.isInteger(context?.seat) && context.seat === inv.seat
      }],
      resolve: ({ state, inv, api }) => {
        if (state.currentSeat === inv.seat) {
          api.gainAction(inv.seat, 1)
          api.info(`📰 「媒体通行证」：${inv.name} 本回合额外执行一次行动。`)
          return
        }
        api.grantExtraActionNextTurn(inv.seat)
        api.info(`📰 「媒体通行证」：${inv.name} 的下一个回合额外执行一次行动。`)
      },
    },
  ],
  modifiers: [],
}
