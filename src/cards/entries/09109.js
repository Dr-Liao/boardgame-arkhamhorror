// 09109 抉择时刻（At a Crossroads）· 幸存者事件 · 1 经验 · [[抉择]]
// 卡面：每轮最多 2 张[[抉择]]。
//       显现 - 选择一位调查员并决定（选择一项）：
//         · 所选调查员必须立即进行一次行动，如同是自己回合，然后随机弃掉自己 1 张手牌。
//         · 所选调查员在其下个回合期间失去 1 个行动，然后抽取 3 张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 手牌来源强制能力 + cardDrawn 窗口（与 09106 同一「显现」实现）；
//   · 立即行动：api.beginImmediateAction（引擎的跨回合即时行动原语，会开行动选择）；
//   · 随机弃牌：api.discardRandomFromHand；抽牌：api.drawCardsLogged。
// approximation: ①「每轮最多 2 张抉择」按本卡每轮 2 次近似；②「下个回合失去 1 个行动」没有
//   「下回合行动数」写点，改为立刻失去 1 个行动（若目标当前没有行动则不失去）。
const code = '09109'

export default {
  code,
  note: 'approximation: 「下个回合失去 1 个行动」改为立刻失去 1 个行动（缺下回合行动数写点）；「每轮最多 2 张抉择」按本卡每轮 2 次近似。',
  playCondition: [{ when: () => false, message: '「抉择时刻」具有显现，只能在抽到时结算' }],
  abilities: [
    {
      kind: 'forced',
      fromHand: true,
      noPlayCost: true,
      trigger: 'cardDrawn',
      limit: { scope: 'perRound', owner: 'investigator', count: 2 },
      label: '显现：选择一位调查员，立即行动后随机弃 1 张，或失去 1 行动后抽 3 张',
      criteria: [({ inv, context }) => context?.cardCode === code && (inv.hand || []).includes(code)],
      resolve: ({ state, inv, api }) => {
        const targets = state.investigators.filter(owner => !owner.defeated && !owner.resigned)
        if (!targets.length) { api.discardFromHand(inv.seat, code); return }
        const targetSeat = Number(targets.length === 1 ? targets[0].seat : api.choice({
          kind: 'investigator', source: code, seat: inv.seat,
          prompt: '「抉择时刻」：选择一位调查员。',
          options: targets.map(owner => ({ id: String(owner.seat), label: owner.name })),
        }))
        const target = state.investigators[targetSeat] || inv
        const choice = api.choice({
          kind: 'effect', source: code, seat: inv.seat,
          prompt: `「抉择时刻」：${target.name} 选择一项。`,
          options: [
            { id: 'act', label: '立即进行一次行动，然后随机弃 1 张手牌' },
            { id: 'draw', label: '失去 1 个行动，然后抽 3 张卡牌' },
          ],
        })
        if (choice === 'act') {
          api.beginImmediateAction(target.seat, { source: code })
          api.discardRandomFromHand(target.seat, 1)
          api.info(`🛤️ 「抉择时刻」：${target.name} 立即行动一次，然后随机弃掉 1 张手牌。`)
        } else {
          api.loseActions(target.seat, 1)
          api.drawCardsLogged(target.seat, 3)
          api.info(`🛤️ 「抉择时刻」：${target.name} 抽 3 张牌（失去 1 个行动）。`)
        }
        api.discardFromHand(inv.seat, code)
      },
    },
  ],
  modifiers: [],
}
