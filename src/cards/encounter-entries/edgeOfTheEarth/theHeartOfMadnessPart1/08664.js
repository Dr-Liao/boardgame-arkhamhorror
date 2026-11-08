// 08664 冰川石窟（Glacial Grotto）· 大封印组地点
// 卡面：强制 - 揭示后把休眠 [seal_a] 放到此处。[action]：检定 [combat] (2) 击碎冰层；
// 成功则此地点的调查员可以团队花费 1×人数线索，令你取得封印控制权。
export default {
  code: '08664',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessSeal:A', actions: 1,
        label: '🧊 冰川石窟：检定 combat(2) 击碎冰层，团队花费线索取得 seal_a' })
    },
  },
  flags: { sealRecover: 'A', recoverSkill: 'combat', recoverDifficulty: 2 },
}
