// 万象无终 · 序章《暮色庄园失踪事件》· 章节混乱标记函数。
//
// 参考实现 DisappearanceAtTheTwilightEstate.hs 的 `HasChaosTokenValue`：
//   Skull -> toChaosTokenValue attrs Skull 3 5   —— 简单/普通 -3，困难/专家 -5；
//   后半句「如果你失败且本次检定为攻击或躲避尝试，结算你所在地点的所有闹鬼能力」
//   在 behavior.afterTest 里结算（不是标记值本身，不能塞进 resolveChaosToken 的返回值）。
//
// 本文件只做「标记 → 数值」的纯函数；随机/状态写入不在这里。供 behavior.resolveChaosToken 调用，
// 也供战役级 tcu-chaos.js 汇总时复用（只读 import）。

export const PROLOGUE_SCENARIO_ID = 'disappearanceAtTheTwilightEstate'

export const PROLOGUE_CHAOS_SCENARIOS = Object.freeze([PROLOGUE_SCENARIO_ID])

// 简单/普通与困难/专家两档。`state.difficulty` 由引擎会话给出（'easy'|'standard'|'hard'|'expert'）。
export function prologueSkullValue(state) {
  return ['hard', 'expert'].includes(state?.difficulty) ? -5 : -3
}

// 返回 resolveChaosToken 的约定形状（只含 delta；onDraw/onFail 由 afterTest 结算）。
// 非骷髅标记返回 null（交回共享 encounterRules / 引擎默认值）。
export function prologueChaosToken(state, inv, token, api) {
  void inv; void api
  if (token !== 'skull') return null
  return { delta: prologueSkullValue(state) }
}
