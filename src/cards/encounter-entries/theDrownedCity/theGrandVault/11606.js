// 11606 秘库随从 · 敌人 ×3（猎手；生成：与猎物交战；猎物：线索最多者；
//       以其猎手关键词移动时，所在地点视为与每处已激活地点相连）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 读点：behavior.spawnLocation（生成落点 = 猎物所在地点）+ behavior.enemySpawned（与猎物交战）+
//       behavior.enemyConnections（敌人侧连接钩子：猎手寻路时返回全部已激活地点，turn.js/movement.js 均读）。
export default {
  code: '11606',
  scope: 'enemy',
  implemented: true,
  flags: {"hunter":true,"prey":"mostClues","vaultHunterAdjacent":true},
  note: "生成落点与「生成 - 与猎物交战」在 behavior.spawnLocation / enemySpawned；猎手移动「视为与每处已激活地点相连」由 behavior.enemyConnections 钩子按敌人卡号声明。",
  abilities: [],
}
