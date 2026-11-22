// 60269 文学分析（Literary Analysis）
// 卡面：如果本次技能检定成功，补充你所在地点的一个[[书籍]]支援的 1 秘密。
// 读点：commit 描述子 skill.onSuccessResolve + api.placeUse（使用次数补充唯一写点）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60269',
  abilities: [{
    kind: 'commit',
    label: '若检定成功：为你所在地点一个[[书籍]]支援补充 1 秘密',
    skill: {
      onSuccessResolve: ({ state, inv, api }) => {
        const tomes = []
        for (const owner of state.investigators.filter(item => !item.defeated && !item.resigned
          && item.location === inv.location)) {
          for (const asset of owner.assets || []) {
            if ((api.cardTraits(asset.code) || []).some(trait => String(trait).toLowerCase() === 'tome')) {
              tomes.push(asset)
            }
          }
        }
        if (!tomes.length) return
        const id = tomes.length === 1 ? tomes[0].id : api.choice({
          kind: 'target', source: '60269', seat: inv.seat, prompt: '选择一个[[书籍]]支援补充 1 秘密。',
          options: tomes.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const tome = tomes.find(asset => asset.id === id) || tomes[0]
        api.placeUse(tome, 'secrets', 1)
      },
    },
  }],
  modifiers: [],
}
