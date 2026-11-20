import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '11005', uses: 1, usesType: 'inspiration',
  abilities: [
    {
      kind: 'forced', trigger: 'clueDiscovered', label: '本轮首次发现线索：补充灵感',
      limit: { scope: 'perRound', owner: 'instance' }, criteria: [ownSeat(), ({ context }) => context.firstThisRound !== false],
      resolve: ({ source, api }) => api.setAssetUses(source, 1),
    },
    {
      kind: 'reaction', trigger: 'chaosRevealStepEnded', id: '11005-boost', label: '花费 1 灵感：本次检定 +1，刚好成功时抽牌',
      cost: { uses: 1 }, limit: { scope: 'perTest', owner: 'instance' }, criteria: [ownSeat()],
      resolve: ({ inv, api, descriptor }) => {
        api.addTestResolutionBonus(inv.seat, 1, descriptor.id)
      },
    },
    {
      kind: 'forced', trigger: 'testEnds', label: '刚好成功：抽 1 张牌',
      criteria: [ownSeat(), ({ context, state, inv }) => context.result?.success
        && context.result.value === context.result.difficulty
        && state.skillTest?.activatedAbilities?.[inv.seat]?.includes('11005-boost')],
      resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
    },
  ],
}
