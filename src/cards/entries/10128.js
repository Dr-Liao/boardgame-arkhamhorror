// 10128 惊世巧舌（Eldritch Tongue）· 中立资产 · 0 经验 · 法术槽
// 卡面：使用（4 充能）。
//       你可以打出你弃牌堆带有“谈判”的事件，如同其是你的手牌。作为以此方式打出事件的额外费用，
//       花费惊世巧舌的 1 充能。该事件结算后，将其从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 使用（4 充能）= 条目级 `uses: 4` / `usesType: 'charges'`（newPlayerAssetInstance 初始化，
//     play-channels 的宿主附加费读 uses）。
//   · 「从弃牌堆打出带谈判的事件，如同手牌」= `assetRule: { parleyEventsFromDiscard: true }`。
//     这是 play-channels.js 唯一声明的通道：`discard` 通道枚举宿主（04105 劝服等带 parley 的事件），
//     额外费用花宿主 1 充能、事件结算后移出游戏（RemoveFromGameInsteadOfDiscard）都在原语内结算；
//     legalMoves / validateMove / dispatch / 反应窗口共用同一份声明（04105 的测试
//     tests/fhv-primitives.test.mjs「打出弃牌区谈判事件花费宿主一次使用次数」已锁死形状）。
const CODE = '10128'
const MAX_CHARGES = 4

export default {
  code: CODE,
  name: 'Eldritch Tongue',
  uses: MAX_CHARGES,
  usesType: 'charges',
  assetRule: { parleyEventsFromDiscard: true },
  abilities: [],
  modifiers: [],
}
