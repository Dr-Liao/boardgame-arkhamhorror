// 03019 身份危机
// 卡面：显现 - 弃掉你控制的全部你当前角色的卡牌。然后，弃掉你牌库顶1张卡牌。将你的角色切换到该弃掉的卡牌职阶(如果弃掉的卡牌是弱点，切换到中立角色)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03019',
  abilities: [
    { kind: 'weakness', label: '身份危机', weakness: { type: 'crisisOfIdentity' } },
  ],
  modifiers: [

  ],
}
