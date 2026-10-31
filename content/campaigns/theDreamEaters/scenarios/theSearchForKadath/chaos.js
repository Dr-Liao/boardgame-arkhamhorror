// 寻觅卡达斯（The Search for Kadath · 06119）· 混乱标记取值与失败后果（P8）。
//
// 来源：en locale `scenarios/theSearchForKadath.json` 的 `tokens`（Easy/Standard 与 Hard/Expert）。
//   [skull]     -X（X = 调查员已发现的神迹数；困难/专家 X = 1 + 神迹数）
//   [cultist]   再揭示一个标记；若调查期间揭示且本次检定失败，该地点隐藏值 +1/+2 直到本轮结束
//   [tablet]    -2/-3；失败时：受到 1 伤害 + 1 恐惧，或在当前密谋上放 1 毁灭
//   [elder_thing] +2/+1；若调查期间揭示且成功，发现 1 个额外线索
//
// 只在这里维护本章的标记表；`behavior.resolveChaosToken` 负责数值，
// `behavior.afterTest` 负责「再揭示 / 失败 / 成功」的后果（引擎会在自动失败与正常路径各调一次，按 result 幂等）。
export const hardSide = state => ['hard', 'expert'].includes(state?.difficulty)

// 剧本参考卡计数（神迹）读点：api.markers 可用时读 api，否则读 state 里的同口径字段（测试 stub）。
export function signsOfTheGods(state, api = null) {
  if (api?.markers?.get) return Number(api.markers.get('reference')) || 0
  const value = state?.markerCounts?.reference
  return Number.isInteger(value) && value > 0 ? value : 0
}

export function searchForKadathChaosToken(state, inv, token, api = null) {
  const hard = hardSide(state)
  if (token === 'skull') return { delta: -(signsOfTheGods(state, api) + (hard ? 1 : 0)) }
  if (token === 'cultist') return { delta: 0, drawAnother: true }
  if (token === 'tablet') return { delta: hard ? -3 : -2 }
  if (token === 'elderthing') return { delta: hard ? 1 : 2 }
  return null
}

// 供引擎 AI/战斗概率与前端展示读取的 tokenMeanings；X 类标记声明为动态计数。
const standard = {
  skull: { kind: 'count', base: 0, count: 'signsOfTheGods', text: '-X。X 为调查员已发现的神迹数量。' },
  cultist: { text: '再揭示一个标记；若调查期间揭示且本次检定失败，该地点隐藏值 +1 直到本轮结束。', delta: 0, drawAnother: true },
  tablet: { text: '-2。若检定失败：受到 1 伤害 + 1 恐惧，或在当前密谋上放 1 毁灭。', delta: -2 },
  elderthing: { text: '+2。若调查期间揭示且成功，发现 1 个额外线索。', delta: 2 },
}
const hard = {
  skull: { kind: 'count', base: 1, count: 'signsOfTheGods', text: '-X。X 为 1 + 调查员已发现的神迹数量。' },
  cultist: { text: '再揭示一个标记；若调查期间揭示且本次检定失败，该地点隐藏值 +2 直到本轮结束。', delta: 0, drawAnother: true },
  tablet: { text: '-3。若检定失败：受到 1 伤害 + 1 恐惧，或在当前密谋上放 1 毁灭。', delta: -3 },
  elderthing: { text: '+1。若调查期间揭示且成功，发现 1 个额外线索。', delta: 1 },
}

export const THE_SEARCH_FOR_KADATH_TOKEN_MEANINGS = Object.freeze({
  easy: standard,
  standard,
  hard,
  expert: hard,
})
