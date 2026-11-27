// 08685 泰坦坡道（Titanic Ramp）· 深潜组地点
// 卡面：泰坦坡道与左右相邻地点连接。离开泰坦坡道的额外费用：检定 [agility] (1)，失败则取消移动；
// 你所在地点或连接地点的任意调查员可花费 1 线索令你自动成功。
// 离开检定与额外支付由通用移动读点结算。
export default {
  code: '08685',
  scope: 'location',
  implemented: true,
  locationRule: {
    onLeave: {
      test: { skill: 'agility', difficulty: 1, autoSucceedCost: { clues: 1, sameOrAdjacent: true } },
      cancelOnFail: true,
    },
  },
  flags: { ramp: true },
}
