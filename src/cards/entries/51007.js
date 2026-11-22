export default {
  code: '51007',
  uses: 3,
  usesType: 'charges',
  abilities: [{
    kind: 'action',
    label: '意志 +2 调查，成功时额外发现 1 个线索',
    cost: { action: true, uses: 1 },
    effect: { type: 'investigate', skill: 'willpower', bonus: 2, clueBonus: 1, symbolEndsTurn: true },
  }],
}
