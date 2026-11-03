export default {
  code: '07261', attachTo: { kind: 'asset', trait: 'weapon', controllerScope: 'location', maxPerTarget: 1 },
  assetRule: { hostExtraSlot: 'arcane', hostTrait: 'Relic' },
  abilities: [{ kind: 'reaction', trigger: 'weaponFightInitiated', label: '横置：本次攻击加入本卡所有者意志，伤害 +1', cost: { exhaust: true },
    criteria: ({ inv, source, context }) => context.seat === inv.seat && context.assetId === source.hostAssetId,
    resolve: ({ context, source, api }) => api.playerTools.enchantAttack(context, source) }],
}
