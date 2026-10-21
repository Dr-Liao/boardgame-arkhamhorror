// 04153 参透真谛
// 卡面：只能投入冒险卡牌上印刷能力中的技能检定。
// 卡面：如果本次技能检定成功，你发现你所在地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04153',
  abilities: [
    {
      kind: 'commit',
      label: '参透真谛',
      skill: { scenarioAbilityOnly: true, onSuccess: { clueBonus: 1 } },
    },
  ],
  modifiers: [

  ],
}
