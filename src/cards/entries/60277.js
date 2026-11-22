// 60277 犀利率辩（Sharp Rhetoric）
// 卡面：起始。[fast] 花 1 资源：本次检定 +1[intellect]（调查或谈判时改为 +2[intellect]）。
// [fast] 花 1 资源：本次检定 +1[willpower]（调查或谈判时改为 +2[willpower]）。
// 读点：flags.starting（起始关键词，60380 同口径）；free 描述子 trigger test.afterCommit + cost.resources + api.addTestValue。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60277'
const isInvestigatingOrParley = state => ['investigate', 'parley'].includes(state.skillTest?.actionKind)

export default {
  code: CODE,
  flags: { starting: true },
  abilities: [
    {
      kind: 'free',
      trigger: 'test.afterCommit',
      label: '花 1 资源：本次检定 +1 智识（调查/谈判 +2）',
      cost: { resources: 1 },
      criteria: [({ state }) => Boolean(state.skillTest)],
      resolve: ({ state, api }) => api.addTestValue(isInvestigatingOrParley(state) ? 2 : 1),
    },
    {
      kind: 'free',
      trigger: 'test.afterCommit',
      label: '花 1 资源：本次检定 +1 意志（调查/谈判 +2）',
      cost: { resources: 1 },
      criteria: [({ state }) => Boolean(state.skillTest)],
      resolve: ({ state, api }) => api.addTestValue(isInvestigatingOrParley(state) ? 2 : 1),
    },
  ],
  modifiers: [],
}
