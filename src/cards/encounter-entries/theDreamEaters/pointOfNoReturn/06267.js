// 06267 · 《无归之地》敌人「古革哨兵」（Gug Sentinel · 战斗 5 / 躲避 3 / 生命 2 / 伤害 2 / 恐惧 1 · 胜利 1）。
// 卡面：Gug Sentinel gets +2 [per_investigator] health.
//   Forced - After Gug Sentinel readies: Deal 1 horror to each investigator at its location.
//
// 实现口径：
//   · 「+2/人 生命」用 enemyRule.healthPerPlayerBonus（card-data.js 会并进 definition，
//     spawnEnemy 读 def.healthPerPlayerBonus 计算生命：src/engine/enemies.js:352）；
//   · 敌人重整时由统一 readyEnemy 入口调用 enemyScript.onReadied。

export default {
  code: '06267',
  scope: 'enemy',
  implemented: true,
  enemyRule: { healthPerPlayerBonus: 2 },
  enemyScript: {
    onReadied(state, enemy, api) {
      const targets = (state.investigators || []).filter(inv =>
        !inv.defeated && !inv.resigned && inv.location === enemy.location)
      for (const inv of targets) api.horror(inv.seat, 1)
      if (targets.length) api.info('👁️ 古革哨兵重整：其所在地点的每位调查员受到 1 点恐惧。')
    },
  },
}
