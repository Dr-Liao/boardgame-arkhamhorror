const secrets = card => card.usesType === 'secrets' ? card.uses || 0 : card.useTokens?.secret || 0
function choices(inv, available, canGain) {
  return inv.assets.flatMap(card => [
    ...(canGain && secrets(card) > 0 ? [{ id: `resource:${card.id}`, card, direction: 'resource' }] : []),
    ...(available > 0 && (!card.usesType || card.usesType === 'secrets') ? [{ id: `secret:${card.id}`, card, direction: 'secret' }] : []),
  ])
}
export default {
  code: '07304', uses: 0, usesType: 'secrets', assetRule: { sharedUses: 'secrets' },
  abilities: [{ kind: 'free', label: '横置：将 1 秘密与资源互换', cost: { action: false, exhaust: true },
    criteria: ({ inv, helpers }) => choices(inv, helpers.availableResources(), helpers.canGainResources()).length > 0,
    resolve: ({ inv, api }) => {
      const options = choices(inv, api.availableResources(inv.seat), api.canGainResources(inv.seat))
      if (!options.length) return
      const id = options.length === 1 ? options[0].id : api.choice({ kind: 'asset', source: '07304', seat: inv.seat,
        prompt: '选择要交换秘密／资源的支援。', options: options.map(option => ({ id: option.id,
          label: `${api.cardName(option.card.code)}：${option.direction === 'resource' ? '秘密 → 资源' : '资源 → 秘密'}` })) })
      const option = options.find(choice => choice.id === id)
      if (option) api.playerTools.exchangeSecret(inv.seat, option.card.id, option.direction)
    } }],
}
