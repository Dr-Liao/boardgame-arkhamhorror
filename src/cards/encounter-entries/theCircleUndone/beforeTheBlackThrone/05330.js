// 05330 阿撒托斯的领域
// 卡面 [action] 同 05329；目标：皇廷的调查员共同支付 2×人数线索。
// 背面：清场重建宇宙（移除憎恶宫殿、其余地点洗回宇宙、被抛下调查员阵亡、敌人混入遭遇牌库顶 5 张、
// 放黑色王座 + 抽 3 张宇宙地点、按玩家顺序各抽 1 张遭遇）。
export default {
  code: '05330',
  scope: 'act',
  implemented: true,
  actRule: {
    advance: {
      rebuild: { nextHub: 'theBlackThrone', drawCount: 3, moveTo: 'courtOfTheGreatOldOnes', emptySpaces: 8 },
    },
  },
}