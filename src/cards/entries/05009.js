// 05009 侦探的柯尔特1911式手枪
// 卡面：乔·戴蒙德牌库专用。使用(4子弹)。
// 卡面：你控制的最多2张[[工具]]支援不占用手部槽位。
// 卡面：[action]花费1子弹：攻击。你本次攻击得到+1[combat]并造成+1伤害。如果本次攻击击败了敌人，
//       你可以将你弃牌堆的一张[[洞察]]事件移动到你的直觉牌库底。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 修复（task-33）：「最多 2 张[[工具]]支援不占用手部槽位」现在由条目级 toolHandSlotsExempt: 2 声明，
// 读点是 src/engine/assets.js 的 slotUsage（2026-10-25 引擎新增）：统计手槽占用时按特性 [[工具]]
// 扣掉最多 2 个手部槽位，canEquip 的容量比较因此自动生效。
//
// 修复（2026-10-25 reaudit-h）：「如果本次攻击击败了敌人」改读 doFight 写入检定结果的
// `attackResult.defeated`（引擎在 defeatEnemy 之前判定，见 src/engine/combat.js:371-382），
// 不再用「攻击后目标不在 state.enemies」近似——后者对被击败后仍回场的敌人（如 05086 幽灵看守人）
// 会漏判。api.fight 的返回值经 performTest 返回的 result 透出 attackResult。

import { entryFlag } from './_shared.js'

export default {
  code: '05009',
  uses: 4,
  usesType: 'ammo',
  toolHandSlotsExempt: 2,
  abilities: [
    {
      kind: 'action',
      label: '射击（战斗 +1，伤害 +1；击败敌人可回收洞察事件）',
      cost: { action: true, uses: 1 },
      target: { kind: 'enemy' },
      resolve: ({ inv, api, state, targetId }) => {
        const enemy = state.enemies.find(item => item.id === targetId)
        if (!enemy) return
        const result = api.fight(inv.seat, enemy.id, { combatBonus: 1, damageBonus: 1 })
        // 「如果本次攻击击败了敌人」：读引擎 doFight 写入检定结果的 r.attackResult
        // （src/engine/combat.js:371-382：defeated 在 defeatEnemy 之前判定，因此「被击败后
        // 回到场上」的敌人（如 05086）也会被正确记为击败）；不再用 state.enemies.includes 近似。
        if (!result?.attackResult?.defeated) return
        const insights = api.hunchDeck.insightsInDiscard(inv)
        if (!insights.length) return
        const answer = api.choice({
          kind: 'card', source: '05009', seat: inv.seat, canSkip: true,
          prompt: '本次攻击击败了敌人：是否把弃牌堆的一张[[洞察]]事件放到直觉牌库底？',
          options: [{ id: 'skip', label: '不移动' },
            ...insights.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) }))],
        })
        if (answer === 'skip') return
        const chosen = insights[Number(answer)]
        if (chosen) api.hunchDeck.moveToBottom(inv, chosen)
      },
    },
  ],
  modifiers: [],
}
