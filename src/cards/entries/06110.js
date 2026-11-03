// 06110 头班守夜
// 卡面：快速。在神话阶段的“抽取遭遇卡牌”步骤将要开始时打出。
//       不结算该步骤，改为查看遭遇牌库顶的X张卡牌，其中X等于调查员人数。
//       在任意数量的调查员之间分发这些卡牌，除你以外的每位调查员至多只能分发1张。
//       然后，每位调查员依次抽取发放给自己的卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06110 头班守夜：在 mythosEncounterStep 窗口打出，分配并抽取遭遇牌，替换普通抽牌步骤。

export default {
  code: '06110',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'mythosEncounterStep',
      criteria: [({ state }) => state.phase === 'mythos'
        && state.mythosEncounterReplacementRound !== state.round],
      label: '查看并分发遭遇牌，替换本次神话阶段的抽取步骤',
      resolve: ({ inv, api }) => {
        if (api.distributeMythosEncounterDraw(inv.seat))
          api.info(`「头班守夜」：${inv.name} 分发并依次抽取了本次神话阶段的遭遇牌。`)
      },
    },
  ],
  modifiers: [],
}
