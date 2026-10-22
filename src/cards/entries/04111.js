// 04111 坚韧不拔
// 卡面：快速。在你将被分配伤害和/或恐惧，且其数值足够击败你时打出。
// 卡面：取消该伤害和/或恐惧中的最多4点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04111 坚韧不拔

export default {
  code: '04111',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'harmDealt',
      criteria: Object.assign([
        ({ inv, context }) => context?.seat == null || inv?.seat == null || context.seat === inv.seat,
        ({ state, inv, context }) => {
          const harm = (context && (context.damage || context.horror)) ? context : state?.lastHarmContext
          if (!harm) return true
          const damage = Number(harm.damage) || 0
          const horror = Number(harm.horror) || 0
          if (!damage && !horror) return false
          const maxHealth = inv?.maxHealth ?? inv?.health ?? 0
          const maxSanity = inv?.maxSanity ?? inv?.sanity ?? 0
          if (!maxHealth || !maxSanity) return true
          return (damage > 0 && (inv.damage || 0) + damage >= maxHealth)
            || (horror > 0 && (inv.horror || 0) + horror >= maxSanity)
        },
      ], { selfOnly: true }),
      label: '坚韧不拔',
      // 第 121 轮：取消伤害/恐惧走通用原语 api.cancelHarm。
      resolve: ({ inv, api }) => api.cancelHarm(inv.seat, { maximum: 4, source: '04111' }),
    },
  ],
  modifiers: [

  ],
}
