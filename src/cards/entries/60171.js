// 60171 M1911（2 级）
// 卡面：使用(4子弹)。[action] 花 1 子弹：攻击([combat])，+2[combat]、伤害+1；本次攻击忽略反击。
// 读点：action 描述子 + api.fight({combatBonus, damageBonus, ignoreRetaliate})。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60171',
  uses: 4,
  usesType: 'ammo',
  abilities: [{
    kind: 'action',
    label: '花 1 子弹：攻击（+2 战斗，+1 伤害，忽略反击）',
    cost: { action: true, uses: 1 },
    countsAs: 'fight',
    target: { kind: 'enemy' },
    resolve: ({ inv, target, source, api }) => {
      if (!target) return
      api.fight(inv.seat, target.id, {
        assetId: source?.id, combatBonus: 2, damageBonus: 1, ignoreRetaliate: true,
      })
    },
  }],
  modifiers: [],
}
