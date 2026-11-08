// 08682 泰坦坡道（Titanic Ramp）· 深潜组地点
// 卡面：泰坦坡道与左右相邻地点连接。离开泰坦坡道的额外费用：检定 [agility] (4)，失败则取消移动；
// 你所在地点或连接地点的任意调查员可花费 1 线索令你自动成功。
// 读点：locationRule.leaveTestDifficulty / spendClueAutoSucceed → behavior.locationLeaveTest。
export default {
  code: '08682',
  scope: 'location',
  implemented: true,
  locationRule: {
    leaveTestDifficulty: 4,
    spendClueAutoSucceed: true,
  },
  flags: { ramp: true },
}
