// 02084 帷幕彼端
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：sorcery
// 卡面：涌动。
// 卡面：显现 - 如果你的威胁区域没有帷幕彼端，将帷幕彼端放置入场，放到你的威胁区域。
// 卡面：强制 - 如果你的牌库没有卡牌：受到10点伤害并弃掉帷幕彼端。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02084', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'], flags: { deckEmptiedRemove: true },
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const exists = inv.threat.some(t => t.code === code)
    if (!exists) api.threat(inv.seat, code)
    // 牌库为空的强制（原 encounter-rules.deckEmptied）：弃掉本卡并受到 10 点伤害。
    if (!inv.deck?.length && !inv.defeated && !inv.resigned) {
      const index = inv.threat.findIndex(t => t.code === code)
      if (index >= 0) {
        inv.threat.splice(index, 1)
        state.encounterDiscard.push(code)
        api.damage(inv.seat, 10)
      }
    }
    api.drawEncounter(inv.seat)
    return { placed: !exists, surgeHandled: true }
  },
}
