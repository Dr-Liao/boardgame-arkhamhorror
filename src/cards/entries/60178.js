// 60178 耐力（Endurance，3 级）
// 卡面：起始。[fast] 花 1 资源：本次检定 +1[combat]（攻击或躲避时改为 +2[combat]）。
// [fast] 花 1 资源：本次检定 +1[agility]（攻击或躲避时改为 +2[agility]）。
// 读点：flags.starting（起始关键词，与 60380 同口径；读点为 Lead 侧 deck 起始手牌逻辑）；
// free 描述子 trigger test.afterCommit（60380 同窗口）+ cost.resources + api.addTestValue。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60178'
const isAttackOrEvade = state => ['fight', 'evade'].includes(state.skillTest?.actionKind)

export default {
  code: CODE,
  flags: { starting: true },
  abilities: [
    {
      kind: 'free',
      trigger: 'test.afterCommit',
      label: '花 1 资源：本次检定 +1 战斗（攻击/躲避 +2）',
      cost: { resources: 1 },
      criteria: [({ state }) => Boolean(state.skillTest)],
      resolve: ({ state, api }) => api.addTestValue(isAttackOrEvade(state) ? 2 : 1),
    },
    {
      kind: 'free',
      trigger: 'test.afterCommit',
      label: '花 1 资源：本次检定 +1 敏捷（攻击/躲避 +2）',
      cost: { resources: 1 },
      criteria: [({ state }) => Boolean(state.skillTest)],
      resolve: ({ state, api }) => api.addTestValue(isAttackOrEvade(state) ? 2 : 1),
    },
  ],
  modifiers: [],
}
