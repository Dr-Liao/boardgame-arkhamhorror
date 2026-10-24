// 05330 阿撒托斯的领域
// 卡面 [action] 同 05329；目标：皇廷的调查员共同支付 2×人数线索。
// 背面：放黑色王座 + 抽 3 张宇宙地点。
export default {
  code: '05330',
  scope: 'act',
  implemented: true,
  actRule: {
    advance: {
      rebuild: { nextHub: 'theBlackThrone', drawCount: 3, moveTo: 'courtOfTheGreatOldOnes' },
    },
  },
}