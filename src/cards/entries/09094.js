// 09094 食罪者（Sin-Eater）· 秘术师支援 · 3 经验 · 永久 / 卓越。
// 卡面：永久。卓越。
//       [fast] 横置食罪者：从你控制的支援上将 1 个毁灭标记移动到食罪者上。然后，
//       重整该支援，或在上面放置 1 充能。
//       [action]：移除食罪者所有的毁灭标记。
//
// 读点：api.removeDoomFromCard / api.placeDoomOnCard / api.ready / api.addUses /
//       api.setAssetDoom（毁灭写点统一）。
export default {
  code: '09094',
  abilities: [
    {
      kind: 'free',
      label: '横置：把控制支援上的 1 个毁灭移到食罪者，然后重整它或放 1 充能',
      cost: { action: false, exhaust: true },
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const candidates = (inv.assets || []).filter(asset => asset !== source && (asset.doom || 0) > 0)
        if (!candidates.length) {
          api.info('「食罪者」：没有带毁灭标记的支援。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '09094', seat: inv.seat,
          prompt: '选择要移走 1 个毁灭标记的支援。',
          options: candidates.map(asset => ({ id: asset.id, label: `${api.cardName(asset.code)}（毁灭 ${asset.doom}）` })),
        })
        const asset = candidates.find(item => item.id === picked) || candidates[0]
        api.removeDoomFromCard(asset, 1)
        api.placeDoomOnCard(source, 1)
        const answer = api.choice({
          kind: 'effect', source: '09094', seat: inv.seat,
          prompt: '选择对刚刚移走毁灭的支援的处理。',
          options: [{ id: 'ready', label: '重整该支援' }, { id: 'charge', label: '在该支援上放置 1 充能' }],
        })
        if (answer === 'ready') api.ready(asset)
        else api.addUses(asset, 1)
        api.info(`🍽️ 「食罪者」：吞下「${api.cardName(asset.code)}」的 1 个毁灭标记。`)
      },
    },
    {
      kind: 'action',
      label: '移除食罪者所有的毁灭标记',
      cost: { action: true },
      resolve: ({ source, api }) => {
        if (!source) return
        api.setAssetDoom(source, 0)
        api.info('🍽️ 「食罪者」：移除自身所有毁灭标记。')
      },
    },
  ],
  modifiers: [],
}
