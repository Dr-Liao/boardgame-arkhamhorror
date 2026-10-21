// 04155 职业杀手
// 卡面：如果在躲避尝试期间进行本技能检定，且检定成功，则在本回合中，成功躲避的该敌人下次受到伤害时，对其造成额外1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04155',
  abilities: [
    {
      kind: 'commit',
      label: '职业杀手',
      skill: { onEvadeSuccess: { damageBonusNext: 1 } },
    },
  ],
  modifiers: [

  ],
}
