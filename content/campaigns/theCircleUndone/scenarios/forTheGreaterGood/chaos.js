// 05197《崇高利益》混乱标记表。
//
// 参考实现 `HasChaosTokenValue ForTheGreaterGood`（Scenario/Scenarios/TheCircleUndone/ForTheGreaterGood.hs:50-63）：
//   skull  -X：简单/普通取「场上异教徒敌人中单卡最多毁灭」，困难/专家取「所有异教徒敌人毁灭总和」
//   cultist -2，再揭示一个标记
//   tablet  -3
//   elderthing -3
// 失败后的额外效果（tablet 放毁灭 / elderthing 移毁灭到议程）在 behavior.afterTest 结算，
// 因为 resolveChaosToken 只消费 delta/autoFail/drawAnother/onDraw/onFail。
import { hasTrait } from '../../encounter-rules.js'

export const cultistEnemies = state => (state.enemies || []).filter(enemy => hasTrait(enemy, 'Cultist'))

export function fggChaosToken(state, inv, token, api) {
  const hard = ['hard', 'expert'].includes(state.difficulty)
  if (token === 'skull') {
    const values = cultistEnemies(state).map(enemy => Number(enemy.doom) || 0)
    const doom = values.length ? (hard ? values.reduce((sum, value) => sum + value, 0) : Math.max(...values)) : 0
    return { delta: -doom }
  }
  if (token === 'cultist') return { delta: -2, drawAnother: true }
  if (token === 'tablet') return { delta: -3 }
  if (token === 'elderthing') return { delta: -3 }
  return null
}

export default fggChaosToken
