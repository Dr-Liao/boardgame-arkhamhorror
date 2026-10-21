// 04112 晕眩重击
// 卡面：如果攻击期间本次技能检定成功，自动躲避被攻击敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04112',
  abilities: [
    {
      kind: 'commit',
      label: '晕眩重击',
      skill: { onSuccess: { autoEvadeAttackedEnemy: true } },
    },
  ],
  modifiers: [

  ],
}
