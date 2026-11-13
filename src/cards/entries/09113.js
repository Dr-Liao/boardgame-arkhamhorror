// 09113 棒球棒（Baseball Bat）· 幸存者资产 · 2 经验 · 双手武器
// 卡面：[action]：攻击。你本次攻击得到 +2 [combat]。本次攻击造成 +1 伤害。
//       如果本次攻击期间揭示了 [skull] 或 [auto_fail] 符号，选择一项——
//       · 本次攻击后将棒球棒返回你的手牌。
//       · 本次攻击造成额外 +1 伤害。本次攻击后弃掉棒球棒。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 攻击：api.fight（assetId/combatBonus/damageBonus/onSuccess 与「枪法如神」同一 doFight 管线）；
//   · 符号判定：onSuccess 在伤害结算前拿到 result.drawn；
//   · 额外 +1 伤害：onSuccess 里改 opts.damageBonus（doFight 在回调之后才计算武器加值）；
//   · 返回手牌 / 弃掉：api.returnAssetToHand / api.discardAsset。
// approximation: 印刷要求「攻击后」再选择返回/弃置，这里在成功结算的对话里先选择（仍是本次攻击内、
//   伤害结算之前）；失败时不提供选择（与参考实现一致）。
const code = '09113'

export default {
  code,
  note: 'approximation: 返回/弃置的选择在伤害结算前完成（印刷为攻击后）；失败时不提供该选择。',
  abilities: [
    {
      kind: 'action',
      label: '攻击：+2 战斗、+1 伤害；骷髅/自动失败时可返回手牌或 +1 伤害并弃掉',
      countsAs: 'fight',
      cost: { action: true },
      target: { kind: 'enemy' },
      resolve: ({ inv, source, target, api }) => {
        if (!target?.entity) return
        api.fight(inv.seat, target.entity.id, {
          assetId: source?.id,
          sourceCode: code,
          combatBonus: 2,
          damageBonus: 1,
          onSuccess: ({ result, opts }) => {
            const faces = result?.drawn || []
            if (!faces.includes('skull') && !faces.includes('autofail')) return
            const choice = api.choice({
              kind: 'effect', source: code, seat: inv.seat,
              prompt: '「棒球棒」：揭示了 [skull]/[auto_fail]，选择一项。',
              options: [
                { id: 'hand', label: '本次攻击后将棒球棒返回你的手牌' },
                { id: 'discard', label: '本次攻击造成额外 +1 伤害，然后弃掉棒球棒' },
              ],
            })
            if (choice === 'hand') {
              api.returnAssetToHand(inv.seat, source)
              api.info(`🏏 「棒球棒」：本次攻击后返回 ${inv.name} 的手牌。`)
            } else {
              opts.damageBonus = (opts.damageBonus || 0) + 1
              api.discardAsset(inv.seat, source)
              api.info(`🏏 「棒球棒」：本次攻击额外 +1 伤害，随后被弃掉。`)
            }
          },
        })
      },
    },
  ],
  modifiers: [],
}
