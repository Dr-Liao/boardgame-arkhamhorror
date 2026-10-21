// 01053 机会主义者
// 卡面：只能投入你正在执行的技能检定。
// 卡面：如果你检定成功且超过难度至少3点，在本次检定后不将机会主义者弃掉，改为将其返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01053',
  abilities: [
    {
      kind: 'commit',
      label: '机会主义者',
      skill: { returnOnSuccessBy: 3, selfTestOnly: true },
    },
  ],
  modifiers: [

  ],
}
