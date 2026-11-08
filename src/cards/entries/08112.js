// 08112 「再来一张！」（"Hit me!"）
// 卡面：快速。你在技能检定期间揭示混乱标记后打出。
//        额外揭示一个混乱标记，并将其「-」变为「+」。如果该标记是[skull]，你自动失败。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation: 引擎没有「在本次检定里追加第二枚标记并把它计入」的读点（existing 只有
//   替换当前标记 tokenReveal / 额外揭示后二选一 extraChaosChoices）。本实现用 tokenReveal 窗口
//   的替代标记通道近似：额外揭示 1 枚标记，把负值取正后作为替代标记结算（骷髅 → 自动失败）。
//   与印刷的差异：原标记被替代而不是「两枚都计入」。主效果（额外揭示、负转正、骷髅自动失败）保留。
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
        const extra = api.revealChaosTokens(1)[0]
        if (extra == null) {
          api.info('「再来一张！」：混乱袋里没有可额外揭示的标记。')
          return
        }
        // 「-」变「+」：负数标记取正；骷髅直接改为自动失败。
        const flipped = /^-\d+$/.test(extra) ? `+${extra.slice(1)}` : extra === 'skull' ? 'autofail' : extra
        context.replacementToken = flipped
        api.info(`💥 「再来一张！」：额外揭示 ${api.tokenLabel(extra)}，`
          + (flipped === 'autofail' ? '骷髅标记 → 本次检定自动失败。' : `改为 ${api.tokenLabel(flipped)}。`))
      },
    },
  ],
  modifiers: [],
}
