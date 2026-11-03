export default {
  code: '07004', kind: 'investigator', investigator: { elderSign: { bonus: 2 } },
  elderSign: { label: '旧印：+2，可收回支援并抽牌', resolve: ({ inv, api }) => {
    const assets = inv.assets.filter(asset => api.investigatorTools.canReturnAsset(inv.seat, asset))
    if (assets.length) {
      const id = api.choice({ kind: 'effect', seat: inv.seat, source: inv.code, canSkip: true,
        prompt: '可收回一张支援，然后抽 1 张牌。', options: [{ id: 'skip', label: '不收回' },
          ...assets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) }))] })
      const asset = assets.find(asset => asset.id === id)
      if (asset) { api.returnAssetToHand(inv.seat, asset); api.drawCards(inv.seat, 1) }
    }
    return { delta: 2 }
  } },
  abilities: [{ kind: 'free', label: '弃掉支援，以折扣 1 打出不同名支援', limit: 'oncePerRound',
    criteria: ({ inv, state, helpers }) => state.phase === 'investigation' && state.currentSeat === inv.seat && !inv.turnEnded
      && inv.assets.some(asset => helpers.canDiscardAsset(asset) && inv.hand.some(code => helpers.cardType(code) === 'asset'
        && helpers.cardName(code) !== helpers.cardName(asset.code) && helpers.playCost(code) - 1 <= inv.resources)),
    resolve: ({ inv, api }) => {
      const assets = inv.assets.filter(asset => api.investigatorTools.canDiscardAsset(inv.seat, asset) && inv.hand.some(code => api.cardType(code) === 'asset'
        && api.cardName(code) !== api.cardName(asset.code) && api.playCost(inv.seat, code) - 1 <= inv.resources))
      const id = api.choice({ kind: 'effect', seat: inv.seat, source: inv.code, prompt: '选择弃掉的支援。',
        options: assets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })) })
      api.investigatorTools.replaceAsset(inv.seat, id)
    } }],
}
