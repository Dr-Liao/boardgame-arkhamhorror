export default {
  code: '11029',
  abilities: [
    {
      kind: 'commit', label: '成功：重整同地点盟友并治愈各 1 点伤害和恐惧',
      skill: {
        onSuccessResolve: ({ inv, api }) => {
          const allies = api.investigatorsAt(inv.location).flatMap(owner => (owner.assets || [])
            .filter(asset => api.cardTraits(asset.code).some(trait => trait.toLowerCase() === 'ally')
              && (asset.exhausted || asset.damage > 0 || asset.horror > 0))
            .map(asset => ({ owner, asset })))
          if (!allies.length) return
          const id = allies.length === 1 ? allies[0].asset.id : api.choice({
            kind: 'asset', source: '11029', seat: inv.seat, prompt: '选择要重整及治疗的盟友支援。',
            options: allies.map(({ asset }) => ({ id: asset.id, label: api.cardName(asset.code) })),
          })
          const selected = allies.find(({ asset }) => asset.id === id)
          if (!selected) return
          if (selected.asset.exhausted && !api.assetsCannotReady(selected.owner)) api.ready(selected.asset)
          api.healAsset(selected.asset, { owner: selected.owner, damage: 1, horror: 1 })
        },
      },
    },
  ],
}
