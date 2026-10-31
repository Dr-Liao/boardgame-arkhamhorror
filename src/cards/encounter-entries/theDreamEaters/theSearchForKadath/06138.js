// 06138 无名遗迹（theSearchForKadath）· 地点（奥瑞巴 / 古代 / 遗迹，掩藏，线索1，帷幕5，胜利1）
// 卡面：掩藏。
// 卡面：强制 - 在你于无名遗迹结束你的回合后：对你控制的一个[[盟友]]支援造成1点直接伤害。
//
// 一卡一文件：规则在这里声明；章节 behavior.turnEnded 转发到 locationRule.onTurnEnd。
export default {
  code: '06138', scope: 'location', implemented: true,
  locationRule: {
    onTurnEnd(state, location, api, inv) {
      if (!inv || inv.location !== location.id) return
      const allies = (inv.assets || []).filter(asset =>
        (api.cardTraits?.(asset.originalCode || asset.code) || [])
          .some(trait => String(trait).toLowerCase() === 'ally'))
      if (!allies.length) return
      const answer = api.choose?.({
        kind: 'target', source: '06138', seat: inv.seat,
        prompt: '无名遗迹：回合结束——对你控制的一个[[盟友]]支援造成 1 点直接伤害。',
        options: allies.map(asset => ({ id: asset.id, label: asset.name || asset.code })),
      }) ?? allies[0].id
      const chosen = allies.find(asset => asset.id === String(answer)) || allies[0]
      api.damageAsset?.(inv.seat, chosen.id, 1)
      api.info?.(`🏚️ 无名遗迹：${inv.name} 的「${chosen.name || chosen.code}」受到 1 点直接伤害。`)
    },
  },
}
