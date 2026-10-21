// 04009 未知的呼唤
// 卡面：显现 - 将未知的呼唤放置入场，放到你的威胁区域。
// 卡面：强制 - 当你的回合开始时：选择你所在地点以外的一个地点。在你的回合结束时，如果本回合你没能成功调查所选地点，受到2点恐惧并将未知的呼唤洗回你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04009',
  abilities: [
    {
      kind: 'weakness',
      label: '未知的呼唤',
      weakness: { type: 'threat', turnForced: 'callOfTheUnknown' },
    },
  ],
  modifiers: [

  ],
}
