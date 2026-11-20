export default {
  code: '11078',
  uses: 2,
  usesType: 'charges',
  assetRule: { providesChargesForTraits: ['Spell', 'Ritual'] },
  abilities: [{
    kind: 'reaction', trigger: 'clueDiscovered',
    label: '此处最后一个线索被发现后横置：放置 1 充能',
    cost: { exhaust: true },
    criteria: [({ inv, context }) => context.lastClue === true && context.location === inv.location],
    resolve: ({ source, api }) => api.addUses(source, 1),
  }],
}
