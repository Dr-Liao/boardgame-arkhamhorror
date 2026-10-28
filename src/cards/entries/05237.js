// 05237 幸运或是注定（幸存者 · 2 经验）
// 卡面：快速。在毁灭标记将要放到任意冒险卡牌上时打出。
// 卡面：每场游戏最多1张。
// 卡面：取消将要放到该卡牌上的1个毁灭标记。放逐幸运或是注定。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05237 幸运或是注定：走引擎 doomPlaced 窗口——
//   · 卡上毁灭：placeDoomOnCard 写入后开窗（context.card）；
//   · 密谋/议程毁灭：addDoom 写入后开窗（context.card=null, agenda=true；R7 修复 hasDoomPlaced 的数组 trigger 预检）。
// 内容用 api.cancelDoomPlacement(card) 撤销刚放的 1 点（card 为 null 时取消 state.doom 1 点；原语在
// scenarioRuntime，abilityApi 未透传/返回 0 时按同一语义回退）。快速打出（fast+trigger 的 played 描述子即
// reactionOnly，只能在该窗口打出）、放逐自身由 playReactionCard 的 exileAfterPlay 口径处理；团队级
// 「每场游戏 1 张」用所有调查员的 gameFlags.fortuneOrFate 记账。

export default {
  code: '05237',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'doomPlaced',
      exileAfterPlay: true,
      criteria: [({ state, context }) => {
        if (state.investigators.some(owner => owner.gameFlags?.fortuneOrFate)) return false
        if (context?.card) return Number(context.card.doom || 0) > 0
        return Boolean(context?.agenda)
      }],
      label: '取消刚放到该卡牌/密谋上的 1 点毁灭并放逐自身',
      resolve: ({ inv, api, context }) => {
        const card = context?.card
        const removed = card
          ? api.removeDoomFromCard(card, 1)
          : (context?.agenda ? api.removeDoom(1) : 0)
        if (!removed) return
        api.setGameFlag(inv.seat, 'fortuneOrFate')
        api.info(`🌑 ${inv.name} 用「幸运或是注定」取消了刚放置的 ${removed} 点毁灭。`)
      },
    },
  ],
}
