// 04216 有毒孢子
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：heart_of_the_elders
// 卡面：显现 - 附属到你所在地点。
// 卡面：强制 - 当一轮结束时：附属地点的每位中毒的调查员受到2点恐惧。附属地点的每位未中毒的调查员改为必须将放在一边的一张中毒弱点卡牌放置入场，放到其威胁区域。弃掉有毒孢子。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

const CODE = '04216'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api, { location }) {
    if (!location || !api.attachToLocation(location.id, { code: CODE })) return false
    api.info?.(`有毒孢子附属到「${location.name}」；本轮结束时结算。`)
    return { placed: true }
  },
  treacheryScript: {
    onAttachedLocationRoundEnd(state, location, attachment, api) {
      for (const inv of state.investigators) {
        if (inv.defeated || inv.resigned || inv.location !== location.id) continue
        if (api.isPoisoned(inv.seat)) api.horror(inv.seat, 2)
        else if (api.takeFromSetAside('04102')) api.poison(inv.seat)
      }
      api.detachEncounterAttachment(attachment)
      api.info?.(`有毒孢子：结算并弃掉「${location.name}」上的一张孢子。`)
    },
  },
}
