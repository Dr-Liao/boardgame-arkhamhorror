// 02020 实验室助理
// 卡面：你的手牌上限增加2张。
// 卡面：[reaction]实验室助理入场后：抽取2张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02020 实验室助理：手牌上限 +2；入场后抽 2 张。

export default {
  code: '02020',
  passive: { handSizeBonus: 2 },
  abilities: [
    {
      kind: 'reaction', trigger: 'assetEnteredPlay', id: 'laboratoryAssistant', legacyReaction: true,
      criteria: { assetCode: '02020' }, label: '入场后抽 2 张',
      effect: { type: 'draw', amount: 2 },
    },
  ],
  modifiers: [

  ],
}
