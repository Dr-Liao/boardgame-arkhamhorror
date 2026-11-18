// 10552 荒芜（版本二）· 议程（寂静荒野 2/2，第 2/3 日与夜）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：每个[[昆虫]]敌人失去冷漠和巡逻，并获得猎手。
//       强制 - 在毁灭标记放置到本密谋时，如果族群虫后敌人放在一边：从混乱袋中揭示标记，
//       数量等于胜利区中[[昆虫]]敌人的数量。如果揭示了有符号的标记，生成放在一边的族群虫后。
// 读点：behavior.syncInsectKeywords 读 insectsLoseAloof / insectsGainHunter；
//       behavior.doomPlaced 读 spawnBroodQueenOnDoom。
// approximation：引擎没有「关键词禁用」读点（enemyHasHunter 读实例 hunter；巡逻读条目静态
//   patrolTarget），所以「失去巡逻」无法禁用 Brood Soldier 的巡逻移动；其余两项已接线。
export default {
  code: '10552',
  scope: 'agenda',
  implemented: true,
  flags: { insectsLoseAloof: true, insectsLosePatrol: true, insectsGainHunter: true, spawnBroodQueenOnDoom: 'symbol' },
  note: 'approximation：「失去巡逻」缺引擎读点（巡逻目标来自条目静态 enemyRule.patrolTarget），'
    + '当前只在 v.II 期间给[[昆虫]]敌人加 hunter，巡逻仍按静态目标移动。',
  abilities: [],
}
