// 06132 伊伯遗迹（theSearchForKadath）· 地点（米纳尔 / 古代 / 遗迹，掩藏，线索1，帷幕1，胜利1）
// 卡面：掩藏。
// 卡面：强制 - 在你调查伊伯遗迹时揭示[skull]或[cultist]标记后：弃掉一个你控制的支援。
//
// 一卡一文件：规则数据在这里声明；章节 behavior 的 afterTest 读取并接线。
export default {
  code: '06132', scope: 'location', implemented: true,
  locationRule: {
    afterTest(state, location, inv, result, api) {
      if (String(result.source?.label || '') !== '调查') return
      const token = String(result.token || '')
      if (token !== 'skull' && token !== 'cultist') return
      const assets = [...(inv.assets || [])]
      if (!assets.length) return
      const answer = api.choose?.({
        kind: 'target', source: '06132', seat: inv.seat,
        prompt: '伊伯遗迹：你揭示[skull]或[cultist]标记——弃掉一个你控制的支援。',
        options: assets.map(asset => ({ id: asset.id, label: asset.name || asset.code })),
      }) ?? assets[0].id
      const chosen = assets.find(asset => asset.id === String(answer)) || assets[0]
      api.discardAsset?.(inv.seat, chosen.id)
      api.info?.(`🗿 伊伯遗迹：${inv.name} 弃掉「${chosen.name || chosen.code}」。`)
    },
  },
}
