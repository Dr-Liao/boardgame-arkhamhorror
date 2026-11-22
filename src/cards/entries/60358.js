// 60358 声名（Fame，André Patel）
// 卡面：使用（4 声望）。如果声名上没有声望，将其弃掉。
//       [action] 如果你所在地点有敌人，花费 1 声望：谈判。获得 2 资源。
export default {
  code: '60358',
  uses: 4,
  usesType: 'renown',
  discardWhenEmpty: true,
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    countsAs: 'parley',
    label: '谈判：花费 1 声望，获得 2 资源',
    cost: { action: true, uses: 1 },
    criteria: [({ state, inv }) => (state.enemies || []).some(enemy => enemy.location === inv.location)],
    resolve: ({ inv, api }) => api.gainResources(inv.seat, 2),
  }],
}
