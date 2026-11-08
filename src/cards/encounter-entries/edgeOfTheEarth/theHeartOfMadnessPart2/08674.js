// 08674 迷雾高塔（Mist-Pylon）· 深潜组地点
// 卡面（背面）：进入迷雾高塔的额外费用：此地点的调查员团队花费 1×人数线索。
// [fast] 如果控制激活的 seal_a：把 seal_a 放到此高塔；此后你对迷雾高塔的伤害 +1。
// 读点：locationRule.fastActions → behavior.performAction 的 heartOfMadnessUnleash 分支；
// 高塔寿命/坍塌走 P2-D eote-facilities。
export default {
  code: '08674',
  scope: 'location',
  implemented: true,
  locationRule: {
    enterCostCluePerInvestigator: 1,
    fastActions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessUnleash:A', actions: 0,
        label: '🔓 迷雾高塔：释放封印 A 的力量（fast）' })
    },
  },
  flags: { pylonKind: 'A', mistPylon: true },
}
