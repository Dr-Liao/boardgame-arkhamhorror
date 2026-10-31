// 06075 太平间（Morgue）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：[action]：检定意志(3)。若你成功，在本地发现 1 个线索。若你失败，受到 1 点恐惧。
//   强制 - 太平间的最后 1 个线索被发现后：进行一次蛛群滋生检定。
// 读点：locationRule.actions / performAction 由章节 behavior 分派；
//   「最后线索」由章节 behavior.cluesRemoved 读 entryFlags('06075').infestationTestWhenCluesEmpty 触发滋生检定。
const CODE = '06075'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: {
    infestationTestWhenCluesEmpty: true,
  },
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({
        action: 'scenarioAction',
        rule: 'morgueInvestigateClue',
        actions: 1,
        label: '⚰️ 太平间：[action] 检定意志(3)：成功发现 1 个线索，失败受到 1 点恐惧',
      })
    },
    performAction(state, inv, move, api) {
      if (!move || move.rule !== 'morgueInvestigateClue') return false
      api.test?.(inv.seat, 'willpower', 3, result => {
        if (result.success) {
          api.discoverClue?.(inv.seat, 1, inv.location)
          return
        }
        api.horror?.(inv.seat, 1)
      })
      return true
    },
  },
}
