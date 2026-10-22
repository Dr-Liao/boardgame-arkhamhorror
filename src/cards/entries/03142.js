// 03142 黑玛瑙扣环
// 卡面：黑玛瑙扣环在你手牌中时，你每张其他手牌的费用提升1点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03142 黑玛瑙扣环：在手牌中时，你每张其他手牌的费用 +1。

export default {
  code: '03142',
  assetRule: { onxyRing: true },
  // P0：这是剧情加入的「弱点支援」，卡面没有显现效果；抽到后应留在手牌里
  // 让 +1 费用生效，而不是走弱点结算后进弃牌堆（旧实现会因缺 profile 直接抛错）。
  weaknessStaysInHand: true,
  weaknessHandNote: '「黑玛瑙扣环」留在手中：你每张其他手牌的费用 +1。',
  modifiers: [
    { target: 'playCost', amount: 1, condition: { sourceInHand: true } },
  ],
  abilities: [

  ],
}
