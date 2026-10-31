// 06229 敌人「月兽」（Moon-Beast · [[怪物]]·[[仆从]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：反击。
// 强制 - 月兽入场后：每位调查员的警报等级提高 1 级。
// 强制 - 你击败月兽后：每位调查员的警报等级下降 1 级。
//
// 依据 Haskell Enemy/Cards/.../MoonBeast.hs（EnemySpawns #after → raiseAlarmLevel getInvestigators；
// EnemyDefeated #after You → eachInvestigator reduceAlarmLevel）：
//   · 反击由 definition 的印刷数据提供；
//   · 入场强制 → enemyScript.onSpawn（共享层 enemySpawned 派发）；
//   · 击败强制 → enemyScript.onDefeated（返回 false = 不接管引擎默认的胜利区/弃牌堆处理）。
const ALARM = 'alarmLevel'
const MOON_BEAST = '06229'

const eachInvestigator = (state, fn) => {
  for (const inv of state.investigators || []) fn(inv)
}

export default {
  code: MOON_BEAST,
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    onSpawn(state, enemy, api) {
      if (String(enemy?.originalCode || enemy?.code) !== MOON_BEAST) return
      eachInvestigator(state, inv => api.counters.add(inv.seat, ALARM, 1))
      api.info?.('🦑 月兽入场：每位调查员的警报等级 +1。')
    },
    onDefeated(state, enemy, api) {
      if (String(enemy?.originalCode || enemy?.code) !== MOON_BEAST) return false
      eachInvestigator(state, inv => api.counters.add(inv.seat, ALARM, -1))
      api.info?.('🦑 月兽被击败：每位调查员的警报等级 -1。')
      return false
    },
  },
}
