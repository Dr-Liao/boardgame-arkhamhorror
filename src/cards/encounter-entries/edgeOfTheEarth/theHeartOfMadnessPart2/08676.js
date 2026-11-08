// 08676 迷雾高塔（Mist-Pylon）· 深潜组地点
// 卡面（背面）：进入迷雾高塔的额外费用：此地点的调查员团队花费 1×人数线索。
// [fast] 如果控制激活的 seal_c：把 seal_c 放到此高塔；此后调查员在迷雾高塔时所有技能 +1。
// 读点：locationRule.fastActions → behavior.performAction 的 heartOfMadnessUnleash 分支；
// 高塔寿命/坍塌走 P2-D eote-facilities。
export default {
  code: '08676',
  scope: 'location',
  implemented: true,
  locationRule: {
    enterCostCluePerInvestigator: 1,
    fastActions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessUnleash:C', actions: 0,
        label: '🔓 迷雾高塔：释放封印 C 的力量（fast）' })
    },
  },
  flags: { pylonKind: 'C', mistPylon: true },
}
