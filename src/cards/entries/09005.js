// 09005「手术锯」（Bonesaw）· 支援 · 文森特专属签名
// 卡面：文森特牌库专用。
//   [action] 攻击。本次攻击 +2 [combat]。若成功，你可以承受 1 点伤害，使本次攻击 +1 伤害。
//   [action] 治疗同地点一位调查员 5 点伤害。检定 [intellect] (4)。若失败，该调查员承受 1 点物理创伤。
//   （每局游戏一次）
//
// 注：攻击的「可选自伤换 +1 伤害」以固定 +1 伤害结算（自伤为可选成本，approx）。
export default {
  code: '09005',
  uses: 1,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '攻击：+2 战斗，+1 伤害',
      cost: { action: true },
      effect: { type: 'fight', combatBonus: 2, damageBonus: 1 },
    },
    {
      kind: 'action',
      label: '治疗同地点调查员 5 点伤害并检定智识(4)；失败其受 1 点物理创伤（每局一次）',
      cost: { action: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const candidates = api.investigatorsAt(inv.location)
        if (!candidates.length) return
        const target = candidates.length === 1 ? candidates[0] : candidates[Number(api.choice({
          kind: 'investigator', source: '09005', seat: inv.seat, prompt: '选择要治疗的调查员。',
          options: candidates.map(other => ({ id: String(other.seat), label: other.name })),
        }))]
        if (!target) return
        const result = api.test(inv.seat, 'intellect', 4, { source: '09005', target: { kind: 'investigator', id: String(target.seat) } })
        if (result?.success) {
          api.healDamage(target.seat, 5)
          api.info(`🩹 ${target.name} 被治疗 5 点伤害。`)
        } else {
          api.addTrauma(target.seat, 'physical', 1)
          api.info(`💔 检定失败：${target.name} 承受 1 点物理创伤。`)
        }
        void state
      },
    },
  ],
  modifiers: [],
}
