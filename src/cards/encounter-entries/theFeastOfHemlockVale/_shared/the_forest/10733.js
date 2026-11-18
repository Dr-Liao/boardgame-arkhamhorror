// 10733 森林看护者（Forest Watcher）· 敌人 · 共享遭遇组 the_forest（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_forest。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Aloof. (Night [night]) Elusive.
//   Spawn - Any location (empty, if able).
//   Forced - After Forest Watcher enters play: Place 1 doom on it.
//
// 读点（声明即接线）：
//   · 「冷漠」：encounterDefinitions 从英文正文解析（content/campaigns/theFeastOfHemlockVale/card-data.js），
//     有效读点是 src/engine/enemy-aloof.js#enemyIsAloof。
//   · 「生成 - 任意地点（如可能，无人地点）」= enemyRule.spawnAnyEmpty
//     （读点：src/engine/encounter.js#drawEncounter 的「任意无人地点」分支；无空地点时回落
//     章节 behavior.spawnLocation）。
//   · 「入场后在其上放置 1 个毁灭」= enemySpawnRule.doomOnSpawn（读点：src/engine/enemies.js#enterExistingEnemy，
//     走同一份 canPlaceDoomOn 守卫；与 01170 的写法同口径）。
//   · 印刷数值（fight 1 / evade 3 / health 2 / damage 1 / horror 0）由 cards-data 提供，条目只镜像。
export default {
  code: '10733',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    spawnAnyEmpty: true,
  },
  enemySpawnRule: {
    doomOnSpawn: 1,
  },
  flags: {
    encounterGroup: 'the_forest',
    quantity: 2,
    traits: ['Creature', 'Flora', 'Mutated'],
    keywords: ['aloof'],
    nightOnlyKeywords: ['elusive'],
    printedFight: 1,
    printedEvade: 3,
    printedHealth: 2,
    printedDamage: 1,
    printedHorror: 0,
    printedVictory: 0,
    spawnRule: 'anyLocationEmptyIfAble',
    doomOnEnter: 1,
  },
  abilities: [],
  note: '近似：「任意地点（如可能，无人地点）」由引擎的「任意无人地点」分支承担（没有空地点时改用章节'
    + 'behavior.spawnLocation），不再区分「优先无人、否则任意有人地点」；「黑夜逃逸」是昼夜关键词，'
    + 'encounterDefinitions 只按英文正文静态解析（黑夜面由 P8 关键词昼夜读点处理），故本条目不声明 enemyRule.elusive。',
}
