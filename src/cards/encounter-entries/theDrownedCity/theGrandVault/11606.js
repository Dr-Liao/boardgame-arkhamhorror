// 11606 秘库随从 · 敌人 ×3（猎手；生成：与猎物交战；猎物：线索最多者；猎手移动时所在地点视为与每处已激活地点相连）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 近似：approximation：猎手移动时「视为与每处已激活地点相连」没有敌人侧连接钩子（behavior.enemyConnections 只接了穷途异魔），当前按普通猎手寻路。
export default {
  code: '11606',
  scope: 'enemy',
  implemented: true,
  enemyRule: {"relentless":false},
  flags: {"hunter":true,"prey":"mostClues","vaultHunterAdjacent":true},
  note: "approximation：猎手移动时「视为与每处已激活地点相连」没有敌人侧连接钩子（behavior.enemyConnections 只接了穷途异魔），当前按普通猎手寻路。",
  abilities: [],
}
