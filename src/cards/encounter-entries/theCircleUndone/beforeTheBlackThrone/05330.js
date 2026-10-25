// 05330 阿撒托斯的领域
// 卡面 [action] 同 05329；目标：皇廷的调查员共同支付 2×人数线索。
// 背面：清场重建宇宙（移除憎恶宫殿、虚空格子的卡洗回所有者牌库、其余地点洗回宇宙、被抛下调查员阵亡、
// 敌人混入遭遇牌库顶 5 张、「放在一边的黑色王座 + 宇宙顶 3 张」隐藏摆放到场景 3 位置表、
// 按玩家顺序各抽 1 张遭遇）；摆盘位置表在 definition.COSMOS_LAYOUTS.scene3。
export default {
  code: '05330',
  scope: 'act',
  implemented: true,
  actRule: {
    advance: {
      rebuild: { scene: 'scene3', nextHub: 'theBlackThrone', moveTo: 'courtOfTheGreatOldOnes' },
    },
  },
}
