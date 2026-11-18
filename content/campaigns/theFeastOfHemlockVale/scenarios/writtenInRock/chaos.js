// 岩间密语（writtenInRock · 10501/10502）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/WrittenInRock.hs#HasChaosTokenValue +
//       frontend/src/locales/en/theFeastOfHemlockVale/writtenInRock.json#act1/act2.tokens +
//       input.chaosSymbols（四档难度符号文本）。
//   简单/普通（幕 1 面）
//     [skull]     : -X。X = 你所在地点的列号。
//     [cultist]   : -1。在剧本参考卡上放 1 个资源，作为「碎片」。
//     [tablet]    : -2。若你检定失败，从参考卡上移除 1 个碎片。
//     [elderthing]: -3。若你检定失败，承受 1 点伤害。
//   简单/普通（幕 2 面）
//     [skull]     : -X。X = 列号。
//     [cultist]   : -2。放 1 个资源，作为「道岔」。
//     [tablet]    : -3。若你检定失败，移动矿车一次。
//     [elderthing]: -4。若你检定失败，移除 1 个道岔。
//   困难/专家（幕 1 面）
//     [skull]     : -X。X = 列号 ×2。
//     [cultist]   : -3。若你检定成功，放 1 个资源，作为「碎片」。
//     [tablet]    : -4。移除 1 个碎片。
//     [elderthing]: -5。承受 1 点伤害。
//   困难/专家（幕 2 面）
//     [skull]     : -X。X = 列号 ×2。
//     [cultist]   : -3。若你检定成功，放 1 个资源，作为「道岔」。
//     [tablet]    : -4。移动矿车一次。
//     [elderthing]: -5。移除 1 个道岔。
//
// 引擎契约：`behavior.resolveChaosToken` 返回 `{ delta, onDraw, onFail }`；`onDraw`/`onFail` 的
// `{type:'scenarioToken', token, mode}` 由 skill-effects.js#applyTokenFx 回派到
// `behavior.applyTokenEffect`。动态 skull 值只能在这里算（引擎在揭示标记当下把 state 交进来）。
//
// 近似（见 simplified 披露）：
//   · 困难/专家的 [cultist]「若检定成功才放碎片/道岔」没有独立的成功回调；onDraw 在检定结果
//     之前结算，因此本实现按揭示即放（mode:'success' 仅作标记，behavior 无法延迟到成功）。
//   · [skull] 的列号读剧本网格 `mechanicState.grid[location].x`；地点不在网格上时按 0 算。

import { mechanicState } from '../../../../../src/engine/mechanic-state.js'

const tokenText = {
  easyStandard: {
    act1: {
      skull: '-X。X 为你所在地点的列号。',
      cultist: '-1。在剧本参考卡上放 1 个资源，作为「碎片」。',
      tablet: '-2。若你检定失败，从参考卡上移除 1 个碎片。',
      elderthing: '-3。若你检定失败，承受 1 点伤害。',
    },
    act2: {
      skull: '-X。X 为你所在地点的列号。',
      cultist: '-2。在剧本参考卡上放 1 个资源，作为「道岔」。',
      tablet: '-3。若你检定失败，移动矿车一次。',
      elderthing: '-4。若你检定失败，移除 1 个道岔。',
    },
  },
  hardExpert: {
    act1: {
      skull: '-X。X 为你所在地点的列号的两倍。',
      cultist: '-3。若你检定成功，在剧本参考卡上放 1 个资源，作为「碎片」。',
      tablet: '-4。从参考卡上移除 1 个碎片。',
      elderthing: '-5。承受 1 点伤害。',
    },
    act2: {
      skull: '-X。X 为你所在地点的列号的两倍。',
      cultist: '-3。若你检定成功，在剧本参考卡上放 1 个资源，作为「道岔」。',
      tablet: '-4。移动矿车一次。',
      elderthing: '-5。移除 1 个道岔。',
    },
  },
}

// AI / 前端展示用的同源表（scenario.tokenMeanings 从这里取）。
export const WRITTEN_IN_ROCK_TOKEN_MEANINGS = Object.freeze(Object.fromEntries(
  ['easy', 'standard', 'hard', 'expert'].map(difficulty => {
    const hard = difficulty === 'hard' || difficulty === 'expert'
    const table = hard ? tokenText.hardExpert : tokenText.easyStandard
    return [difficulty, Object.freeze({
      skull: Object.freeze({ text: `${table.act1.skull}（幕 2 同）`, delta: 0, dynamic: 'column', hard }),
      cultist: Object.freeze({ text: table.act1.cultist, delta: hard ? -3 : -1, rider: hard ? 'success' : 'always', act: 1 }),
      tablet: Object.freeze({ text: table.act1.tablet, delta: hard ? -4 : -2, rider: hard ? 'always' : 'fail', act: 1 }),
      elderthing: Object.freeze({ text: table.act1.elderthing, delta: hard ? -5 : -3, rider: hard ? 'always' : 'fail', act: 1 }),
    })]
  }),
))

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1

/** 当前幕号：1 或 2（牌库尚未建立时按 1 算）。 */
export function currentActStep(state) {
  const acts = Array.isArray(state?.acts) ? state.acts : []
  const index = Number.isInteger(state?.actIndex) ? state.actIndex : 0
  const act = acts[index]
  if (!act) return 1
  const parsed = /^(\d+)/.exec(String(act.stage || ''))
  if (parsed) return Number(parsed[1])
  const code = String(act.originalCode || act.code || '')
  return code === '10506' ? 2 : 1
}

/** 地点所在列（剧本网格 x）；不在网格上按 0。 */
export function columnOf(state, locationId) {
  if (!locationId) return 0
  const cell = mechanicState(state)?.grid?.[locationId]
  if (cell && Number.isFinite(Number(cell.x))) return Math.max(0, Number(cell.x))
  const location = (state?.locations || []).find(item => item.id === locationId)
  if (location?.grid && Number.isFinite(Number(location.grid.x))) return Math.max(0, Number(location.grid.x))
  return 0
}

/** 标记放的是「碎片」（幕 1）还是「道岔」（幕 2）。 */
export const markerKindForAct = step => (Number(step) === 2 ? 'switch' : 'scrap')

/** 逐标记取值：引擎 resolveChaosToken 契约的 `{ delta, onDraw, onFail }`。 */
export function writtenInRockChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  const step = currentActStep(state)
  const act2 = step === 2
  const x = columnOf(state, inv?.location)
  const marker = markerKindForAct(step)
  switch (String(token || '')) {
    case 'skull':
      return { delta: -(x * (hard ? 2 : 1)), onDraw: [], onFail: [] }
    case 'cultist':
      return hard
        // 近似：没有成功回调，onDraw 即放（mode:'success' 仅标记印刷条件）。
        ? { delta: -3, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'success', marker }], onFail: [] }
        : { delta: act2 ? -2 : -1, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'always', marker }], onFail: [] }
    case 'tablet':
      return hard
        ? { delta: -4, onDraw: [{ type: 'scenarioToken', token: 'tablet', mode: 'hard', marker }], onFail: [] }
        : { delta: act2 ? -3 : -2, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'fail', marker }] }
    case 'elderthing':
      return hard
        ? { delta: -5, onDraw: [{ type: 'scenarioToken', token: 'elderthing', mode: 'hard', marker }], onFail: [] }
        : { delta: act2 ? -4 : -3, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'fail', marker }] }
    default:
      return null
  }
}

/** 兼容测试/展示读点：只要签名修正值。 */
export function writtenInRockChaosTokenValue(state, tokenFace, inv) {
  return writtenInRockChaosToken(state, inv, tokenFace)?.delta ?? null
}

/** 供 AI 估算：当前难度/幕下的净结果。 */
export function writtenInRockChaosTokenSummary(state, inv, token) {
  const fx = writtenInRockChaosToken(state, inv, token)
  if (!fx) return null
  return { ...fx, hard: isHardSide(state), act: currentActStep(state), investigators: investigatorCount(state) }
}
