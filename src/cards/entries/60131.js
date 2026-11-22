import { SKILL_NAMES_ZH } from './_shared.js'

export default {
  code: '60131',
  uses: 2,
  usesType: 'resources',
  abilities: [
    {
      kind: 'forced', trigger: 'roundStarts', label: '轮初补足本牌上的 2 个资源',
      resolve: ({ source, api }) => api.playerTools.replenishResources(source.id, 2),
    },
    ...['willpower', 'combat'].map(skill => ({
      kind: 'free', label: '花费 1 资源：本次检定的' + SKILL_NAMES_ZH[skill] + ' +1',
      cost: { action: false }, duringOwnSkillTest: true,
      criteria: ({ state, source, helpers }) => [].concat(state.skillTest?.skill || []).includes(skill)
        && (helpers.availableResources() > 0 || source.uses > 0),
      resolve: ({ inv, source, api }) => api.playerTools.resourceBoost(inv.seat, source.id, skill),
    })),
  ],
}
