// 10055 绝密手段（Esoteric Method）· 探求者技能 · 1 经验 · 实践/诅咒。
//
// 卡面：本次技能检定结束后，执行检定的调查员检定成功且每超过难度 1 点，或者检定失败且每低于难度 1 点，
//       就在混乱袋中加入 1 个[curse]标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 印刷图标 4 个[wild] 来自 cards-data（技能卡的图标由 stats.js#iconValue 读同一份数据）。
//   · 「本次技能检定结束后」→ commit 描述子的 `skill.afterTest`（tests.js#closeTest 在结果落定后、
//     投入卡进弃牌堆之前逐个调用；ctx 带 { state, inv, source, result, test, api }，
//     与 06111/06235/06325 同一读点）。
//   · 差值 → result.summary 的 successBy / failedBy（test-result.js#summarizeTestResult 的标准结果契约）；
//     没有 summary 时回退 result.value - result.difficulty，二者口径一致。
//   · 加入[curse] → api.chaosTokens.add（chaos-token-pool.js 的唯一写点；袋上限 10 个，超出部分自然不加）。
const CODE = '10055'
const CURSE = 'curse'

function marginOf(result) {
  if (!result) return 0
  const summary = result.summary
  if (summary) {
    return summary.success ? Math.max(0, Number(summary.successBy) || 0)
      : Math.max(0, Number(summary.failedBy) || 0)
  }
  const value = Number(result.value) || 0
  const difficulty = Number(result.difficulty) || 0
  return result.success ? Math.max(0, value - difficulty) : Math.max(0, difficulty - value)
}

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '绝密手段：本次检定结束后按成功/失败差值在混乱袋加入[curse]',
      skill: {
        afterTest: ({ inv, result, api }) => {
          const margin = marginOf(result)
          if (!margin) return
          const added = api.chaosTokens.add(CURSE, margin)
          api.info(`🕯️ 「绝密手段」：${inv.name} 在混乱袋加入 ${added} 个诅咒标记（差值 ${margin}）。`)
        },
      },
    },
  ],
  modifiers: [],
}
