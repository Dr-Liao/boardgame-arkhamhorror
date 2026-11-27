const code = '12086'

export default {
  code: '12086',
  abilities: [{
    kind: 'action',
    countsAs: 'fight',
    target: { kind: 'enemy' },
    label: '攻击：+1[战斗]；成功后可以弃掉破瓶子使伤害 +1',
    cost: { action: true },
    resolve: ({ source, target, inv, api }) => {
      if (!target?.entity) return
      api.fight(inv.seat, target.entity.id, {
        combatBonus: 1,
        assetId: source.id,
        damageBonusForResult: () => {
          if (!api.scenario.canDiscardAsset(inv.seat, source.id)) return 0
          const answer = api.choice({
            kind: 'reaction', source: code, seat: inv.seat, canSkip: true,
            prompt: '攻击成功。是否弃掉破瓶子，使这次攻击造成 +1 伤害？',
            options: [{ id: 'skip', label: '保留破瓶子' }, { id: 'discard', label: '弃置，伤害 +1' }],
          })
          return answer === 'discard' && api.scenario.discardAsset(inv.seat, source.id) ? 1 : 0
        },
      })
    },
  }],
}
