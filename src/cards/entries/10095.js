// 10095 身受诅咒（Accursed）· 潜修者 · 技能 · 万能图标 · 天赋/诅咒
// 卡面：
//   在你将身受诅咒投入技能检定时，在混乱袋中加入最多 3 个[curse]标记。
//   本次技能检定期间，将揭示的每个[curse]标记的修正值视为 0。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「投入时加入最多 3 个诅咒」→ commit 描述子的 skill.onCommit（tests.js 在「确实投入了这张牌」之后
//     调用，api 是真实能力面）；加入走 api.chaosTokens.add('curse', n, { exact: true })
//     （chaos-token-pool 的上限/精确读点），上限用 api.chaosTokens.room('curse')。
//   · 「本次检定期间每个诅咒标记的修正视为 0」→ commit 描述子的 skill.tokenModifiers: { curse: 0 }
//     （tests.js#resolveChaosToken 的唯一读点：投入区里的技能牌可以覆盖标记修正；
//     与 07115「祝福/诅咒 +1」同一字段）。
export default {
  code: '10095',
  name: '身受诅咒',
  abilities: [
    {
      kind: 'commit',
      label: '投入时加入至多 3 个诅咒标记；本次检定把每个诅咒标记的修正视为 0',
      skill: {
        tokenModifiers: { curse: 0 },
        onCommit: ({ inv, api }) => {
          const room = Math.min(3, api.chaosTokens.room('curse'))
          if (room <= 0) return
          const amount = room === 1 ? 1 : Number(api.choice({
            kind: 'effect', source: '10095', seat: inv.seat,
            prompt: `「身受诅咒」：在混乱袋中加入几个[curse]标记（0-${room}）？`,
            options: Array.from({ length: room + 1 }, (_, index) => ({
              id: String(index),
              label: index === 0 ? '不加入诅咒标记' : `加入 ${index} 个诅咒标记`,
            })),
          }))
          const count = Number.isFinite(amount) ? Math.max(0, Math.min(room, amount)) : 0
          if (!count) return
          if (api.chaosTokens.add('curse', count, { exact: true }) === count) {
            api.info(`🌑 「身受诅咒」：在混乱袋中加入 ${count} 个[curse]标记（本次检定其修正视为 0）。`)
          }
        },
      },
    },
  ],
  modifiers: [],
}
