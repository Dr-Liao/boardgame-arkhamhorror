// 02109 走私品
// 卡面：选择你所在地点一位调查员控制的一个支援。将该支援上的子弹或补给标记数量翻倍。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02109',
  abilities: [
    {
      kind: 'played',
      label: '走私品',
      resolve: ({ state, inv, api }) => {
        const targets = state.investigators
          .filter(other => !other.defeated && !other.resigned && other.location === inv.location)
          .flatMap(owner => owner.assets.filter(asset => ['ammo', 'supplies'].includes(asset.usesType)))
        if (!targets.length) return
        const id = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: '02109', seat: inv.seat, prompt: '选择弹药或补给翻倍的支援。',
          options: targets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const asset = targets.find(item => item.id === id)
        if (asset) api.setAssetUses(asset, (asset.uses || 0) * 2)
      },
    },
  ],
  modifiers: [

  ],
}
