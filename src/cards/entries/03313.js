// 03313 报纸
// 卡面：你调查时如果没有线索，得到+2[intellect]。
// 卡面：[reaction]在你将要发现你所在地点的至少1个线索时，如果你没有线索：发现你所在地点的额外1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03313',
  passive: {"investigateBonusIfNoClues":2},
  abilities: [
    {
      kind: 'reaction', trigger: 'discoverClue', id: 'newspaperClue', legacyReaction: true,
      criteria: { requiresNoClues: true }, label: '额外发现 1 个线索',
      effect: { type: 'discoverClue', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
