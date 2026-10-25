// 05119 恐怖图腾
// 卡面：[reaction]在你将卡牌投入技能检定后，横置恐怖图腾：你选择该卡牌已有的任意一个技能图标，
// 该卡牌额外获得该图标。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：时机是「投入结束后、揭示标记前」，引擎的玩家窗口是 test.afterCommit（tests.js 在投入循环之后开窗）。
// 刚投入的卡牌在 state.skillTest.committed 里（{ seat, code, icons }），取本人最后投入的一张；
// 额外图标用 api.addPendingTestBonus(1) 记进本检定的待决加值（tests.js 在窗口结束后加到检定值），
// 只有所选图标与本次检定技能匹配（或万能图标）时才实际 +1。

function skillListOf(test) {
  const skill = test?.skill
  return Array.isArray(skill) ? skill : [skill]
}

export default {
  code: '05119',
  abilities: [
    {
      kind: 'reaction', trigger: 'committedCard',
      label: '横置：你刚投入的卡牌额外获得 1 个它已有的技能图标',
      cost: { exhaust: true },
      criteria: [({ state, inv, context }) => context?.seat === inv.seat
        && Boolean(context?.cardCode) && (state.skillTest?.committed || []).length > 0],
      resolve: ({ state, inv, context, api }) => {
        const code = context?.cardCode
        if (!code) return
        const icons = Object.entries(api.cardIcons(code) || {}).filter(([, count]) => count > 0)
        if (!icons.length) { api.info(`「${api.cardName(code)}」没有技能图标。`); return }
        const skills = skillListOf(state.skillTest)
        const useful = icons.filter(([icon]) => icon === 'wild' || skills.includes(icon))
        const pool = useful.length ? useful : icons
        const chosen = pool.length === 1 ? pool[0][0]
          : api.choice({ kind: 'effect', source: '05119', seat: inv.seat,
            prompt: '恐怖图腾：选择该卡牌已有的一个技能图标，它额外获得该图标。',
            options: pool.map(([icon]) => ({ id: icon, label: icon })) })
        const icon = pool.find(([name]) => name === chosen)?.[0] || pool[0][0]
        // R6：把额外图标真正记到本次检定（引擎追加到投入区，而非折算成 pendingBonus）。
        api.addCommittedCardIcons(inv.seat, 1)
        api.info(`恐怖图腾：「${api.cardName(code)}」额外获得 1 个 ${icon} 图标。`)
      },
    },
  ],
  modifiers: [],
}
