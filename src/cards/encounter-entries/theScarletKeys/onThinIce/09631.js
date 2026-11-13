// 09631 饥饿的灰熊（Ravenous Grizzly）· 敌人 · on_thin_ice
//
// 归属：关卡专用 · theScarletKeys/onThinIce（P7）。印刷 2 份，进遭遇牌库。
// 卡面（中）：猎手。反击。生成 - 最近的[[荒地]]地点。
//   饥饿的灰熊不能进入非[[荒地]]地点。
//   饥饿的灰熊移动时，跳过连接的非[[荒地]]地点。
//
// 读点（章节 behavior + 引擎）：
//   · 「不能进入非[[荒地]]地点」→ `enemyRule.enterOnlyTraits: ['Wilderness']`，
//     读点 `src/engine/enemy-entry.js#enemyCanEnterLocation`（生成/移动/猎人/巡逻共用同一处）；
//   · 「生成 - 最近的[[荒地]]地点」→ behavior.enemySpawned 读 `spawnNearestWilderness`，
//     把敌人挪到最近的[[荒地]]地点（引擎的 spawn 位置由抽牌者决定，卡面规则由内容层纠正）；
//   · 「移动时跳过非[[荒地]]地点」→ behavior.hunterMove 读 `skipsNonWildernessWhenMoving`，
//     只在[[荒地]]地点之间做 BFS 步进（wildernessStepToward）；
//   · 「猎手/反击」由 definition 的印刷关键字进入敌人实例。
export default {
  code: '09631',
  name: '饥饿的灰熊',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    hunter: true,
    retaliate: true,
    enterOnlyTraits: ['Wilderness'],
    spawnNearestWilderness: true,
    skipsNonWildernessWhenMoving: true,
  },
  note: 'approximation: 「跳过连接的非[[荒地]]地点」只在猎手移动（hunterMove）里做[[荒地]]子图步进；'
    + '由卡牌效果直接搬运（api.moveEnemy）时不做路径跳过（卡面只约束它自己的移动）。',
}
