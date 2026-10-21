// 04035 雅沃托
// 卡面：[free]横置雅沃托：在本次技能检定期间，你每项技能得到加成，加成的点数等于你弃牌堆顶上的一张卡牌的对应技能图标数([wild]图标不计算在内)。
// 卡面：[free]：弃掉你牌库顶的一张卡牌。(每阶段仅限一次。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04035 雅沃托：横置按弃牌堆顶图标加值；每阶段一次弃掉牌库顶。

export default {
  code: '04035',
  abilities: [
    {
      kind: 'free', label: '横置：按弃牌堆顶卡牌的匹配图标加值',
      cost: { action: false, exhaust: true }, duringOwnSkillTest: true,
      resolve: ({ state, inv, api }) => {
        const top = (inv.discard || []).at(-1)
        const skill = state.skillTest?.skill
        if (!top || !skill) return api.info('弃牌堆没有可用于加值的卡牌。')
        const icons = Number(api.cardIcons(top)[skill] || 0)
        api.addPendingTestBonus(icons)
        api.info(`「${api.cardName('04035')}」：弃牌堆顶「${api.cardName(top)}」提供 ${icons} 点加值。`)
      },
    },
    {
      kind: 'free', label: '弃掉牌库顶（每阶段一次）', cost: { action: false },
      limit: { scope: 'perPhase', owner: 'instance' },
      resolve: ({ inv, api }) => {
        if (!inv.deck.length) return api.info('牌库已空。')
        api.discardTopOfDeck(inv.seat, 1)
      },
    },
  ],
  modifiers: [

  ],
}
