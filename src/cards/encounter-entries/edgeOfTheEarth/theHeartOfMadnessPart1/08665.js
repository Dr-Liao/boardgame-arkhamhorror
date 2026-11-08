// 08665 雕塑墓室（Sculptured Crypt）· 大封印组地点
// 卡面：强制 - 揭示后把休眠 [seal_b] 放到此处。[action]：检定 [intellect] (2) 解读异星文字；
// 成功则团队花费 1×人数线索，令你取得封印控制权。
export default {
  code: '08665',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessSeal:B', actions: 1,
        label: '📜 雕塑墓室：检定 intellect(2) 解读异星文字，团队花费线索取得 seal_b' })
    },
  },
  flags: { sealRecover: 'B', recoverSkill: 'intellect', recoverDifficulty: 2 },
}
