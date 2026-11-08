// 08732 曲奇的特制 .32 手枪（Cookie 的特制手枪）· 剧情资产 · memorials_of_the_lost
// 卡面：快速。使用(2子弹)。[action]花费 1 子弹：攻击。以基础值为 5 的[combat]攻击，或者本次攻击
//   得到 +2[combat]。本次攻击造成 +1 伤害。
// 读点：api.test 的 baseValue/难度；目标走 target.kind enemy；伤害走 api.damageEnemy。
const CODE = '08732'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  fast: true, uses: 2, usesType: 'ammo',
  flags: { memorial: true },
  abilities: [{
    kind: 'action', actionKind: 'fight', label: '花费 1 子弹：基础值 5 的战斗攻击，或 +2 战斗；+1 伤害',
    cost: { action: 1, uses: 1 },
    target: { kind: 'enemy' },
    resolve: ({ state, inv, ctx, api }) => {
      const targetId = ctx?.target?.id ?? ctx?.targetId
      const enemy = state.enemies.find(item => item.id === targetId && !item.defeated)
      if (!enemy) return
      const mode = api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '选择攻击方式。',
        options: [{ id: 'base5', label: '以基础值 5 的战斗攻击' }, { id: 'bonus', label: '本次攻击 +2 战斗' }] })
      const choose = mode === 'base5' ? { baseValue: 5 } : { skillBonus: 2 }
      api.test(inv.seat, 'combat', Number(enemy.fight ?? 0), { ...choose,
        source: { type: 'asset', code: CODE, ability: true },
        resolve: result => {
          if (!result.success) return
          api.damageEnemy(enemy.id, 2, inv.seat, CODE)
        } })
    },
  }],
}

