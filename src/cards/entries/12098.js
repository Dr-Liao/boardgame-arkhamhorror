// 12098 金甲虫（The Gold Bug）· 中立 · 支援/道具/遗物/炼金/诅咒 · 基础弱点。
//
// 卡面：
//   显现 - 将金甲虫放置入场，位于你的威胁区域。除非通过以下 [action] 能力，否则它不能离场。
//   你得到 -1 生命值和 -1 神智值。
//   [action]：将金甲虫混洗入你的牌库。
//
// 引擎读点（批次 3 · B2 原语落地后）：
//   · 显现：weakness 描述子的 `{ type: 'threat', healthModifier: -1, sanityModifier: -1 }`
//     （weakness.js 放进威胁区域；getMaxHealth/getMaxSanity 从 getThreatEffect 读这两个修正）。
//   · 「不能离场」：条目级 `cannotLeavePlay: true`，读点 src/engine/harm-threat.js#removeThreat
//     （除 force 外的任何离场路径拒绝，如 api.moveCard 从威胁区移动）。
//   · [action]：威胁区卡的 action 描述子经 assetEffect 折叠进 legalMoves（controlledAbilityCards
//     包含威胁区卡）。「混洗入你的牌库」是印刷允许的例外：先 api.discardSelf(code)
//     （按能力来源卡直接移出威胁区 = 强制移除，绕过 removeThreat 守卫），
//     再用 api.moveCard(弃牌堆 → 牌库顶) + api.shuffleDeck 完成「混洗入牌库」。

const code = '12098'

export default {
  code,
  cannotLeavePlay: true,
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入你的威胁区域；你得到 -1 生命值和 -1 神智值',
      weakness: { type: 'threat', healthModifier: -1, sanityModifier: -1 },
    },
    {
      kind: 'action',
      label: '将金甲虫混洗入你的牌库',
      cost: { action: true },
      resolve: ({ inv, api }) => {
        api.discardSelf(code)
        api.moveCard({ code, from: 'discard', to: 'deckTop' }, { seat: inv.seat })
        api.shuffleDeck(inv.seat)
        api.info(`${inv.name} 将「${api.cardName(code)}」混洗入牌库。`)
      },
    },
  ],
  modifiers: [],
}
