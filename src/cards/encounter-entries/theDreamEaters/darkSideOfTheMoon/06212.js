// 06212 幕 III「月之核心」（The Moon's Core）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面（正面）：黑暗月核的线索只能通过调查成功来发现，其他方式均不能发现。
// 目标 - 如果每位幸存的调查员都位于黑暗月核，且黑暗月核没有线索，推进。
// 背面「去往另一面」（To the Other Side）：将放在一边的「月下洞穴（亮面）」「月之亮面」「白船」地点放置入场。
//
// 依据 Haskell Act/Cards/.../TheMoonsCore.hs：
//   · 「黑暗月核的线索只能通过成功调查发现」→ actRule.cannotDiscoverCluesExceptInvestigation 数据，
//     behavior.canDiscoverClues 在转发共享层后读；
//   · 背面放 3 张地点 → 单卡顺序，全部走 api（地点 id 按原卡号从 definition 查）。
const CAVERNS_LIGHT = '06221'
const LIGHT_SIDE = '06222'
const WHITE_SHIP = '06223'

const locationByCode = (state, code) => Object.values(state.scenario?.locations || {})
  .find(location => String(location.originalCode || location.code) === code) || null

export default {
  code: '06212',
  scope: 'act',
  implemented: true,
  actRule: {
    // 目标：所有未败退调查员在黑暗月核，且其上没有线索（behavior.checkObjectives 读）。
    objective: { kind: 'allAtLocation', atLocationCode: '06220', requireNoClues: true },
    // 线索发现限制：只能由成功的调查发现（behavior.canDiscoverClues 读）。
    cannotDiscoverCluesExceptInvestigation: { locationCode: '06220' },
    onReveal(state, act, api) {
      const ids = [CAVERNS_LIGHT, LIGHT_SIDE, WHITE_SHIP]
      for (const code of ids) {
        const definition = locationByCode(state, code)
        if (!definition) continue
        api.takeFromSetAside?.(code)
        api.place?.(definition.id)
      }
      api.info?.('🌕 「去往另一面」：「月下洞穴（亮面）」「月之亮面」「白船」放置入场。')
      return true
    },
  },
}
