// 07317 深海之城（版本二）（City of the Deep (v. II)）· 幕 2 · 暗潮之下 第八章
//
// 印刷（中文）：
//   目标 - 重获深潜者的宝藏。如果达贡巢穴、海德拉巢穴和放置了紫色钥匙的财富宝库上都没有
//          线索，推进。
//
// 印刷（English）：
//   Objective - Recover the riches of the Deep Ones. If the Lair of Dagon, the Lair of Hydra,
//               and the Vault of Riches with the purple key have no clues on them, advance.
//
// 印刷（背面，三张「深海之城」同文）：
//   将本卡牌加入胜利区。
//   - 如果场上有另一张场景卡牌，你可以选择继续游戏，以完成该场景卡牌上的目标；或者不完成该
//     目标，立即进入(→结局1)。
//   - 如果场上没有其他场景卡牌，进入(→结局1)。
//   胜利2。
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/intoTheMaelstrom/07317.js
//
// 引擎读点：
//   · 入场：内容层 flashback XIV（helpHarper）调 `api.scenario.addParallelAct('07317')`
//     → src/engine/scenario-runtime.js（实例来自 state.scenario.stageCards，进入 state.parallelActs）。
//   · 目标：act-agenda.js#checkAct 末尾的并行幕分派（parallel-acts.js#checkParallelActObjectives）
//     遍历 `api.parallelActs()`，条目 `actRule.objective(state, act, api) === true` 时调
//     `actRule.onComplete`。纯读；只有目标命中才写。
//   · 「地点有没有线索」读 location.clues（setup 后由 syncClues/投资行动维护，见 locations.js）；
//     「财富宝库 with the purple key」读 scenario-keys.js#keysAt（`_shared.js` 再导出）：
//     紫色钥匙的 holder 必须是 `location:<宝库 id>`；钥匙被拿走则目标不满足（与印刷一致）。
//   · 背面：`api.completeParallelAct(act.id)` 把本卡加入胜利区（Victory 2）并从活动幕槽移除；
//     `api.resolveActCompletion({ act })` 统一结算「仍有另一张场景卡 → 队长选择继续/立即 R1；
//     没有 → 立即 R1」。三张同文逻辑只在 parallel-acts.js 写一次。
//   · 结局判定复用 content/.../resolutions.js（读 victoryDisplay 的 07316/17/18），无需改。
//
// implemented: true

import { keysAt, originalOf } from '../../_shared.js'

const LAIR_OF_DAGON = '07328'
const LAIR_OF_HYDRA = '07329'
const VAULT_OF_RICHES = '07322'
const PURPLE_KEY = 'purple'

const locationByCode = (state, code) => (state.locations || []).find(location => String(originalOf(location)) === code) || null

export default {
  code: '07317', scope: 'act', implemented: true,
  actRule: {
    objective(state) {
      const lairOfDagon = locationByCode(state, LAIR_OF_DAGON)
      const lairOfHydra = locationByCode(state, LAIR_OF_HYDRA)
      const vault = locationByCode(state, VAULT_OF_RICHES)
      // 缺任一地点就不虚构目标达成（地点被移出游戏/尚未入场 → false）。
      if (!lairOfDagon || !lairOfHydra || !vault) return false
      if ((lairOfDagon.clues || 0) > 0) return false
      if ((lairOfHydra.clues || 0) > 0) return false
      if ((vault.clues || 0) > 0) return false
      return keysAt(state, `location:${vault.id}`, { reveal: true }).includes(PURPLE_KEY)
    },
    onComplete(state, act, api) {
      api.completeParallelAct(act.id)
      api.resolveActCompletion({ act, resolution: 'resolution1' })
    },
  },
}
