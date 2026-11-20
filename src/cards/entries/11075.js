import { ownSeat } from '../../engine/matcher.js'

const CODE = '11075'
const spellOrRitual = traits => traits.some(trait => /^(spell|ritual)$/i.test(trait))

export default {
  code: CODE,
  assetRule: { ownerLocationAttachmentAbility: true },
  playCondition: [({ state, inv }) => state.locations.some(location => location.id === inv.location)
    && !(state.playerLocationAttachments || []).some(card => card.location === inv.location && card.code === CODE)],
  abilities: [
    {
      kind: 'played', becomesAsset: true,
      label: '附属到你所在地点（每地点限 1 张）',
      resolve: ({ inv, api }) => api.attachToLocation(inv.location, { code: CODE, ownerSeat: inv.seat }),
    },
    {
      kind: 'reaction', trigger: 'assetAbilityActivated',
      label: '在所附属地点重复该法术或仪式的能力，忽略行动成本；然后将此牌取回手牌',
      criteria: [ownSeat(), ({ state, source, context, helpers }) =>
        (state.playerLocationAttachments || []).includes(source)
          && spellOrRitual(helpers.cardTraits(context.assetCode))
          && helpers.canRepeatAssetAbility(context, { locationId: source.location, ignoreActionCost: true })],
      resolve: ({ source, context, api }) => {
        const completed = api.repeatAssetAbility(context, { locationId: source.location, ignoreActionCost: true })
        if (completed) api.returnLocationAttachmentToHand(source)
      },
    },
  ],
}
