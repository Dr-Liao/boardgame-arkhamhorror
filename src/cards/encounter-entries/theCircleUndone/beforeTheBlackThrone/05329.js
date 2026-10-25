// 05329 宇宙的呼唤
// 卡面 [action]：花费 X 个线索，抽取宇宙顶 X 张选 1 放置（behavior 的 actCosmosTake 行动）；
// 目标：只有憎恶宫殿的调查员可共同支付 1×人数线索（definition objective）。
// 背面：清场重建宇宙（移除宇宙入口、虚空格子的卡洗回所有者牌库、其余地点洗回宇宙、被抛下调查员阵亡、
// 敌人混入遭遇牌库顶 5 张、「放在一边的皇廷 + 宇宙顶 2 张」隐藏摆放到场景 2 位置表、
// 按玩家顺序各抽 1 张遭遇）；摆盘位置表在 definition.COSMOS_LAYOUTS.scene2。
export default {
  code: '05329',
  scope: 'act',
  implemented: true,
  actRule: {
    advance: {
      rebuild: { scene: 'scene2', nextHub: 'courtOfTheGreatOldOnes', moveTo: 'hideousPalace' },
    },
  },
}
