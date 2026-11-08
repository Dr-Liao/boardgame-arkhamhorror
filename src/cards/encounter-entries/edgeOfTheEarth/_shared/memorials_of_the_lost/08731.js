// 08731 爱伦·坡作品集（Poe Collection）· 剧情资产 · memorials_of_the_lost
// 卡面：使用(3充能)。[action]花费 1 充能：选择你所在地点的一位调查员，其查找自己牌库顶的 6 张卡牌，
//   找出其中所有忒咳哩-哩，并将这些卡牌都放在忒咳哩-哩牌库底。混洗该调查员的牌库。该调查员抽取 1 张卡牌。
// 读点：「查找牌库顶并只把忒咳哩-哩放回剧本牌库底」需要一个「查找顶牌→剧本牌库底」读点
//   （primitive-requests/p7-08731.json）；条目先落数据与次数。
export default {
  code: '08731', scope: 'storyAsset', implemented: true,
  uses: 3, usesType: 'charges',
  flags: { memorial: true },
  note: '「查找牌库顶 6 张，把忒咳哩-哩放回忒咳哩-哩牌库底，洗牌后抽 1」需要引擎的查找顶牌→剧本牌库底读点（primitive-requests/p7-08731.json）。',
}

