// 04099 毒蛇灾厄
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：venom
// 卡面：显现 - 将毒蛇灾厄放置入场，放到你的威胁区域。如果你已中毒，毒蛇灾厄获得涌动。
// 卡面：将你的每个非弱点[[道具]]支援的文本框(除[[特性]]外)视为空白。
// 卡面：强制 - 当一轮结束时：弃掉毒蛇灾厄。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04099', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
  encounterResolve(state, inv, card, api) {
    const poisoned = api.isPoisoned(inv.seat)
    api.threat(inv.seat, '04099', { blankItemAssets: true, forcedRoundEndDiscard: true })
    if (poisoned) api.drawEncounter(inv.seat, { surgeDraw: true })
    return true
  },
}
