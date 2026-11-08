// 08060 咏春棍（Dragon Pole）· 秘术师（Mystic）资产 · 双手。
//
// 卡面：你拥有 1 个额外的法术槽位。
//       [action]：攻击。你每有一个法术槽位有支援，你本次攻击得到 +1[combat]。
//       如果至少有 2 个法术槽位有支援，本次攻击 +1 伤害。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：add:slot 修正给额外法术槽；主技能检定用 api.fight 的 combatBonus / damageBonus 选项。
import { ALL_CARDS } from '../../cards/cards-data.js'

// 「法术槽位有支援」= 你控制的印刷槽位含 Arcane 的支援数（当前无动态占槽原语，按印刷槽位计）。
const filledArcaneSlots = inv => (inv.assets || []).filter(asset => /arcane/i.test(String(ALL_CARDS[asset.code]?.slot || ''))).length

export default {
  code: '08060',
  modifiers: [
    { target: 'add:slot', value: 'arcane' },
  ],
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      cost: { action: true },
      target: { kind: 'enemy' },
      label: '攻击：每有一个已填法术槽 +1[combat]；至少 2 个则 +1 伤害',
      resolve: ({ inv, target, api }) => {
        if (!target) return
        const filled = filledArcaneSlots(inv)
        api.fight(inv.seat, target.id, { combatBonus: filled, damageBonus: filled >= 2 ? 1 : 0 })
        api.info(`🥢 咏春棍：${filled} 个法术槽位有支援，本次攻击 +${filled}[combat]${filled >= 2 ? '、+1 伤害' : ''}。`)
      },
    },
  ],
}
