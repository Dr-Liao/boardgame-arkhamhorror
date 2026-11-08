// 08667 脓液隧道（Ichor-Laden Tunnels）· 大封印组地点
// 卡面：强制 - 揭示后把休眠 [seal_d] 放到此处。[action]：检定 [agility] (2) 穿过脓液；
// 成功则团队花费 1×人数线索，令你取得封印控制权。
export default {
  code: '08667',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessSeal:D', actions: 1,
        label: '🫧 脓液隧道：检定 agility(2) 穿过脓液，团队花费线索取得 seal_d' })
    },
  },
  flags: { sealRecover: 'D', recoverSkill: 'agility', recoverDifficulty: 2 },
}
