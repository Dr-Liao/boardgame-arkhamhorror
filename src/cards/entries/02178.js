// 02178 跨越时空
// 卡面：显现 - 弃掉你牌库顶3张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02178 梦魇：入场时弃掉牌库顶 3 张。

export default {
  code: '02178',
  implemented: true,
  encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    api.discardTopOfDeck(inv.seat, 3)
    return false
  },
  abilities: [
    {
      // P1：卡面只有显现效果，结算后应进弃牌堆；旧 type:'threat' 让 deck-ops
      // 误以为已放入威胁区，结果这张牌从所有区域消失。
      kind: 'weakness', label: '梦魇：弃掉牌库顶 3 张', weakness: { type: 'discardAfterResolve' },
      resolve: ({ inv, api }) => { api.scenarioDiscardTop(inv.seat, 3) },
    },
  ],
  modifiers: [

  ],
}
