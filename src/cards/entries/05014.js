// 05014 黑暗洞察
// 卡面：黛安娜·史丹利牌库专用。
// 卡面：快速。在你所在地点的一位调查员抽取一张遭遇卡牌或弱点时打出。
// 卡面：取消该卡牌的全部效果并将其洗回其牌库。(不抽取一张新卡牌以替换。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 第六轮修复（2026-10-25）：两个「抽取」分支都已实现（引擎的快速事件通道对每张卡
// 只取一个 kind:'played' 描述子——src/engine/encounter.js 的 reactionWindow 用
// descriptorOfKind(code,'played')——因此两个窗口合并进同一条描述子的 trigger 数组）：
//   · 遭遇卡：encounterDrawn 窗口 + api.cancelEncounterDraw(seat,{shuffleBack:true})（不重抽）；
//   · 玩家牌库弱点：引擎新增 cardWouldBeDrawn 窗口（src/engine/deck-ops.js:366-378，context 带
//     seat/location/cardCode/weakness:true/from:'deck'），描述子在该窗口写 context.cancelled = true，
//     引擎随后把弱点洗回牌库并跳过结算（不抽取替换牌）。
// 「在你所在地点的一位调查员」由 criteria 校验 context.location 与本人所在地点一致。

export default {
  code: '05014',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: ['encounterDrawn', 'cardWouldBeDrawn'],
      label: '取消这张遭遇卡/弱点并洗回牌库（不重抽）',
      criteria: [({ inv, context }) => context?.when !== 'cardWouldBeDrawn'
        || (Boolean(context?.weakness) && context?.location === inv.location)],
      resolve: ({ inv, context, api }) => {
        if (context?.when === 'cardWouldBeDrawn') {
          if (!context?.weakness) return
          context.cancelled = true
          api.info(`🛡️ 「黑暗洞察」取消了抽到的弱点「${api.cardName(context.cardCode)}」，并将其洗回牌库。`)
          return
        }
        if (!api.cancelEncounterDraw(inv.seat, { shuffleBack: true })) {
          api.info('「黑暗洞察」：当前没有可以取消的遭遇卡。')
        }
      },
    },
  ],
  modifiers: [],
}
