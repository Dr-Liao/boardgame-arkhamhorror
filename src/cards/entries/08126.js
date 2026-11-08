// 08126 厚重皮衣（Heavy Furs）
// 卡面：[reaction] 在你执行的一次技能检定中你揭示一个非[auto_fail]的符号混乱标记后，
//        对厚重皮衣造成 1 伤害：取消该混乱标记并将其返回混乱袋。揭示一个新的混乱标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 揭示时机用既有窗口 `tokenEffectWouldResolve`（07307 幸运骰同一时机）；
//   · 取消并重抽走 api.playerTools.rerollToken（引擎揭示循环会归还旧标记并揭示新标记）；
//   · 对支援自身造成伤害走 api.placeAssetHarm（含被击败判定）。
const code = '08126'
// 印刷「符号标记」= 除数字与 [auto_fail] 之外的标记；旧印同属符号。
const SYMBOL_TOKENS = ['skull', 'cultist', 'tablet', 'elderthing', 'eldersign']

export default {
  code,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'tokenEffectWouldResolve',
      label: '揭示非自动失败符号时：对厚重皮衣造成 1 伤害，取消并重抽',
      criteria: [({ inv, source, context }) => context?.seat === inv.seat
        && SYMBOL_TOKENS.includes(context?.token)
        && !context.rerollToken
        // 厚重皮衣印刷生命 2：已满伤害后不能再发动（避免弃置前重复触发）。
        && (source?.damage || 0) < 2],
      resolve: ({ source, context, api }) => {
        api.placeAssetHarm(source, { damage: 1 })
        api.playerTools.rerollToken(context, source.id)
        api.info('🧥 「厚重皮衣」：受到 1 点伤害，取消该混乱标记并重新揭示。')
      },
    },
  ],
  modifiers: [],
}
