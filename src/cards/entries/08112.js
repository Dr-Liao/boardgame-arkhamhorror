// 08112 「再来一张！」（"Hit me!"）
// 卡面：快速。你在技能检定期间揭示混乱标记后打出。
//        额外揭示一个混乱标记，并将其「-」变为「+」。如果该标记是[skull]，你自动失败。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 额外标记由技能检定的揭示循环结算，保留原先揭示的标记。
const code = '08112'

export default {
  code,
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'tokenReveal',
      label: '额外揭示 1 枚标记（负转正；骷髅则自动失败）',
      criteria: [({ state, inv }) => state.skillTest?.seat === inv.seat],
      resolve: ({ state, inv, context, api }) => {
        if (!state.skillTest || context?.when !== 'tokenReveal') return
        api.playerTools.revealAdditionalTestToken({ flipSign: true, autoFailOn: ['skull'] })
      },
    },
  ],
  modifiers: [],
}
