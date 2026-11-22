// 60220 图书馆讲解员
// 卡面：[reaction]图书馆讲解员入场后，将一张你控制的[[书籍]]支援返回其所有者的手牌：打出你手牌中的另一张名称不同的[[书籍]]支援，其资源费用减少2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60220',
  abilities: [{
    kind: 'reaction', trigger: 'assetEnteredPlay',
    limit: { scope: 'perWindow', owner: 'instance' },
    label: '本牌入场后：收回控制的典籍，少花费 2 资源打出另一张不同名的手牌典籍',
    criteria: ({ inv, source, context, helpers }) => source?.id === context.assetId
      && context.seat === inv.seat
      && inv.assets.some(asset => helpers.cardTraits(asset.code).some(trait => trait.toLowerCase() === 'tome')
        && helpers.playHandCardOptions(inv.seat, { type: 'asset', trait: 'Tome', discount: 2 })
          .some(card => helpers.cardName(card) !== helpers.cardName(asset.code))),
    resolve: ({ inv, api }) => {
      const playable = api.playHandCardOptions(inv.seat, { type: 'asset', trait: 'Tome', discount: 2 })
      const tomes = inv.assets.filter(asset => api.cardTraits(asset.code).some(trait => trait.toLowerCase() === 'tome')
        && playable.some(card => api.cardName(card) !== api.cardName(asset.code)))
      if (!tomes.length) return
      const returned = tomes.length === 1 ? tomes[0] : tomes.find(asset => asset.id === api.choice({
        kind: 'card', source: '60220', seat: inv.seat, prompt: '选择要收回的典籍。',
        options: tomes.map(item => ({ id: item.id, cardCode: item.code, label: api.cardName(item.code) })),
      }))
      if (!returned || !api.returnAssetToHand(inv.seat, returned)) return
      const options = api.playHandCardOptions(inv.seat, { type: 'asset', trait: 'Tome', discount: 2 })
        .filter(card => api.cardName(card) !== api.cardName(returned.code))
      if (!options.length) return
      const card = options.length === 1 ? options[0] : api.choice({
        kind: 'card', source: '60220', seat: inv.seat, prompt: '选择要打出的另一张典籍。',
        options: options.map(card => ({ id: card, cardCode: card, label: api.cardName(card) })),
      })
      api.playAsEffect(inv.seat, card, { discount: 2 })
    },
  }],
}
