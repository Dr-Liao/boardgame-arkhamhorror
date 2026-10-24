// 05101 暗影猎犬
// 归属：战役共用 · theCircleUndone；遭遇组：spectral_predators
// 卡面：猎物 - [agility]最低。猎手。反击。
// 卡面：强制 - 在暗影猎犬攻击你后：结算你所在地点的每个闹鬼能力。
//
// 猎物与关键词由 definition.js 从印刷文本解析（prey 的引擎 key 由本条目补成 lowestAgility）；
// 「攻击后」由共享 enemyAttackResolved 钩子分派到本条目 onAttackResolved。

export default {
  code: '05101',
  scope: 'enemy',
  implemented: true,
  enemyRule: { prey: 'lowestAgility' },
  enemyScript: {
    onAttackResolved(state, enemy, inv, api) {
      api.info?.(`暗影猎犬的攻击结束：${inv.name} 结算所在地点的每个闹鬼能力。`)
      api.haunted?.(inv.seat, { locationId: inv.location, kind: 'effect', source: '05101' })
    },
  },
}
