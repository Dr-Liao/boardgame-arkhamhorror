// 09113 棒球棒（Baseball Bat）· 幸存者资产 · 2 经验 · 双手武器
// 卡面：[action]：攻击。你本次攻击得到 +2 [combat]。本次攻击造成 +1 伤害。
//       如果本次攻击期间揭示了 [skull] 或 [auto_fail] 符号，选择一项——
//       · 本次攻击后将棒球棒返回你的手牌。
//       · 本次攻击造成额外 +1 伤害。本次攻击后弃掉棒球棒。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
const code = '09113'

export default {
  code,
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
          assetId: source.id,
          noSpend: true,
          trackAssetSource: true,
          sourceCode: code,
          combatBonus: 2,
          damageBonus: 1,
        })
      },
    },
    {
      kind: 'forced',
      trigger: 'testEnds',
      label: '棒球棒的攻击完成后：选择返回手牌，或造成额外伤害并弃掉',
      criteria: [({ inv, source, state, context }) => context.seat === inv.seat
        && (context.source?.assetId ?? state.skillTest?.assetSourceId) === source.id
        && context.result?.drawn?.some(token => ['skull', 'autofail'].includes(token))],
      resolve: ({ state, inv, source, api, context }) => {
        const choice = api.choice({
          kind: 'effect', source: code, seat: inv.seat,
          prompt: '「棒球棒」：揭示了 [skull] 或 [auto_fail]，选择一项。',
          options: [
            { id: 'hand', label: '将棒球棒返回手牌' },
            { id: 'discard', label: '攻击额外造成 1 伤害，并弃掉棒球棒' },
          ],
        })
        if (choice === 'hand') {
          api.returnAssetToHand(inv.seat, source)
        } else {
          const id = state.skillTest?.target?.id ?? context.source?.enemyId
          const enemy = state.enemies.find(item => item.id === id && !item.defeated)
          if (context.result.success && enemy) api.damageEnemy(enemy, 1, inv.seat, { code })
          api.discardAsset(inv.seat, source)
        }
      },
    },
  ],
  modifiers: [],
}
