// 82036 诱拐 · 诡计（恐怖狂欢节）
// 卡面：显现 - 检定[意志](3)。若失败，你必须要么失去所有资源，要么选择并弃掉一张你控制的[[盟友]]资产。
// 读点：api.test + api.choose + api.loseResources / api.discardAsset（引擎既有资源/弃置入口）。
export default {
  code: '82036',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test?.(inv.seat, 'willpower', 3, result => {
      if (result?.success) return
      const allies = (inv.assets || []).filter(asset => {
        const traits = state.cards?.[asset.originalCode || asset.code]?.traits || asset.traits || []
        return traits.some(trait => String(trait).toLowerCase() === 'ally')
      })
      const options = [
        { id: 'resources', label: `失去所有资源（${Number(inv.resources) || 0}）` },
        ...allies.map(asset => ({ id: asset.id, label: `弃掉盟友「${asset.name || asset.code}」` })),
      ]
      const answer = api.choose?.({ kind: 'choice', seat: inv.seat, source: '82036',
        prompt: '诱拐：选择一项。', options })
      if (answer && answer !== 'resources') api.discardAsset?.(inv.seat, answer)
      else api.loseResources?.(inv.seat, Number(inv.resources) || 0)
      api.info?.('🎭 诱拐：你付出了代价。')
    })
    return true
  },
  note: '由 encounterResolve 结算：意志(3) 失败后二选一（失去所有资源 / 弃掉盟友资产）。',
}
