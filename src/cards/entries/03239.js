// 03239 应急物品
// 卡面：获得4资源或将4补给标记分配给你所在地点的调查员控制的支援(或以任意方式组合，总计4点)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03239 应急物资：分配 4 点——资源或补给。

export default {
  code: '03239',
  abilities: [
    {
      kind: 'played', label: '分配 4 点：资源与补给',
      resolve: ({ inv, api }) => {
        const answer = api.choice({ kind: 'amount', source: '03239', seat: inv.seat,
          prompt: '选择获得的资源数，其余作为补给放置。',
          options: Array.from({ length: 5 }, (_, n) => ({ id: String(n), label: `${n}资源／${4 - n}补给` })) })
        const resources = Number(answer)
        api.gainResources(inv.seat, resources)
        const supplies = 4 - resources
        if (!supplies) return
        const targets = api.investigatorsAt(inv.location).flatMap(owner => owner.assets)
          .filter(asset => String(asset.usesType).toLowerCase().startsWith('suppl'))
        if (!targets.length) return
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '03239', seat: inv.seat, prompt: '选择要放置补给的支援。',
            options: targets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })) })
        const asset = targets.find(item => item.id === chosen) || targets[0]
        api.addUses(asset, supplies)
      },
    },
  ],
  modifiers: [

  ],
}
