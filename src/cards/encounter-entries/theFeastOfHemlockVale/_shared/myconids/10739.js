// 10739 尸苔（Corpse Lichen）· 敌人 · 共享遭遇组 myconids（印刷 1 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/myconids。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   (Day [day]) Corpse Lichen cannot move. (Night [night]) Hunter. Alert.
//   Forced - After Corpse Lichen attacks: Heal 1 damage from it.
//
// 读点（声明即接线）：
//   · 「猎手 / 警戒」：encounterDefinitions 从英文正文解析关键词（card-data.js），昼夜差异是
//     P8 关键词昼夜读点，条目只把昼夜数据放进 flags。
//   · 「它攻击后治愈 1 点伤害」= 条目的 forced 描述子，trigger 'enemyAttacked'
//     （读点：src/engine/enemies.js#enemyAttack 的 reactionWindow('enemyAttacked')；
//     非玩家实体来源见 ability-rules.js#nonPlayerAbilitySources，context.enemy 是本敌人）。
//   · 治愈 = api.healEnemy（api-misc.js，写 damageTaken，与 01179 的轮末治愈同口径）。
//   · 「白日不能移动」：引擎的敌人不能移动读点是实例字段 enemy.immobile，只有章节 behavior
//     （enemySpawned / enemyMoved 刷新）能按昼夜写入，单卡条目没有写入口，因此只落数据。
export default {
  code: '10739',
  scope: 'enemy',
  implemented: true,
  flags: {
    encounterGroup: 'myconids',
    quantity: 1,
    traits: ['Humanoid', 'Monster', 'Flora', 'Mutated'],
    nightOnlyKeywords: ['hunter', 'alert'],
    dayCannotMove: true,
    healAfterAttack: 1,
    printedFight: 4,
    printedEvade: 3,
    printedHealth: 4,
    printedDamage: 1,
    printedHorror: 1,
    printedVictory: 0,
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyAttacked',
    silent: true,
    label: '强制：尸苔攻击后治愈 1 点伤害',
    criteria: [({ source, context }) => source?.id != null && source.id === context?.enemy?.id],
    resolve: ({ source, api }) => {
      const healed = api.healEnemy(source, 1)
      api.info?.(healed > 0
        ? `💉 「${source.name}」攻击后治愈 ${healed} 点伤害。`
        : `💉 「${source.name}」攻击后没有伤害可治愈。`)
    },
  }],
  note: '「攻击后治愈 1 点」用 enemyAttacked 窗口自足实现。「白日不能移动」需要按昼夜刷新实例的 '
    + 'enemy.immobile，单卡条目没有写入通道（引擎移动读点只认实例字段），故只落 flags.dayCannotMove 数据，'
    + '留给 P8 章节 enemySpawned / enemyMoved 刷新；「黑夜猎手/警戒」由 encounterDefinitions 静态解析。',
}
