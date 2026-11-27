// 10552 荒芜（版本二）· 议程（寂静荒野 2/2，第 2/3 日与夜）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：每个[[昆虫]]敌人失去冷漠和巡逻，并获得猎手。
//       强制 - 在毁灭标记放置到本密谋时，如果族群虫后敌人放在一边：从混乱袋中揭示标记，
//       数量等于胜利区中[[昆虫]]敌人的数量。如果揭示了有符号的标记，生成放在一边的族群虫后。
// 读点：behavior.syncInsectKeywords 读 insectsLoseAloof / insectsGainHunter；
//       behavior.patrolTarget 读 insectsLosePatrol；behavior.doomPlaced 读 spawnBroodQueenOnDoom。
export default {
  code: '10552',
  scope: 'agenda',
  implemented: true,
  flags: { insectsLoseAloof: true, insectsLosePatrol: true, insectsGainHunter: true, spawnBroodQueenOnDoom: 'symbol' },
  abilities: []
}
