// 04158 追忆未来
// 卡面：[reaction]在你正在执行的技能检定开始时，如果追忆未来处于重整状态，指定一个混乱标记：如果本次技能检定期间揭示了指定的混乱标记，横置追忆未来。然后，你本次技能检定得到+2技能值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04158 追忆未来：检定开始时指定一个混乱标记（命中时横置并 +2）。
// 5c-18：指定标记走 api.nameChaosToken；「命中后横置 +2」的读点仍在引擎的标记揭示段。

export default {
  code: '04158',
  abilities: [
    {
      kind: 'reaction', trigger: 'testBegins', id: 'recallTheFuture', legacyReaction: true,
      criteria: { selfOnly: true }, label: '检定开始时指定混乱标记',
      resolve: ({ inv, source, api }) => { api.nameChaosToken(inv.seat, { asset: source }) },
    },
  ],
  modifiers: [

  ],
}
