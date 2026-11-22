// 90039 温蒂的护身符（Wendy's Amulet · Advanced）· 中立 · 支援/道具/遗物 · 奥秘槽 · 温蒂牌库专用。
//
// 卡面（cards-data 90039）：
//   Wendy Adams deck only. Advanced.
//   You may play any event in your discard pile as if it were in your hand.
//   Forced - After you play an event or discard an event from play: Place it on the bottom of
//     your deck instead of in your discard pile.
//
// 引擎读点：
//   · 「打出弃牌堆事件」：条目级 `playedEventsToDeckTop`（ability.js 条目键）是 assets.js#
//     hasPlayedEventsToDeckTop / topDiscardEvent 与 play-channels.js 弃牌堆通道的读点。
//     但该读点只允许**弃牌堆最上方的事件**（对应基础版 01014 的卡面）；进阶版是「任意事件」，
//     缺「弃牌堆任意事件可打出」的读点 → 近似：仍声明 playedEventsToDeckTop（可打出最上方事件），
//     已在 primitive-requests/core-inv-90039-play-any-event-from-discard.json 请求扩展。
//   · 「打出的事件不进入弃牌堆、改为放到牌库底」：同一读点的 disposePlayedEvent 分支
//     （assets.js：`inv.deck.unshift(code)`；本引擎牌库顶是数组尾部、unshift = 牌库底）→
//     与卡面「bottom of your deck」一致，✔ 已接线。
//   · 「放弃牌堆的事件改为放到牌库底」：disposePlayedEvent 覆盖「打出的弃牌堆事件」；从场上弃掉的
//     事件（discard an event from play）走 leaveAsset/手牌弃置路径，未读该条目字段 → 近似覆盖不到，
//     列入同一 request。

const code = '90039'

export default {
  code,
  playedEventsToDeckTop: true,
  abilities: [],
  modifiers: [],
  note: '近似：弃牌堆通道只支持最上方一张事件（进阶应为任意事件，primitive-requests/core-inv-90039-play-any-event-from-discard.json）；「从场上弃掉的事件改为进牌库底」路径未接。',
}
