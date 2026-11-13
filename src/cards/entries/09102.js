// 09102 死神偶像（Idol of Xanatos）· 幸存者资产 · 0 经验 · 饰品槽
// 卡面：[reaction] 在你受到伤害和/或恐惧时，横置死神偶像并弃掉你最多 3 张手牌：
//        取消同等数量的伤害/恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · `harmDealt` 窗口（enemies.js#applyHarm 在分配伤害/恐惧前打开）——与 08116 护身法宝同一时机；
//   · 取消数量 = 弃掉的手牌数，直接改写窗口上下文的 damage/horror（引擎在窗口之后读取）；
//   · 横置是描述子 cost.exhaust，弃牌走 api.discardChosen（唯一弃手牌入口，逐张询问）。
const code = '09102'

export default {
  code,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'harmDealt',
      label: '受到伤害/恐惧时：横置并弃掉最多 3 张手牌，取消等量伤害/恐惧',
      cost: { exhaust: true },
      criteria: [({ inv, context }) => context?.seat === inv.seat
        && ((Number(context?.damage) || 0) + (Number(context?.horror) || 0)) > 0
        && (inv.hand || []).length > 0],
      resolve: ({ inv, context, api }) => {
        const max = Math.min(3, (inv.hand || []).length)
        const damage = Math.max(0, Number(context?.damage) || 0)
        const horror = Math.max(0, Number(context?.horror) || 0)
        const answer = api.choice({
          kind: 'amount', source: code, seat: inv.seat,
          prompt: '「死神偶像」：弃掉最多 3 张手牌，取消等量的伤害/恐惧。',
          options: Array.from({ length: max + 1 }, (_, count) => ({
            id: String(count),
            label: count ? `弃 ${count} 张（取消 ${count} 点）` : '不弃牌（不取消）',
          })),
        })
        const count = Math.max(0, Math.min(max, Number(answer) || 0))
        if (!count) return
        api.discardChosen(inv.seat, count, code)
        const split = []
        for (let cancelledDamage = 0; cancelledDamage <= Math.min(damage, count); cancelledDamage++) {
          const cancelledHorror = Math.min(horror, count - cancelledDamage)
          if (cancelledDamage + cancelledHorror > 0 && cancelledDamage + cancelledHorror <= count) {
            split.push({ id: `${cancelledDamage}:${cancelledHorror}`,
              label: `取消 ${cancelledDamage} 伤害、${cancelledHorror} 恐惧` })
          }
        }
        if (!split.length) return
        const picked = split.length === 1 ? split[0].id : api.choice({
          kind: 'harm', source: code, seat: inv.seat,
          prompt: '「死神偶像」：选择要取消的伤害与恐惧。', options: split,
        })
        const [cancelledDamage, cancelledHorror] = String(picked).split(':').map(Number)
        if (!Number.isFinite(cancelledDamage) || !Number.isFinite(cancelledHorror)) return
        context.damage = Math.max(0, damage - cancelledDamage)
        context.horror = Math.max(0, horror - cancelledHorror)
        api.info(`🛡️ 「死神偶像」：${inv.name} 弃掉 ${count} 张手牌，取消 ${cancelledDamage} 点伤害、${cancelledHorror} 点恐惧。`)
      },
    },
  ],
  modifiers: [],
}
