// 02185 锐利目光
// 卡面：永久。
// 卡面：[free]花费2资源：你得到+1[intellect]，直到本阶段结束。
// 卡面：[free]花费2资源：你得到+1[combat]，直到本阶段结束。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02185',
  abilities: [
    {
      kind: 'action',
      label: '花费 2 资源：智力 +1 直到本阶段结束',
      cost: { action: false, resources: 2 },
      effect: { type: 'addStatPhase', skill: 'intellect', amount: 1 },
    },
    {
      kind: 'action',
      label: '花费 2 资源：战斗 +1 直到本阶段结束',
      cost: { action: false, resources: 2 },
      effect: { type: 'addStatPhase', skill: 'combat', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
