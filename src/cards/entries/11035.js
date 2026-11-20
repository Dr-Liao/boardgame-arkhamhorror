export default {
  code: '11035',
  uses: 0,
  usesType: 'charges',
  assetRule: { reactToAutomaticEvade: true },
  abilities: [{
    kind: 'reaction', trigger: 'evadeSuccess', limit: { scope: 'perWindow', owner: 'instance' },
    label: '此处的敌人被躲避后：获得 1 充能',
    criteria: [({ inv, context }) => (context.enemy?.location ?? context.location) === inv.location],
    resolve: ({ source, api }) => {
      api.addUses(source, 1)
      if (source.uses >= 4) api.recordResearch('youHaveCalculatedTheDayOfReckoning')
    },
  }],
}
