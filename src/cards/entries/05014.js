// 05014 黑暗洞察
// 卡面：黛安娜·史丹利牌库专用。
// 卡面：快速。在你所在地点的一位调查员抽取一张遭遇卡牌或弱点时打出。
// 卡面：取消该卡牌的全部效果并将其洗回其牌库。(不抽取一张新卡牌以替换。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// simplified：遭遇牌库的抽取走 encounterDrawn 窗口（已实现）；从玩家牌库抽到弱点的通道
// 目前没有可取消的窗口（弱点抽到即结算），该分支登记在 remaining 里。

export default {
  code: '05014',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'encounterDrawn',
      label: '取消这次遭遇卡的显现并洗回牌库',
      resolve: ({ inv, api }) => {
        if (!api.cancelEncounterDraw(inv.seat, { shuffleBack: true })) {
          api.info('「黑暗洞察」：当前没有可以取消的遭遇卡。')
        }
      },
    },
  ],
  modifiers: [],
}
