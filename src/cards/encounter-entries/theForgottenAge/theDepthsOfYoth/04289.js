// 04289 岌岌可危的悬崖
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
// 卡面：强制 - 在你位于岌岌可危的悬崖并尝试探索时：检定[willpower](4)。如果你检定失败，检定[agility](3)。如果你检定失败，检定[combat](2)。如果你检定失败，你坠入深渊，阵亡。(如果你在以上任一检定中成功，你如常探索。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// P2-6（2026-10-28）：引擎支持「检定链后继续同一次探索」：
//   · `beforeExplore` 启动检定链并返回 false（本次探索先暂停，行动已在引擎里支付）；
//   · 任一检定成功后，在检定回调里调用 `api.resumeExplore(seat)` —— 引擎回到同一次
//     探索流程（不重复扣行动、不重复跑 beforeExplore），继续放置/移动；
//   · 全部失败：`api.defeat(inv, 'killed')`（引擎统一写阵亡与战役记录状态）。
// 因此条目不再需要 `inv.tfaPrecipiceResuming` / `inv.tfaPrecipiceStage` 两个过渡字段，
// 也不再手动回退行动点。浏览器/真实引擎里检定回调是异步的，但都在同一个规则事务内结算，
// 嵌套检定由引擎的混乱袋帧栈（chaos.frames）与 local `previousTest` 自动恢复。

const PRECIPICE_TESTS = [['willpower', 4], ['agility', 3], ['combat', 2]]

export default {
  code: '04289', scope: 'location',
  locationRule: {
    beforeExplore(state, inv, api) {
      const run = index => {
        api.test(inv.seat, PRECIPICE_TESTS[index][0], PRECIPICE_TESTS[index][1], result => {
          // 任一检定成功 → 如常完成同一次探索。
          if (result.success) {
            api.resumeExplore(inv.seat)
            return
          }
          if (index + 1 < PRECIPICE_TESTS.length) {
            run(index + 1)
            return
          }
          api.info?.(`岌岌可危的悬崖：${inv.name} 三次检定全部失败，坠入深渊身亡。`)
          api.defeat(inv, 'killed')
        }, 0, { label: '岌岌可危的悬崖', ability: true })
      }
      run(0)
      // 检定链在回调里结束时，通过 api.resumeExplore 继续同一次探索（见文件头注释）。
      return false
    },
  },
}
