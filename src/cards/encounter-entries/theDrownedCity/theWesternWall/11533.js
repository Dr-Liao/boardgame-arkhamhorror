// 11533 深潜者主母 · 敌人（西墙，遭遇牌库）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：猎手。
//       生成 - 任意已揭示地点（尽可能为淹没棚屋）。
//       强制 - 深潜者主母进场时：查找遭遇牌库和遭遇弃牌堆，找出一名[[深潜者]]敌人，
//       将其生成在本地点。
// 印刷：战斗 3 / 躲避 3 / 生命 6 / 伤害 0 / 恐惧 1 / 特性 [[Humanoid]][[Monster]][[Deep One]] / 胜利 1。
// 读点：猎手由 definition 解析卡文；behavior.spawnLocation 读 flags.spawnPreferLocation；
//       behavior.enemySpawned 读 flags.searchDeepOneOnEnter。
export default {
  code: '11533',
  scope: 'enemy',
  implemented: true,
  flags: { searchDeepOneOnEnter: true, hunter: true },
  note: '数据型条目：生成点偏好与进场搜深潜者由 behavior.spawnLocation/enemySpawned 实现'
    + '（搜牌库/弃牌堆走 api.takeEncounterDeckCard/takeEncounterDiscard，找不到时按普通敌人处理）。',
  abilities: [],
}
