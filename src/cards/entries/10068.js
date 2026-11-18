// 10068 贝壳护符（Scrimshaw Charm · 来自远方海岸 From Distant Shores）· 潜袭者资产 · 1 资源 · 饰品槽
// 卡面：
//   [action] 在混乱袋中加入 1-3 个[curse]标记并横置贝壳护符：获得 1 资源。
//   每加入 1 个标记，获得额外 1 资源。
//
// 读点（卡面 → 引擎）：
//   · 「在混乱袋中加入 1-3 个[curse]标记」= api.chaosTokens.add('curse', n)
//     （chaos-token-pool 的唯一写点，受标记池上限约束；api.chaosTokens.room('curse') 给出可加入数）。
//     数量 1..min(3, room) 由 api.choice(kind:'amount') 询问。
//   · 「横置」= 描述子 cost.exhaust（payAbilityCost 统一付费/校验）。
//   · 「获得 1 资源，每加入 1 个标记再 +1」= api.gainResources(seat, 1 + 实际加入数)。
const CODE = '10068'
const CURSE = 'curse'
const MAX_TOKENS = 3

export default {
  code: CODE,
  name: 'Scrimshaw Charm (From Distant Shores)',
  abilities: [
    {
      kind: 'action',
      cost: { action: true, exhaust: true },
      label: '横置：加入 1-3 个[诅咒]标记，获得 1 资源，每加入 1 个再获得 1 资源',
      criteria: [({ helpers }) => helpers.poolTokenRoom(CURSE) > 0],
      resolve: ({ inv, api }) => {
        const room = api.chaosTokens.room(CURSE)
        const maximum = Math.min(MAX_TOKENS, Math.max(0, Number(room) || 0))
        if (maximum <= 0) {
          api.info('🐚 贝壳护符：混乱袋里没有可加入诅咒标记的空间。')
          return
        }
        const answer = api.choice({
          kind: 'amount', source: CODE, seat: inv.seat,
          prompt: `贝壳护符：加入几个[诅咒]标记（1–${maximum}）？`,
          options: Array.from({ length: maximum }, (_, index) => {
            const count = index + 1
            return { id: String(count), label: `${count} 个[诅咒]标记（获得 ${1 + count} 资源）` }
          }),
        })
        const count = Math.min(maximum, Math.max(1, Number(answer) || 1))
        const added = api.chaosTokens.add(CURSE, count)
        if (!added) {
          api.info('🐚 贝壳护符：没有加入诅咒标记。')
          return
        }
        api.gainResources(inv.seat, 1 + added)
        api.info(`🐚 贝壳护符：横置并加入 ${added} 个[诅咒]标记，获得 ${1 + added} 资源。`)
      },
    },
  ],
  modifiers: [],
}
