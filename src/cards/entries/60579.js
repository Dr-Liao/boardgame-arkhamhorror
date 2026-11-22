// 60579 镇静自若 · 支援（2 费，3 经验，敏捷/万用/意志图标，才能）
// 卡面：起始。（你每场游戏开始的起始手牌可以加入 1 张「起始」关键词的卡牌）
//       [fast]花费 1 资源：你本次技能检定得到 +1[willpower]（若是冒险卡牌上的检定，改为 +2）。
//       [fast]花费 1 资源：你本次技能检定得到 +1[agility]（若是冒险卡牌上的检定，改为 +2）。
// 说明：「起始」关键词由构筑/开场手牌层读取（Lead 负责接入），条目声明 startingCard 标记。
const CODE = '60579'
const duringTest = ({ state }) => Boolean(state.skillTest)

export default {
  code: CODE,
  flags: { startingCard: true },
  abilities: [
    {
      kind: 'action',
      actionKind: 'activate',
      label: '[fast]花费 1 资源：本次检定 +1 意志（冒险卡检定改为 +2）',
      cost: { action: false, resources: 1 },
      criteria: [duringTest, ({ state }) => state.skillTest?.skill === 'willpower' || state.skillTest?.skill === 'agility'],
      resolve: ({ state, inv, api }) => {
        if (state.skillTest?.skill !== 'willpower') return
        const scenarioTest = state.skillTest?.scenario === true || state.skillTest?.source?.scenario === true
        api.addPendingTestBonus(scenarioTest ? 2 : 1)
      },
    },
    {
      kind: 'action',
      actionKind: 'activate',
      label: '[fast]花费 1 资源：本次检定 +1 敏捷（冒险卡检定改为 +2）',
      cost: { action: false, resources: 1 },
      criteria: [duringTest, ({ state }) => state.skillTest?.skill === 'agility'],
      resolve: ({ state, api }) => {
        const scenarioTest = state.skillTest?.scenario === true || state.skillTest?.source?.scenario === true
        api.addPendingTestBonus(scenarioTest ? 2 : 1)
      },
    },
  ],
  modifiers: [],
  note: '起始关键词由构筑/起始手牌层读取（flags.startingCard）；两项 [fast] 检定加值已接线。',
}
