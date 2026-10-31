// 06211 幕 II「月上探索」（Exploring the Moon）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面（正面）：目标 - 只有位于月蜥神庙的调查员可以共同花费所需
// 数量的线索以推进（每人 1 个线索）。
// 背面「穿越核心」（Through the Center）：将放在一边的「月下洞穴（暗面）」与「黑暗月核」地点放置入场。
// 将放在一边的月蜥以横置状态生成在黑暗月核。将遭遇弃牌堆洗入遭遇牌库。
//
// 依据 Haskell Act/Cards/.../ExploringTheMoon.hs：
//   · 背面是单卡内可完成的顺序（取一边地点 → 进场 → 生成并横置 → 洗回），全部走 api；
//   · 地点 id 从 definition 的 locations 里按原卡号查找（不写卡号分支，数据来自 state.scenario.locations）。
const CAVERNS_DARK = '06219'
const BLACK_CORE = '06220'
const MOON_LIZARD = '06226'

const locationByCode = (state, code) => Object.values(state.scenario?.locations || {})
  .find(location => String(location.originalCode || location.code) === code) || null

export default {
  code: '06211',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { kind: 'groupClues', perInvestigator: 1, atLocationCode: '06217' },
    onReveal(state, act, api) {
      const caverns = locationByCode(state, CAVERNS_DARK)
      const core = locationByCode(state, BLACK_CORE)
      for (const definition of [caverns, core]) {
        if (!definition) continue
        api.takeFromSetAside?.(String(definition.originalCode || definition.code))
        api.place?.(definition.id)
      }
      api.info?.('🌑 「穿越核心」：「月下洞穴（暗面）」与「黑暗月核」放置入场。')
      if (core) {
        const enemy = api.spawn?.(MOON_LIZARD, core.id)
        if (enemy) {
          api.exhaustEnemy?.(enemy)
          api.info?.('🦎 月蜥以横置状态生成在「黑暗月核」。')
        } else {
          api.info?.('🦎 月蜥生成失败（可能不在场外或地点缺失）。')
        }
      }
      api.shuffleDiscard?.()
      api.info?.('🔄 遭遇弃牌堆洗入遭遇牌库。')
      return true
    },
  },
}
