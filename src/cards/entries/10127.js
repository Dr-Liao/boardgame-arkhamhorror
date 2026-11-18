// 10127 黑马（Dark Horse）· 生存者资产 · 5 经验 · 永久 · 每套牌库仅限 1 张
// 卡面：永久。每套牌库仅限 1 张。
//       在补给阶段期间，你可以选择不获得资源。
//       你资源池没有资源时，你得到 +1[willpower]、+1[intellect]、+1[combat] 和 +1[agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎；与重印 02234 共用同一份已登记原语）：
//   · 「永久」：cards-data 的 permanent 字段把这张牌在开局直接放入场（setup.js 的永久卡循环），
//     因此它不作为手牌/行动打出；每套牌库 1 张由 cards-data 的 deckLimit 在构筑层判定。
//   · 「补给阶段可以选择不获得资源」：phases.js#upkeepPhase 读
//     `assetEffect(inv, asset)?.passive?.darkHorse`，为真时询问「是否放弃获得资源」，选 skip 即跳过本回合收入。
//   · 「没有资源时四项技能 +1」：modifiers.js#legacyStatDelta 读
//     `passive.allStatsIfNoResources`（inv.resources === 0 时对每项技能各加该值）。
const CODE = '10127'

export default {
  code: CODE,
  name: 'Dark Horse',
  passive: { darkHorse: true, allStatsIfNoResources: 1 },
  abilities: [],
  modifiers: [],
}
