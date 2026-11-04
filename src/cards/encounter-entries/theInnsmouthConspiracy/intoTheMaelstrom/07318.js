// 07318 深海之城（版本三）（City of the Deep (v. III)）· 幕 2 · 暗潮之下 第八章
//
// 印刷（中文）：
//   目标 - 摧毁容纳深潜者财富的宝库。如果达贡和海德拉上各有至少4[每调查员]伤害，推进。
//
// 印刷（English）：
//   Objective - Collapse the vault containing the Deep Ones' riches. If Dagon and Hydra each
//               have at least 4 [per_investigator] damage on them, advance.
//
// 印刷（背面，三张「深海之城」同文）：
//   将本卡牌加入胜利区。
//   - 如果场上有另一张场景卡牌，你可以选择继续游戏，以完成该场景卡牌上的目标；或者不完成该
//     目标，立即进入(→结局1)。
//   - 如果场上没有其他场景卡牌，进入(→结局1)。
//   胜利2。
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/intoTheMaelstrom/07318.js
//
// 引擎读点：
//   · 入场：内容层 flashback XIV（defyHarper）调 `api.scenario.addParallelAct('07318')`
//     → src/engine/scenario-runtime.js（实例来自 state.scenario.stageCards，进入 state.parallelActs）。
//   · 目标：act-agenda.js#checkAct 末尾的并行幕分派（parallel-acts.js#checkParallelActObjectives）。
//     「伤害」读敌人实例 `enemy.damageTaken`（伤害写入口 enemies.js#damageEnemy；两面
//     07330a/07330b、07331a/07331b 都算，沉睡面 damageTaken 恒 0 不会误判）。
//     「at least 4 [per_investigator]」= 4 × 本局调查员人数（不是 4 + 人数）。
//   · 背面：`api.completeParallelAct(act.id)` 加入胜利区（Victory 2）+ 移出活动槽；
//     `api.resolveActCompletion({ act })` 统一结算继续/R1。三张同文逻辑只在 parallel-acts.js 写一次。
//   · 结局判定复用 content/.../resolutions.js（读 victoryDisplay 的 07316/17/18），无需改。
//
// implemented: true

const DAGON_FACES = ['07330a', '07330b']
const HYDRA_FACES = ['07331a', '07331b']

const codeOf = entity => String(entity?.originalCode || entity?.code || '')
const damagedAtLeast = (state, codes, amount) => (state.enemies || []).some(enemy =>
  !enemy.defeated && !enemy.removedFromGame
  && codes.includes(codeOf(enemy)) && (Number(enemy.damageTaken) || 0) >= amount)

export default {
  code: '07318', scope: 'act', implemented: true,
  actRule: {
    objective(state) {
      const required = 4 * state.numInvestigators
      return damagedAtLeast(state, DAGON_FACES, required) && damagedAtLeast(state, HYDRA_FACES, required)
    },
    onComplete(state, act, api) {
      api.completeParallelAct(act.id)
      api.resolveActCompletion({ act, resolution: 'resolution1' })
    },
  },
}
