// 08668 石灰岩洞（Limestone Caverns）· 大封印组地点
// 卡面：强制 - 揭示后把休眠 [seal_e] 放到此处。[action]：此地点的调查员团队花费
// 1×人数线索与 3×人数资源：取得此地点的封印控制权（无检定）。
export default {
  code: '08668',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessSeal:E', actions: 1,
        label: '⛰️ 石灰岩洞：团队花费线索与资源取得 seal_e（无检定）' })
    },
  },
  flags: { sealRecover: 'E', recoverSkill: null, recoverDifficulty: 0, recoverResourcesPerInvestigator: 3 },
}
