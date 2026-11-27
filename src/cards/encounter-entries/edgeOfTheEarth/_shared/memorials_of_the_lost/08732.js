// 08732 曲奇的特制 .32 手枪 · 剧情资产。快速；使用（2 子弹）。
const CODE = '08732'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  fast: true, uses: 2, usesType: 'ammo',
  flags: { memorial: true },
  abilities: [{
    kind: 'action', actionKind: 'fight',
    label: '花费 1 子弹：基础战斗 5 或战斗 +2；伤害 +1',
    cost: { action: 1, uses: 1 },
    target: { kind: 'enemy' },
    resolve: ({ inv, target, source, api }) => {
      const mode = api.choice({
        kind: 'effect', source: CODE, seat: inv.seat, prompt: '选择攻击方式。',
        options: [{ id: 'base5', label: '以基础战斗 5 攻击' }, { id: 'bonus', label: '本次攻击战斗 +2' }],
      })
      const modifier = mode === 'base5' ? { baseValue: 5 } : { combatBonus: 2 }
      api.fight(inv.seat, target.id, { ...modifier, damageBonus: 1, noSpend: true, sourceCode: CODE, assetId: source.id })
    },
  }],
}
