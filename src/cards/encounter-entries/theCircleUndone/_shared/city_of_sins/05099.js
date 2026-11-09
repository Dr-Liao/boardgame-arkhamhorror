// 05099 百年秘事
// 归属：战役共用 · theCircleUndone；遭遇组：city_of_sins
// 卡面：显现 - 检定[willpower](5)。你检定失败且每低于难度 1 点，弃掉遭遇牌库顶 1 张卡牌。
//   如果本效果弃掉了[[诅咒]]诡计，对你的调查员和你的每个[[盟友]]支援造成 1 点直接伤害。
//
// 简化/近似：弃遭遇牌库顶时不结算被弃卡牌的显现/生成（与参考实现的
// discardTopOfEncounterDeckAndHandle 不同；本仓库没有「弃牌并结算」的通用入口），
// 记入 status.json 的 gaps。

import { ALL_CARDS, hasTrait } from '../../../_shared.js'

export default {
  code: '05099',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    let failedBy = 0
    api.test(inv.seat, 'willpower', 5, result => {
      if (result.success) return
      failedBy = Math.max(0, (result.difficulty ?? 5) - (result.value ?? 0))
    })
    if (failedBy <= 0) return false
    // 弃遭遇牌库顶 N 张走引擎弃顶入口（牌库空时自动把弃牌堆洗回，与抽牌补牌口径一致）。
    const discarded = api.discardEncounterTop?.(failedBy, { reshuffle: true }) || []
    const labels = discarded.map(code => ALL_CARDS[code]?.nameZh || code).join('、') || '无'
    api.info?.(`百年秘事：检定失败 ${failedBy} 点，弃掉遭遇牌库顶 ${discarded.length} 张（${labels}）。`)
    const cursed = discarded.some(code => ALL_CARDS[code]?.type === 'treachery' && hasTrait(ALL_CARDS[code], 'Curse'))
    if (!cursed) return false
    api.info?.('弃掉了诅咒诡计：调查员与其每个盟友支援各受到 1 点直接伤害。')
    api.directDamage(inv.seat, 1)
    for (const asset of inv.assets || []) {
      if (asset.type === 'asset' || ALL_CARDS[asset.code]?.type === 'asset') {
        if (hasTrait(ALL_CARDS[asset.code], 'Ally')) api.damageAsset(inv.seat, asset.id, 1)
      }
    }
    return false
  },
}
