// 09121 精益求精（Refine）· 中立事件 · 0 经验 · [[补给]] [[双重]]
// 卡面：作为打出精益求精的额外费用，花费一个行动。
//       立刻勾选一张归你所有的定制卡牌升级卡上的一个方框，即便该卡牌不在场上。
//       每场游戏每位调查员最多一次。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「归你所有」= 手牌 / 牌库 / 弃牌堆 / 场上的支援（只读四个区域）；
//   · 勾选：api.tsk.customizable.options / checked / upgrade（P2 定制原语；upgrade 只校验不扣经验，
//     本卡「立刻勾选、不付经验」正好用它，availableXp 传本次新增格数）；
//   · 每场游戏一次：campaign.records 的 `refine:<seat>` 记账（泛型记录写点，不新造状态字段）；
//   · 额外花费 1 行动：playCondition 要求至少 2 行动，resolve 里 api.loseActions(1)。
//
// P1-8（2026-11-13）：第三条 playCondition 旧实现 `when: ({...}) => inv.hand?.length || ...` 返回数字，
//   而引擎按 `item.when(ctx) === true` 严格判真（play-condition.js:124）→ 恒假、卡牌永远打不出。
//   改为布尔判定（数组长度 > 0）。
const code = '09121'

const recordKey = seat => `refine:${seat}`

const ownedCustomizable = (state, inv, api) => {
  const codes = new Set([
    ...(inv.hand || []), ...(inv.deck || []), ...(inv.discard || []),
    ...(inv.assets || []).map(asset => asset.code),
  ])
  return [...codes].filter(cardCode => api.tsk.customizable.options(cardCode))
}

export default {
  code,
  playCondition: [
    { when: ({ state, inv }) => !state.campaign?.records?.[recordKey(inv.seat)],
      message: '「精益求精」每场游戏每位调查员只能打出一次' },
    { when: ({ state, inv }) => (inv.actionsLeft || 0) >= 2,
      message: '「精益求精」需要额外花费 1 个行动（打出共需 2 个行动）' },
    { when: ({ state, inv }) => ((inv.hand?.length || 0) + (inv.deck?.length || 0)
        + (inv.discard?.length || 0) + (inv.assets?.length || 0)) > 0,
      message: '「精益求精」需要你拥有一张定制卡牌' },
  ],
  abilities: [
    {
      kind: 'played',
      label: '额外花费 1 行动：勾选一张你拥有的定制卡的一个方框',
      resolve: ({ state, inv, api }) => {
        api.loseActions(inv.seat, 1)
        const cards = ownedCustomizable(state, inv, api)
        if (!cards.length) { api.info('「精益求精」：你没有可勾选的定制卡牌。'); return }
        const chosen = cards.length === 1 ? cards[0] : api.choice({
          kind: 'card', source: code, seat: inv.seat,
          prompt: '「精益求精」：选择要勾选的定制卡牌。',
          options: cards.map(cardCode => ({ id: cardCode, cardCode, label: api.cardName(cardCode) })),
        })
        if (!chosen) return
        const options = api.tsk.customizable.options(chosen) || []
        const previous = api.tsk.customizable.checked(inv.seat, chosen)
        const available = []
        for (const [index, option] of options.entries()) {
          const used = previous.filter(item => item === index).length
          if (used >= option.checks) continue
          available.push({ id: String(index), label: `${option.name}（${used + 1}/${option.checks}）` })
        }
        if (!available.length) { api.info(`「精益求精」：「${api.cardName(chosen)}」已经勾满。`); return }
        const answer = api.choice({
          kind: 'effect', source: code, seat: inv.seat,
          prompt: `「精益求精」：勾选「${api.cardName(chosen)}」的一个方框。`, options: available,
        })
        const index = Number(answer)
        if (!Number.isInteger(index) || !options[index]) return
        api.tsk.customizable.upgrade({
          seat: inv.seat, code: chosen, checked: [...previous, index], availableXp: 1,
        })
        api.setCampaignRecord(recordKey(inv.seat), true)
        api.info(`🛠️ 「精益求精」：${inv.name} 立刻勾选「${api.cardName(chosen)}」的「${options[index].name}」方框（每场游戏一次）。`)
      },
    },
  ],
  modifiers: [],
}
