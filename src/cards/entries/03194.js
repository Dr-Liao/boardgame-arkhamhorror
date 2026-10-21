// 03194 暗中偷袭
// 卡面：攻击。本次攻击将你的[agility]值加入你的技能值。如果你检定成功且超过难度至少2点，自动躲避被攻击敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03194',
  abilities: [
    {
      kind: 'played',
      label: '暗中偷袭',
      effect: { type: 'fight', addSkill: 'agility', autoEvadeOnSuccessBy: 2 },
    },
  ],
  modifiers: [

  ],
}
