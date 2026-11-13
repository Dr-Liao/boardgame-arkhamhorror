// 09633 积雪崩坍（Snowslide）· 诡计 · on_thin_ice
//
// 归属：关卡专用 · theScarletKeys/onThinIce（P7）。印刷 2 份，[[危险]]。
// 卡面（中）：显现 - 检定[敏捷](3)。如果你检定失败，你和你控制的每个有生命值的支援受到 1 点直接伤害。
//
// 结算入口：`encounterResolve`（章节 behavior.resolveEncounter 分派）。
// 全部写入走 `ctx.api`：
//   · 检定 = api.test（来源标成本卡）；
//   · 「你受到 1 点直接伤害」= api.directDamage（绕过支援吸收，与卡面的 direct 一致）；
//   · 「每个有生命值的支援受到 1 点直接伤害」= api.damageAsset（逐实例，不走伤害分配）。
export default {
  code: '09633',
  name: '积雪崩坍',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const code = '09633'
    api?.test?.(inv.seat, 'agility', 3, result => {
      if (result?.success) {
        api?.info?.(`❄️ ${inv.name || '调查员'} 躲开了积雪崩坍。`)
        return
      }
      if (typeof api?.directDamage === 'function') api.directDamage(inv.seat, 1)
      else api?.harm?.(inv.seat, { damage: 1 })
      // 「有生命值的支援」= 印刷 health > 0 的支援实例（引擎的支援生命值来自 cardDef.health）。
      const assets = (inv.assets || []).filter(asset => {
        const def = state?.cards?.[asset.code] || null
        const health = Number(def?.health ?? asset?.health ?? 0)
        return Number.isFinite(health) && health > 0
      })
      for (const asset of assets) {
        if (typeof api?.damageAsset === 'function') api.damageAsset(inv.seat, asset.id, 1)
      }
      api?.info?.(`❄️ 积雪崩坍：${inv.name || '调查员'} 与 ${assets.length} 个有生命值的支援各受 1 点直接伤害。`)
    }, 0, { code, name: '积雪崩坍', action: 'revelation' })
    void card
    return true
  },
  note: 'approximation: 「有生命值的支援」按实例/卡面 `health > 0` 过滤（`state.cards` 是开局派生的展示表，'
    + '缺失时回退实例字段）；支援的 1 点伤害逐实例走 `api.damageAsset`，不经过「伤害分配」的 soak 顺序。',
}
