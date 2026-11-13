// 09608 惨遭夺舍（Body Snatched）· treachery
//
// 归属：关卡专用 · theScarletKeys/dancingMad（P7）。
// 卡面（中）：显现 - 检定[willpower](4)。如果你检定失败，选择一个你控制的[[盟友]]或[[道具]]支援，
//   将其放在一边，位于场外，作为一个空洞（如果你不能，改为受到2点恐惧）。
//
// 结算入口：`encounterResolve`（章节 behavior.resolveEncounter 分派；本卡是本章唯一的专属诡计）。
// 全部写入走 `ctx.api`：
//   · 检定：api.test(seat, 'willpower', 4, resolve, 0, { code, name, action: 'revelation' })
//   · 选择：api.choice（候选只来自本座位支援区的 [[盟友]]/[[道具]]）
//   · 空洞：api.mechanics.tsk.hollow.hollow（P2 原语；scope 必须是 investigator + 合法座位）
//   · 移出场外：api.removeAsset（支援离场的统一入口）
//   · 不能选择时：api.harm(seat, { horror: 2 })
export default {
  code: '09608',
  name: '惨遭夺舍',
  scope: 'treachery',
  implemented: true,
  note: '空洞写入走 api.mechanics.tsk.hollow.hollow；支援离场走 api.removeAsset；没有候选时改为 2 点恐惧。',
  encounterResolve(state, inv, card, api) {
    const code = '09608'
    if (typeof api?.test !== 'function') return false
    api.test(inv.seat, 'willpower', 4, result => {
      if (result?.success) {
        api.info?.(`🎭 惨遭夺舍：${inv.name} 的意志检定成功。`)
        return
      }
      const assets = (inv.assets || []).filter(asset => {
        const traits = asset?.traits || []
        return traits.includes('Ally') || traits.includes('Item')
      })
      if (!assets.length) {
        if (typeof api.harm === 'function') api.harm(inv.seat, { horror: 2 })
        api.info?.(`🎭 惨遭夺舍：${inv.name} 没有[[盟友]]或[[道具]]支援，受到 2 点恐惧。`)
        return
      }
      const chosenId = typeof api.choice === 'function' && assets.length > 1
        ? api.choice({
          kind: 'card', source: code, seat: inv.seat,
          prompt: '惨遭夺舍：选择一个你控制的[[盟友]]或[[道具]]支援，将其放在一边作为空洞。',
          options: assets.map(asset => ({
            id: String(asset.id), cardCode: asset.code || asset.originalCode, label: asset.name || String(asset.code),
          })),
        })
        : String(assets[0].id)
      const chosen = assets.find(asset => String(asset.id) === String(chosenId)) || assets[0]
      const hollow = api.mechanics?.tsk?.hollow
      if (!hollow) {
        // 运行时没有接线 TSK 原语时保守处理：按「不能选择」分支结算 2 点恐惧（不静默吞掉负担）。
        if (typeof api.harm === 'function') api.harm(inv.seat, { horror: 2 })
        api.info?.('🎭 惨遭夺舍：空洞原语不可用，改为受到 2 点恐惧。')
        return
      }
      hollow.hollow({ code: chosen.code || chosen.originalCode, source: code, scope: 'investigator', seat: inv.seat })
      if (typeof api.removeAsset === 'function') api.removeAsset(inv.seat, chosen.id)
      api.info?.(`🎭 惨遭夺舍：「${chosen.name || chosen.code}」放在一边，位于场外，作为空洞。`)
    }, 0, { code, name: '惨遭夺舍', action: 'revelation' })
    return true
  },
}
