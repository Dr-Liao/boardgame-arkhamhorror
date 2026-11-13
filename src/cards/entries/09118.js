// 09118 命运无常（Fickle Fortune）· 幸存者事件 · 3 经验 · [[抉择]]
// 卡面：每轮最多 2 张[[抉择]]。
//       显现 - 你必须决定（选择一项）：
//         · 在当前密谋上放置 1 个毁灭标记。每位调查员治愈 3 点伤害和 3 点恐惧。
//         · 移除当前密谋上的 1 个毁灭标记。每位调查员受到 1 点直接伤害和 1 点直接恐惧。
//           将命运无常从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 手牌来源强制能力 + cardDrawn 窗口（与 09106 同一「显现」实现）；
//   · 毁灭：api.addDoom / api.removeDoom（密谋毁灭的唯一读点）；治疗：api.healDamage / healHorror；
//   · 直接伤害/恐惧：api.directDamage / directHorror；移出游戏：api.discardFromHand + api.exileCard。
// approximation: 「每轮最多 2 张抉择」按本卡每轮 2 次近似。
const code = '09118'

// 密谋毁灭记在 state.doom（addDoom/removeDoom 的唯一写点）；agenda 上的 doom 只是投影副本。
const currentDoom = state => Math.max(Number(state.doom) || 0, Number(state.agendas?.[state.agendaIndex]?.doom) || 0)

export default {
  code,
  note: 'approximation: 「每轮最多 2 张抉择」按本卡每轮 2 次近似（缺特质作用域上限）。',
  playCondition: [{ when: () => false, message: '「命运无常」具有显现，只能在抽到时结算' }],
  abilities: [
    {
      kind: 'forced',
      fromHand: true,
      noPlayCost: true,
      trigger: 'cardDrawn',
      limit: { scope: 'perRound', owner: 'investigator', count: 2 },
      label: '显现：二选一（放置毁灭并治疗，或移除毁灭并受到直接伤害/恐惧）',
      criteria: [({ inv, context }) => context?.cardCode === code && (inv.hand || []).includes(code)],
      resolve: ({ state, inv, api }) => {
        const owners = state.investigators.filter(owner => !owner.defeated && !owner.resigned)
        const choices = [{ id: 'place', label: '在当前密谋放置 1 毁灭；每位调查员治愈 3 伤害与 3 恐惧' }]
        if (currentDoom(state) > 0) {
          choices.push({ id: 'remove', label: '从当前密谋移除 1 毁灭；每位调查员受到 1 直接伤害与 1 直接恐惧，然后将本卡移出游戏' })
        }
        const choice = choices.length === 1 ? 'place' : api.choice({
          kind: 'effect', source: code, seat: inv.seat, prompt: '「命运无常」：选择一项。', options: choices,
        })
        api.discardFromHand(inv.seat, code)
        if (choice === 'remove') {
          api.removeDoom(1)
          for (const owner of owners) {
            api.directDamage(owner.seat, 1)
            api.directHorror(owner.seat, 1)
          }
          api.exileCard(code, { seat: inv.seat })
          api.info('🎲 「命运无常」：移除 1 毁灭；每位调查员受到 1 点直接伤害与 1 点直接恐惧，本卡移出游戏。')
          return
        }
        api.addDoom(1)
        for (const owner of owners) {
          api.healDamage(owner.seat, 3)
          api.healHorror(owner.seat, 3)
        }
        api.info('🎲 「命运无常」：放置 1 毁灭；每位调查员治愈 3 点伤害与 3 点恐惧。')
      },
    },
  ],
  modifiers: [],
}
