// 01180 黑山羊眷族（Goat Spawn）
// 归属：关卡专用 · theWitchingHour（P8 w-witch；核心包 agents_of_shub 卡在本章 set aside 后由 act1 生成）。
// 卡面：猎手、反击；强制 - 被击败时本地点的每位调查员受到 1 点恐惧。数值由 definition 印刷数据提供；
// 被击败强制在条目 enemyScript.onDefeated（共享 encounterRules.enemyDefeated 统一派发）。
export default {
  code: '01180',
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    onDefeated(state, enemy, api) {
      for (const inv of state.investigators.filter(entry =>
        !entry.defeated && !entry.resigned && entry.location === enemy.location)) {
        api.horror?.(inv.seat, 1)
      }
      api.info?.('🐐 「黑山羊眷族」被击败：本地点的每位调查员受到 1 点恐惧。')
      return false
    },
  },
}
