// 08686 隐藏隧道（Hidden Tunnel）· 深潜组地点
// 卡面：隐藏隧道与左侧地点连接。目标 - 如果每名未被击败的调查员都在隐藏隧道，推进幕。
export default {
  code: '08686',
  scope: 'location',
  implemented: true,
  locationRule: {
    objectiveRun: true,
  },
  flags: { hiddenTunnel: true, objectiveRun: true },
}
