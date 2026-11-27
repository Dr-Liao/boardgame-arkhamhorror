// 08571 肯斯勒博士的办公室
import { partnerShroud } from './_shared.js'

export default {
  code: '08571', scope: 'location', implemented: true,
  flags: { mirageId: 'drKenslersOffice', tier: 2 },
  locationRule: { shroudModifier: partnerShroud('08593', '08720') },
  abilities: [{
    kind: 'forced', trigger: 'investigateSuccess', label: '受到 1 恐惧或从资产上移除 1 秘密',
    criteria: ({ inv, source, context }) => context.seat === inv.seat && context.location === source.id,
    resolve: ({ inv, source, api }) => {
      const assets = api.countControlled(inv.seat, { usesType: 'secret' }).filter(asset => asset.uses > 0)
      const options = [{ id: 'horror', label: '受到 1 点恐惧' },
        ...assets.map(asset => ({ id: asset.id, label: '移除「' + api.cardName(asset.code) + '」上的 1 秘密', cardCode: asset.code }))]
      const selected = options.length === 1 ? 'horror' : api.choice({ kind: 'effect', source: source.id, seat: inv.seat,
        prompt: '肯斯勒博士的办公室：选择一项。', options })
      const asset = assets.find(item => item.id === selected)
      if (asset) api.spendUses(asset, 1)
      else api.horror(inv.seat, 1)
    },
  }],
}
