// 12058 共鸣长袍（Cloak of Resonance）
// 卡面：[reaction] 在恐惧放置到共鸣长袍时，将其横置：对你所在地点的一个敌人造成 1 点伤害。
//
// 读点：
//   · 「恐惧放置到本支援上」→ 窗口 assetHarmPlaced（enemies.js 只对声明了该 trigger 的支援开窗，
//     上下文带 assetId / horror）；criteria 精确匹配本实例；
//   · 横置代价 → cost.exhaust；
//   · 对同地点敌人造成伤害 → api.damageEnemy（与 02006/03106 同一口径）。
const CODE = '12058'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetHarmPlaced',
      label: '恐惧放置到本支援后横置：对所在地点的一个敌人造成 1 点伤害',
      cost: { exhaust: true },
      criteria: [
        ({ context, source }) => context?.assetId === source?.id && (Number(context?.horror) || 0) > 0,
      ],
      resolve: ({ state, inv, api }) => {
        const enemies = (state.enemies || []).filter(enemy => enemy.location === inv.location)
        if (!enemies.length) return
        const chosen = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择要受到「共鸣长袍」1 点伤害的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === chosen) || enemies[0]
        if (!enemy) return
        api.damageEnemy(enemy, 1, inv.seat, CODE)
        api.info(`🔮「共鸣长袍」：对「${enemy.name}」造成 1 点伤害。`)
      },
    },
  ],
  modifiers: [],
}
