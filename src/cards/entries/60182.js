// 60182 汤普森冲锋枪（Thompson Submachine Gun，5 级）
// 卡面：使用(6子弹)。[action] 花 1 子弹：攻击([combat])，+3[combat]、伤害+1。
// [reaction] 你结算上述能力后，花 1 子弹：攻击([combat])，本次攻击伤害+1。
// 读点：action 描述子 + api.fight；reaction trigger assetActionResolved（ability-exec 行动后窗口）+ cost.uses + api.fight。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60182'

export default {
  code: CODE,
  uses: 6,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '花 1 子弹：攻击（+3 战斗，+1 伤害）',
      cost: { action: true, uses: 1 },
      countsAs: 'fight',
      target: { kind: 'enemy' },
      resolve: ({ inv, target, source, api }) => {
        if (!target) return
        api.fight(inv.seat, target.id, { assetId: source?.id, combatBonus: 3, damageBonus: 1 })
      },
    },
    {
      kind: 'reaction',
      trigger: 'assetActionResolved',
      label: '结算上述攻击后，花 1 子弹：再攻击一次，伤害 +1',
      cost: { uses: 1 },
      criteria: [({ inv, context, source }) => context?.seat === inv.seat && context?.assetId === source?.id],
      resolve: ({ state, inv, source, api }) => {
        const enemies = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.defeated)
        if (!enemies.length) return
        const id = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要攻击的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === id)
        if (enemy) api.fight(inv.seat, enemy.id, { assetId: source?.id, damageBonus: 1 })
      },
    },
  ],
  modifiers: [],
}
