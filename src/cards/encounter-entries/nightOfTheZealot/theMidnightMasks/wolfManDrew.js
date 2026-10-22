// wolfManDrew “狼人”德鲁
// 归属：关卡专用 · theMidnightMasks（夜之狂热 · 第二幕：午夜假面）
// 遭遇组：无（story）
// 卡面：强制 - 攻击时：治愈他 1 点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// “狼人”德鲁（01137）：攻击时治愈他 1 点伤害。
// 迁移自 enemies.js 的 `enemy.code === 'wolfManDrew'` 分支（REPORT.md §2.6 / 第 2 批）。
// 非玩家条目的 code 用运行时实体 id（关卡定义里的 key），与既有 screechingByakhee 一致。

export default {
  code: 'wolfManDrew',
  name: '“狼人”德鲁',
  scope: 'enemy',
  text: '强制 - 攻击时：治愈他 1 点伤害。',
  abilities: [{
    kind: 'forced', trigger: 'enemyAttack', silent: true,
    criteria: { when: ({ source, context }) => source?.id === context?.enemy?.id },
    resolve: ({ api, source }) => api.healEnemy(source, 1),
  }],
}
