// 清醒噩梦（Waking Nightmare · 06063）· 混乱标记取值与后果（参考 WakingNightmare.hs:39-58, 201-240）。
//
// 口径：`behavior.resolveChaosToken` 只负责**标记数值**；失败/揭示后的强制放在 `behavior.afterTest`
// （引擎会自动失败与正常路径各调一次，behavior 必须幂等）。A 线袋没有 ElderThing、B 线袋没有 Tablet：
// 本章只写 B 线用到的 skull / cultist / elderthing。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { byDifficulty, chaosFx, hardSide } from '../../tde-chaos.js'

const original = card => card?.originalCode || card?.code || card
const traitsOf = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
  .map(trait => String(trait).toLowerCase())
const isStaffEnemy = card => traitsOf(card).includes('staff')

// 卡面（cards-data 06063）的符号表原文：tokenMeanings 放在 scenario 对象上（引擎读 state.scenario.tokenMeanings）。
export const WAKING_NIGHTMARE_TOKEN_MEANINGS = Object.freeze({
  standard: {
    skull: { text: '-1 (-3 instead if you are engaged with a _Staff_ enemy).', delta: 0 },
    cultist: {
      text: 'Reveal another chaos token. If you fail and it is agenda 2 or 3, make an infestation test.',
      delta: 0,
      drawAnother: true,
    },
    elderthing: { text: '-X. X is the number of infested locations.', delta: 0 },
  },
  hard: {
    skull: { text: '-2 (-4 instead if you are engaged with a _Staff_ enemy).', delta: 0 },
    cultist: {
      text: 'Reveal another chaos token. If it is agenda 2 or 3, make an infestation test.',
      delta: 0,
      drawAnother: true,
    },
    elderthing: { text: '-X. X is 1 higher than the number of infested locations.', delta: 0 },
  },
})

/**
 * 符号数值。参考 WakingNightmare.hs:39-58：
 *   skull = -1/-2；与[[Staff]]敌人交战时改为 -3/-4；
 *   cultist = 无修正 + 再揭示 1 个标记（`drawAnother`）；
 *   elderthing = -（寄生地点数），困难/专家再 -1。
 * 返回 `null` 表示交回引擎默认表。
 */
export function wakingNightmareChaosToken(state, inv, token) {
  if (token === 'skull') {
    const engagedStaff = (state?.enemies || []).some(enemy =>
      enemy.engagedSeat != null && Number(enemy.engagedSeat) === Number(inv?.seat) && isStaffEnemy(enemy))
    return chaosFx(engagedStaff ? byDifficulty(state, -3, -4) : byDifficulty(state, -1, -2))
  }
  if (token === 'elderthing') {
    const infested = (state?.infestedLocations || []).length
    return chaosFx(-(hardSide(state) ? infested + 1 : infested))
  }
  if (token === 'cultist') return chaosFx(0, { drawAnother: true })
  return null
}

/**
 * 检定后的 [cultist] 后果：是否需要补一次「蛛群滋生检定」。
 * 简单/普通：失败且当前为议程 2 或 3；困难/专家：只要当前为议程 2 或 3（参考实现 ResolveChaosToken 分支）。
 * 返回布尔值，由章节 behavior.afterTest 真正执行滋生检定（行为层持有滋生袋机械，chaos.js 不反向依赖它）。
 */
export function wakingNightmareChaosAfterTest(state, inv, result) {
  if (!inv || !result) return false
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  if (!tokens.includes('cultist')) return false
  const agendaStep = (Number(state?.agendaIndex) || 0) + 1
  if (agendaStep < 2) return false
  return hardSide(state) || !result.success
}
