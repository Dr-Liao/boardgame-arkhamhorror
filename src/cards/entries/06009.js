// 06009 惊人的发现
// 卡面：显现 - 将惊人的发现混洗回你的牌库。(如果你不能这么做，改为将其弃掉并抽取遭遇牌库顶的卡牌。)
//       强制 - 在你查找牌库时，若查找过的卡牌中有本卡牌：将其弃掉。取消该次查找及其所有效果。
//       混洗被查找过的牌库。抽取遭遇牌库顶的卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：P6 原语 `searchedCardRule`（src/engine/deck-ops.js）——被查找到时弃掉自己、
// 取消这次查找并抽取 1 张遭遇卡；mode: 'forced' 表示不询问、直接结算。

export default {
  code: '06009',
  searchedCardRule: {
    mode: 'forced',
    label: '弃掉它，取消这次查找并抽 1 张遭遇卡',
    discard: true,
    cancelSearch: true,
    drawEncounter: true,
  },
  abilities: [
    {
      kind: 'weakness',
      label: '洗回牌库',
      weakness: { type: 'custom' },
      resolve: ({ inv, api }) => {
        api.scheduleWeaknessShuffle('06009')
        api.info(`${inv.name} 将「惊人的发现」混洗回牌库。`)
      },
    },
  ],
  modifiers: [],
}
