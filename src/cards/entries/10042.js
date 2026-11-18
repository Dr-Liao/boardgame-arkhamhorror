// 10042 显微镜（Microscope）· 探寻者支援 · 手部槽 · [[道具]]/[[工具]]/[[科学]]
// 卡面：
//   [reaction] 你所在地点的敌人被成功躲避或击败后，横置显微镜：在显微镜上放置 1 资源，作为证据。
//   [action][action]：调查。显微镜上每有 1 证据，你本次调查得到 +1 [intellect]（最多 +3 [intellect]）。
//   如果你检定成功，你可以花费最多 2 证据，以额外发现你的地点同等数量的线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 证据 = 本卡实例上的 uses（usesType 'evidence'，与 09123 的贡品 / 06022 的充能同一套
//     uses/usesType 元数据；放置/花费走 api.addUses / api.spendUses）。
//   · 敌人被击败 = 窗口 defeatEnemy（enemies.js 在击败结算后开窗，context = { when, seat, location, enemy }）。
//     reactionWindow → openAbilityWindow 会枚举每位调查员的支援，因此「同地点的敌人被任何人击败」
//     都会给控制器一次窗口；横置费用保证同一次击败只结算一次。
//   · 敌人被躲避 = 窗口 evadeSuccess（combat.js 在躲避成功后开窗，context = { when, seat, location, enemy,
//     successBy }）。context.location 是躲避者的地点，因此按 context.enemy.location 判定「你的地点」。
//   · [action][action] = 描述子 cost { action: 2 }（与 08094/08096 同款；canAffordAbility 读同一份行动额度）。
//   · 「每 1 证据 +1 智识（最多 +3）」= api.investigate(seat, { bonus })（检定加值）；
//     「成功后最多花 2 证据换等量额外线索」= api.spendUses + api.discoverClue。
export default {
  code: '10042',
  name: '显微镜',
  uses: 0,
  usesType: 'evidence',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'defeatEnemy',
      id: 'microscopeEvidenceOnDefeat',
      label: '同地点敌人被击败后横置：放置 1 资源作为证据',
      cost: { exhaust: true },
      criteria: [({ inv, source, context }) => Boolean(source) && Boolean(context?.enemy)
        && context.location === inv.location],
      resolve: ({ source, api }) => {
        api.addUses(source, 1)
        api.info(`🔬 「显微镜」：在显微镜上放置 1 资源，作为证据（共 ${source.uses || 0} 个）。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'evadeSuccess',
      id: 'microscopeEvidenceOnEvade',
      label: '同地点敌人被成功躲避后横置：放置 1 资源作为证据',
      cost: { exhaust: true },
      criteria: [({ inv, source, context }) => Boolean(source) && Boolean(context?.enemy)
        && context.enemy.location === inv.location],
      resolve: ({ source, api }) => {
        api.addUses(source, 1)
        api.info(`🔬 「显微镜」：在显微镜上放置 1 资源，作为证据（共 ${source.uses || 0} 个）。`)
      },
    },
    {
      kind: 'action',
      id: 'microscopeInvestigate',
      label: '[action][action]：调查（每证据 +1 智识，最多 +3）；成功后最多花 2 证据额外发现等量线索',
      cost: { action: 2 },
      countsAs: 'investigate',
      resolve: ({ state, inv, source, api }) => {
        const bonus = Math.min(3, Number(source?.uses) || 0)
        const result = api.investigate(inv.seat, { bonus })
        if (!result?.success) return
        const card = (inv.assets || []).find(asset => asset.id === source?.id)
        if (!card) return
        const here = (state.locations || []).find(location => location.id === inv.location)
        const maxSpend = Math.max(0, Math.min(2, Number(card.uses) || 0, Number(here?.clues) || 0))
        if (maxSpend <= 0) return
        const options = Array.from({ length: maxSpend + 1 }, (_, index) => ({
          id: String(index),
          label: index === 0 ? '不花费证据' : `花费 ${index} 证据，额外发现 ${index} 个线索`,
        }))
        const amount = Number(api.choice({
          kind: 'effect', source: '10042', seat: inv.seat,
          prompt: `「显微镜」：最多可花费 ${maxSpend} 证据，额外发现等量线索。`,
          options,
        }))
        if (!Number.isFinite(amount) || amount <= 0) return
        api.spendUses(card, amount)
        api.discoverClue(inv.seat, amount, inv.location)
        api.info(`🔬 「显微镜」：花费 ${amount} 证据，额外发现 ${amount} 个线索。`)
      },
    },
  ],
  modifiers: [],
}
