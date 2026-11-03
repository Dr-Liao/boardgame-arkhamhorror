// 04041 被诅咒的命运
// 卡面：显现 - 受到2点恐惧。在剧本日志中，你的调查员取得的剧情支援/弱点下方，记录“时间到”。如果已经有此条记录，将被诅咒的命运从你的牌库中移除，查找收藏，找出丧钟敲响并将它放到你的牌库底。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04041 被诅咒的命运：显现由弱点描述子的 resolve 接管（读点 src/engine/weakness.js:51-55）。
// 战役记录与牌组替换由 progressWeakness 原语统一处理。

export default {
  code: '04041',
  upgradesFrom: 'impendingDoom',
  abilities: [
    {
      kind: 'weakness', label: '被诅咒的命运', weakness: { type: 'cursedFate' },
      resolve: ({ inv, api }) => {
        // 显现：受到 2 点恐惧（可分配给支援吸收）。
        api.horror(inv.seat, 2)
        const replaced = api.progressWeakness(inv.seat, {
          code: '04041', nextCode: '04042', recordKey: 'theHourIsNigh',
          counterKey: 'cursedFate', addedKey: 'theBellTollsAdded',
        })
        api.info(replaced
          ? '📜 已有“时间到”记录：移除被诅咒的命运，把「丧钟敲响」放到牌库底。'
          : '📜 剧本日志：在你的调查员取得剧情支援/弱点处记录“时间到”。')
      },
    },
  ],
  modifiers: [

  ],
}
