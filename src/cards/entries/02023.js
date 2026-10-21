// 02023 寻找答案
// 卡面：调查。如果你检定成功，不发现你所在地点的1个线索，改为在一个连接地点发现1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02023',
  abilities: [
    { kind: 'played', label: '寻找答案', effect: { type: 'investigateConnectingClue' } },
  ],
  modifiers: [

  ],
}
