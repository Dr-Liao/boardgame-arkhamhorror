// 02229 思维敏捷
// 卡面：如果本次技能检定成功且超过难度2点或更多，在其结算后，你可以立即进行一个行动，如同在你的回合(该行动不计入你每回合可以进行的行动数)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02229',
  abilities: [
    {
      kind: 'commit',
      label: '思维敏捷',
      skill: { successBy: { threshold: 2, gainAction: 1 } },
    },
  ],
  modifiers: [

  ],
}
