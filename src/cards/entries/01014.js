// 01014 温蒂的护身符
// 卡面：温蒂·亚当斯牌库专用。
// 卡面：你可以打出你弃牌堆最顶部的事件，如同其是你的手牌。
// 卡面：强制 - 你打出一张事件后：不将其放入你的弃牌堆，改为将其放到你的牌库底。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01014 温蒂的护身符：打出的事件进牌库顶而不是弃牌堆（读点 topDiscardEvent / disposePlayedEvent）。

export default {
  code: '01014',
  playedEventsToDeckTop: true,
  abilities: [

  ],
  modifiers: [

  ],
}
