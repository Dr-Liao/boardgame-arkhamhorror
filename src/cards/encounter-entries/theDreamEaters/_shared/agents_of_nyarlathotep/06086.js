// 06086 蠕行之雾（The Crawling Mist，敌人，1 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：agents_of_nyarlathotep（TSK / WTGD）。
// 卡面：猎物 - 手牌最多。猎手。庞大。
//       你手牌中每有一张牌背为遭遇卡牌的卡牌，攻击或躲避蠕行之雾的难度提高 1 点。
// 实现：猎手/庞大由 definition 解析；「攻击/躲避难度按手中遭遇卡数量提高」需要
//   enemyStatModifier 拿到调查员上下文（引擎 enemyFightValue/enemyEvadeValue 只传 state/enemy/stat），
//   引擎侧无读点 → 写 flags + 协调请求；猎物 key（mostCardsInHand）也未在 PREY_RANK 中。
export default {
  code: '06086',
  scope: 'enemy',
  implemented: true,
  // 猎物「手牌最多」由引擎 PREY_RANK 的 mostCardsInHand 求值。
  enemyRule: { prey: 'mostCardsInHand' },
  // 共享 enemyStatModifier 的 per.source='encounterCardsInHand'：攻击/躲避难度按手牌中遭遇卡数 +1。
  enemyStatRule: {
    per: [
      { stat: 'fight', source: 'encounterCardsInHand', amount: 1 },
      { stat: 'evade', source: 'encounterCardsInHand', amount: 1 },
    ],
  },
}
