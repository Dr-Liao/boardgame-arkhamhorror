// 02302 威廉·T·马尔森博士
// 卡面：[reaction]在你从遭遇牌库抽取一张遭遇卡牌时，横置威廉·T·马尔森博士并将你的一个线索放在你的地点：取消该卡牌的抽取，并将其混洗回遭遇牌库。然后，从遭遇牌库顶抽取一张新卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02302 马莱森博士：抽取遭遇卡后横置并花 1 线索，重抽遭遇卡。

export default {
  code: '02302',
  abilities: [
    {
      kind: 'reaction', trigger: 'encounterDrawn', id: 'maleson', legacyReaction: true,
      label: '横置并花 1 线索重抽遭遇卡', cost: { exhaust: true, clues: 1, returnClue: true },
      effect: { type: 'redrawEncounter' },
    },
  ],
  modifiers: [

  ],
}
