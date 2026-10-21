// 02255 犹格·索托斯之子
// 卡面：庞大。
// 卡面：犹格·索托斯之子得到+1[per_investigator]生命值，且不能因深奥的咒文以外的能力被伤害或攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02255 「文本空白时生命值按调查员人数减少」（原 rules-state.enemyHealthValue 的卡号特判）。

export default {
  code: '02255',
  enemyRule: { damageOnlyFrom: '02254', healthPerPlayerBonus: 1 },
  modifiers: [
    {
      target: 'enemyHealth',
      amount: ctx => -((ctx.state?.numInvestigators) || 1),
      condition: { blankedThisRound: true },
    },
  ],
  abilities: [

  ],
}
