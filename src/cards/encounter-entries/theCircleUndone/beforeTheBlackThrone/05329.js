// 05329 宇宙的呼唤
// 卡面 [action]：花费 X 个线索，抽取宇宙顶 X 张选 1 放置（behavior 的 actCosmosTake 行动）；
// 目标：只有憎恶宫殿的调查员可共同支付 1×人数线索（definition objective）。
// 背面：清场重建宇宙（移除宇宙入口、其余地点洗回宇宙、被抛下调查员阵亡、敌人混入遭遇牌库顶 5 张、
// 放皇廷 + 抽 2 张宇宙地点、按玩家顺序各抽 1 张遭遇）；重建参数是数据，behavior.actReveal 按数据分派。
export default {
  code: '05329',
  scope: 'act',
  implemented: true,
  actRule: {
    advance: {
      rebuild: { nextHub: 'courtOfTheGreatOldOnes', drawCount: 2, moveTo: 'hideousPalace', emptySpaces: 7 },
    },
  },
}