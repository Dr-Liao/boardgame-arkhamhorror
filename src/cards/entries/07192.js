export default {
  code: '07192', researchRequirement: 'youHaveTranslatedTheGrimoire', uses: 0, usesType: 'secrets',
  abilities: [
    { kind: 'reaction', trigger: 'chaosTokenResolved', label: '结算诅咒后：放置 1 个秘密', limit: { scope: 'perWindow', owner: 'instance' },
      criteria: ({ inv, context }) => context.seat === inv.seat && context.token === 'curse',
      resolve: ({ source, api }) => api.addUses(source, 1) },
    { kind: 'reaction', trigger: 'encounterCardWouldDraw', label: '花费 5 秘密：改抽自己的牌库', cost: { uses: 5 },
      criteria: ({ inv, context }) => context.seat === inv.seat && !context.replaced,
      resolve: ({ api, context }) => api.playerTools.replaceEncounterDraw(context) },
  ],
}
