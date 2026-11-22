// 60175 弹药补给（Stock Ammo Reload，2 级）
// 卡面：在你控制的[[枪械]]支援上放置总计 5 子弹，由你选择分配。
// 读点：played 描述子 + api.addAmmo（api-clue 的弹药唯一写点）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60175'
const isFirearm = (api, code) => (api.cardTraits(code) || []).some(trait => String(trait).toLowerCase() === 'firearm')

export default {
  code: CODE,
  playCondition: [({ inv, api }) => (inv.assets || []).some(asset => isFirearm(api, asset.code))],
  abilities: [{
    kind: 'played',
    label: '在你控制的[[枪械]]支援上分配 5 子弹',
    resolve: ({ inv, api }) => {
      const firearms = (inv.assets || []).filter(asset => isFirearm(api, asset.code))
      if (!firearms.length) return
      let remaining = 5
      while (remaining > 0) {
        const id = firearms.length === 1 ? firearms[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择放置 1 子弹的[[枪械]]支援（剩余 ' + remaining + '）。',
          options: [{ id: 'stop', label: '停止分配' },
            ...firearms.map(asset => ({ id: asset.id, label: api.cardName(asset.code) }))],
        })
        if (id === 'stop') break
        const asset = firearms.find(item => item.id === id)
        if (!asset) break
        api.addAmmo(asset, 1)
        remaining--
      }
    },
  }],
  modifiers: [],
}
