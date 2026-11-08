// 08666 地底祭坛（Undercity Altar）· 大封印组地点
// 卡面：强制 - 揭示后把休眠 [seal_c] 放到此处。[action]：检定 [willpower] (2) 打破远古结界；
// 成功则团队花费 1×人数线索，令你取得封印控制权。
export default {
  code: '08666',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessSeal:C', actions: 1,
        label: '🕯️ 地底祭坛：检定 willpower(2) 打破结界，团队花费线索取得 seal_c' })
    },
  },
  flags: { sealRecover: 'C', recoverSkill: 'willpower', recoverDifficulty: 2 },
}
