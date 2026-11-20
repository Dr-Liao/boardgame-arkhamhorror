import { ownTurn } from '../../engine/matcher.js'

const CODE = '11071'
const chargeAssets = inv => inv.defeated || inv.resigned ? []
  : inv.assets.filter(asset => ['charge', 'charges'].includes(asset.usesType) && asset.uses > 0)

export default {
  code: CODE,
  fast: true,
  playCondition: [ownTurn()],
  attachTo: { kind: 'playerCard', controllerScope: 'location', hasHealthOrSanity: true },
  abilities: [{
    kind: 'forced', trigger: 'assignedHarm', label: '宿主受到伤害或恐惧时：取消其中 1 点，然后移除 1 充能或弃掉此牌',
    criteria: [({ context, source }) => !context.cannotCancel
      && (context.damage > 0 || context.horror > 0)
      && (context.target?.attachments || []).some(attachment => attachment.id === source.id)],
    resolve: ({ state, inv, source, context, api }) => {
      const owner = state.investigators[source.ownerSeat ?? inv.seat]
      const kinds = [
        ...(context.damage > 0 ? [{ id: 'damage', label: '取消 1 点伤害' }] : []),
        ...(context.horror > 0 ? [{ id: 'horror', label: '取消 1 点恐惧' }] : []),
      ]
      const kind = kinds.length === 1 ? kinds[0].id : api.choice({
        kind: 'harm', source: CODE, seat: owner.seat,
        prompt: '选择要取消的伤害或恐惧。',
        options: kinds,
      })
      if (!api.cancelAssignedHarm(context, kind, 1, owner.seat)) return
      const assets = chargeAssets(owner)
      if (!assets.length) {
        api.discardPlayerAttachment(source)
        return
      }
      const id = assets.length === 1 ? assets[0].id : api.choice({
        kind: 'target', source: CODE, seat: owner.seat,
        prompt: '选择要移除 1 充能的支援。',
        options: assets.map(asset => ({ id: asset.id, label: api.cardName(asset.code), cardCode: asset.code })),
      })
      const asset = assets.find(candidate => candidate.id === id)
      api.setAssetUses(asset, asset.uses - 1)
    },
  }],
}
