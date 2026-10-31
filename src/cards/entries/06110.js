// 06110 头班守夜
// 卡面：快速。在神话阶段的“抽取遭遇卡牌”步骤将要开始时打出。
//       不结算该步骤，改为查看遭遇牌库顶的X张卡牌，其中X等于调查员人数。
//       在任意数量的调查员之间分发这些卡牌，除你以外的每位调查员至多只能分发1张。
//       然后，每位调查员依次抽取发放给自己的卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06110 头班守夜（显式简化）：
//   · 快速事件：played + fast；时机近似为「阶段开始」（phaseBegins）且当前阶段为神话阶段
//     （引擎没有「神话阶段抽取遭遇牌步骤将要开始」的窗口）。
//   · 结算近似：查看遭遇牌库顶 X 张并重新排列（api.lookAt arrange），X = 调查员人数；
//     显式简化：不取消本次神话阶段的抽牌步骤、也不按座位分发——引擎没有「按座位分发遭遇牌」的
//     API（drawEncounter 只能抽顶），替换步骤需要新窗口 + 新 API（见 primitive-requests/w-m2-1-06110-*）。

export default {
  code: '06110',
  simplified: true,
  note: '未实现：替换神话阶段的抽取遭遇步骤与按座位分发遭遇牌（无该时机窗口、无按座位分发遭遇牌的 API）；'
    + '已实现：快速事件（近似在神话阶段开始时）查看遭遇牌库顶 X 张并重新排列，X = 调查员人数。',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'phaseBegins',
      criteria: [({ state }) => state.phase === 'mythos'],
      label: '查看遭遇牌库顶 X 张并重新排列（X = 调查员人数）',
      resolve: ({ state, inv, api }) => {
        const count = (state.investigators || []).filter(target => !target.defeated && !target.resigned).length
        if (!count || !(state.encounterDeck || []).length) {
          api.info('「头班守夜」：没有可查看的遭遇卡牌。')
          return
        }
        api.lookAt(inv.seat, {
          zone: 'encounterDeck', count, choose: 0, arrange: true, returnStrategy: 'top', source: '06110',
        })
        api.info(`「头班守夜」：${inv.name} 查看了遭遇牌库顶 ${count} 张卡牌并重新排列（替换步骤未实现）。`)
      },
    },
  ],
  modifiers: [],
}
