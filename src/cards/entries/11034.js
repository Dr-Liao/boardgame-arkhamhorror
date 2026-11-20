import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '11034',
  uses: 1,
  usesType: 'inspiration',
  limitPerInvestigator: true,
  abilities: [
    {
      kind: 'free', label: '横置并弃掉 1 张手牌：补充 1 灵感',
      cost: { exhaust: true, discardHand: 1 },
      criteria: [({ source }) => source.uses < 1],
      resolve: ({ source, api }) => api.setAssetUses(source, 1),
    },
    {
      kind: 'reaction', trigger: 'chaosRevealStepEnded', id: 'inspirationSkillAdjust',
      label: '花费 1 灵感：本次检定技能值 +1 或 -1',
      cost: { uses: 1 },
      limit: { scope: 'perTest', owner: 'instance' },
      criteria: [ownSeat()],
      resolve: ({ inv, descriptor, api }) => {
        const answer = api.choice({
          kind: 'effect', source: '11034', seat: inv.seat, prompt: '选择本次检定的技能值调整。',
          options: [{ id: '+1', label: '技能值 +1' }, { id: '-1', label: '技能值 -1' }],
        })
        api.addTestResolutionBonus(inv.seat, Number(answer), descriptor.id)
      },
    },
  ],
}
