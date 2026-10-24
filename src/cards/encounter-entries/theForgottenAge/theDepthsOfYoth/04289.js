// 04289 岌岌可危的悬崖
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
// 卡面：强制 - 在你位于岌岌可危的悬崖并尝试探索时：检定[willpower](4)。如果你检定失败，检定[agility](3)。如果你检定失败，检定[combat](2)。如果你检定失败，你坠入深渊，阵亡。(如果你在以上任一检定中成功，你如常探索。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 94 轮：幽嘶深渊的岌岌可危的悬崖。
//
// 修复（campaign-4/task-19）：
// beforeExplore 只能同步返回，但真实引擎里 api.test 的 resolve 回调要等检定结算后才执行。
// 旧实现同步返回 `!outcome.died`（恒 true）→ 先探索、后检定（阵亡发生在探索之后）。
// 另外引擎的嵌套检定（在一次检定的 resolve 回调里再开下一场）会被 closeTest 覆盖
// （src/engine/tests.js:349-367：resolveResult 回调结束后 `state.skillTest = previousTest`），
// 所以正式的多检定链需要引擎侧支持（已提交 primitive-request：campaign-4-04289.json）。
//
// 本条的过渡实现：
//  * 真实引擎（回调异步，返回时尚未结算）：先返回 false 取消本次探索并退回本次已支付的
//    1 个行动；检定通过后通过 api.explore(seat) 恢复“如常探索”。
//    若本次检定失败，则记录 tfaPrecipiceStage，下一次探索尝试继续下一项检定
//    （卡面的三级链因此需要玩家再次点击探索，但结果/顺序正确、不消耗额外行动）。
//  * 同步 api（单测/假 api：回调在 run 内同步执行）：沿用旧契约——整条链同步跑完，
//    成功返回 true（照常探索），全失败返回 false 并阵亡。

const PRECIPICE_TESTS = [['willpower', 4], ['agility', 3], ['combat', 2]]

export default {
  code: '04289', scope: 'location',
  locationRule: {
    beforeExplore(state, inv, api) {
      // 检定通过后由 api.explore 恢复的同一次探索：跳过检定，直接照常探索。
      if (inv.tfaPrecipiceResuming) {
        delete inv.tfaPrecipiceResuming
        return true
      }
      let returned = false
      const ctx = { settled: false, success: false }
      const stage = Number(inv.tfaPrecipiceStage || 0)

      const fail = index => {
        if (index + 1 < PRECIPICE_TESTS.length) {
          if (returned) {
            inv.tfaPrecipiceStage = index + 1
            ctx.settled = true
            api.info?.(`岌岌可危的悬崖：本项检定失败；再次尝试探索时继续下一项检定。`)
            return
          }
          // 同步 api：直接继续下一场检定。
          run(index + 1)
          return
        }
        delete inv.tfaPrecipiceStage
        ctx.settled = true
        ctx.success = false
        api.info?.(`岌岌可危的悬崖：${inv.name} 三次检定全部失败，坠入深渊身亡。`)
        api.defeat(inv, 'killed')
        const record = state.campaign?.investigators?.[inv.seat]
        if (record) record.status = 'killed'
      }

      const succeed = () => {
        delete inv.tfaPrecipiceStage
        ctx.settled = true
        ctx.success = true
        if (!returned) return // 同步 api：由 beforeExplore 返回 true 让引擎照常探索
        // 异步 api：检定已通过，恢复“如常探索”。
        inv.tfaPrecipiceResuming = true
        if (typeof api.explore === 'function') {
          api.explore(inv.seat)
        } else {
          delete inv.tfaPrecipiceResuming
          api.info?.('岌岌可危的悬崖：检定通过，请再次执行探索行动。')
        }
      }

      const run = index => {
        api.test(inv.seat, PRECIPICE_TESTS[index][0], PRECIPICE_TESTS[index][1], result => {
          if (result.success) succeed()
          else fail(index)
        }, 0, { label: '岌岌可危的悬崖', ability: true })
      }

      run(stage)
      returned = true
      if (ctx.settled) return ctx.success === true && !inv.defeated
      // 真实引擎：本次探索先取消，检定结算后再恢复探索/记录下一项检定。
      // doExplore 在本钩子之前已扣掉本次探索的 1 个行动，这里退回，
      // 恢复探索时再由 api.explore 正常支付，保证净消耗仍是 1 个行动。
      inv.actionsLeft = (inv.actionsLeft || 0) + 1
      api.info?.('岌岌可危的悬崖：先进行检定，通过后继续探索。')
      return false
    },
  },
}
