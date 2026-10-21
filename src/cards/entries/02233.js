// 02233 礼寻术
// 卡面：使用(3充能)。
// 卡面：[action]花费1充能：调查。本次调查不使用[intellect]，改为使用[willpower]。你本次检定得到+2[willpower]。如果检定成功，你发现所在地点额外2个线索。如果本次检定期间揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，本次检定结算后，失去所有剩余的行动，立即结束你的回合。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02233',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '高阶寻求仪式',
      cost: { action: true, uses: 1 },
      effect: {
        type: 'investigate',
        skill: 'willpower',
        bonus: 2,
        clueBonus: 2,
        symbolEndsTurn: true,
      },
    },
  ],
  modifiers: [

  ],
}
