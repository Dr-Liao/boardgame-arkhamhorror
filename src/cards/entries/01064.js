// 01064 飞蛾扑火
// 卡面：抽取遭遇牌库顶的卡牌。然后，发现你所在地点的2个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01064',
  abilities: [
    {
      kind: 'played',
      label: '飞蛾扑火',
      effect: {
        type: 'sequence',
        effects: [{ type: 'drawEncounter' }, { type: 'discoverClue', amount: 2 }],
      },
    },
  ],
  modifiers: [

  ],
}
