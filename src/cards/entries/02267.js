// 02267 月光仪式
// 卡面：移除你控制的1张卡牌上所有的毁灭标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02267',
  abilities: [
    {
      kind: 'played', label: '月光仪式',
      resolve: ({ inv, api }) => {
        const targets = inv.assets.filter(asset => (asset.doom || 0) > 0)
        if (!targets.length) return
        const target = targets.length === 1 ? targets[0] : targets.find(asset => asset.id === api.choice({
          kind: 'target', seat: inv.seat, prompt: '选择要移除全部毁灭标记的卡牌。',
          options: targets.map(asset => ({ id: asset.id, label: `${api.cardName(asset.code)}（${asset.doom} 毁灭）` })),
        }))
        if (!target) return
        api.setAssetDoom(target, 0)
        api.info(`「${api.cardName(target.code)}」上的毁灭标记被全部移除。`)
      },
    },
  ],
  modifiers: [

  ],
}
