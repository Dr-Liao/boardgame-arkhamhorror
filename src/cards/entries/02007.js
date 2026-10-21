// 02007 击退邪恶
// 卡面：显现 - 从遭遇牌库顶弃牌，直到弃掉一个敌人。将击退邪恶附属到该敌人上，并将其生成在离你最远的地点。
// 卡面：强制 - 在游戏结束时，如果所附属的敌人在场上：佐伊·萨马拉斯承受1点精神创伤。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02007',
  abilities: [
    {
      kind: 'weakness', label: '击退邪恶', weakness: { type: 'attachedEnemy' },
      // Phase 5（5a-15）：结算迁到能力层——遭遇牌库顶的敌人生成在离你最远的地点并附着。
      resolve: ({ inv, api }) => {
        const enemyCode = api.encounterTopEnemy()
        if (!enemyCode) { api.putIntoDiscard(inv.seat, '02007'); return }
        const farthest = api.farthestLocations(inv.seat)
        if (!farthest.length) { api.putIntoDiscard(inv.seat, '02007'); return }
        const locationId = farthest.length === 1 ? farthest[0] : api.choice({ kind: 'location', source: '02007', seat: inv.seat,
          prompt: '选择距离你最远的地点，生成被惩戒敌人。',
          options: farthest.map(id => ({ id, label: api.locName(id) })) })
        if (!locationId) return
        const enemy = api.spawnEnemyAt(enemyCode, locationId)
        if (enemy) {
          api.markSmiteTheWicked(enemy, inv.seat)
          api.info('「惩戒邪恶」附着于 ' + enemy.name + '。')
        }
      },
    },
  ],
  modifiers: [

  ],
}
