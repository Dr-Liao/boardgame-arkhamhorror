// 08620 备用零件（Spare Parts）· storyAsset
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   使用(3补给)。
//   [free]花费1补给并横置备用零件：在你所在地点的另一个支援上放置1补给，或者选择你所在地点的一位调查员获得1资源。
//
// 读点：free 描述子（玩家窗口 / legalMoves）；补给放置走 api.addUses（uses 是引擎的通用
// 计数器原语），资源走 api.gainResources。目标用 api.choice 现选。
export default {
  code: '08620',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'supplies',
  flags: { expedition: true },
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: '花费 1 补给并横置：给同地点的另一件支援放 1 补给，或让同地点一位调查员获得 1 资源',
    cost: { action: false, exhaust: true, uses: 1 },
    resolve: ({ state, inv, source, api }) => {
      const supplyAssets = (inv.assets || []).filter(asset => asset !== source
        && (asset.usesType === 'supplies' || asset.usesType === 'supply'))
      const investigators = (state.investigators || []).filter(other => other.location === inv.location
        && !other.defeated && !other.resigned)
      const options = [
        ...supplyAssets.map(asset => ({ id: `asset:${asset.id}`, label: `在「${api.cardName(asset.code)}」上放置 1 补给` })),
        ...investigators.map(other => ({ id: `resource:${other.seat}`, label: `${other.name} 获得 1 资源` })),
      ]
      if (!options.length) {
        api.info('🛠️ 备用零件：所在地点没有可放置补给或获得资源的其他目标。')
        return
      }
      const chosen = options.length === 1 ? options[0].id : api.choice({
        kind: 'target', source: '08620', seat: inv.seat,
        prompt: '备用零件：选择放置补给或获得资源的对象。', options,
      })
      const picked = options.find(option => option.id === chosen) || options[0]
      if (picked.id.startsWith('asset:')) {
        const asset = supplyAssets.find(item => picked.id === `asset:${item.id}`)
        if (asset) {
          api.addUses(asset, 1)
          api.info(`🛠️ 备用零件：在「${api.cardName(asset.code)}」上放置 1 补给。`)
        }
        return
      }
      const seat = Number(picked.id.slice('resource:'.length))
      api.gainResources(Number.isSafeInteger(seat) ? seat : inv.seat, 1)
      api.info('🛠️ 备用零件：一位调查员获得 1 资源。')
    },
  }],
}
