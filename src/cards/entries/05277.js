// 05277 帮个小忙
// 卡面：对你所在地点的一个非[[精英]]敌人造成1点伤害。
// 卡面：[reaction]在你打出帮个小忙时，提升其费用2点：“造成1点伤害”变为“造成2点伤害”。
// 卡面：[reaction]在你打出帮个小忙时，提升其费用2点：“你所在地点”变为“与你所在地点之间连接次数不超过2的地点”。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05277 帮个小忙：4 种模式（基础 / +2 费改 2 伤害 / +2 费改 2 格内地点 / +4 费两者），
// 额外费用用 api.loseResources 支付，伤害走 api.damageEnemy（非精英敌人筛在候选内）。

const MODES = [
  { id: 'base', extra: 0, damage: 1, range: false, label: '造成 1 点伤害（你所在地点，非精英）' },
  { id: 'damage', extra: 2, damage: 2, range: false, label: '费用 +2：造成 2 点伤害' },
  { id: 'range', extra: 2, damage: 1, range: true, label: '费用 +2：目标改为连接次数不超过 2 的地点' },
  { id: 'both', extra: 4, damage: 2, range: true, label: '费用 +4：2 点伤害，且目标在连接次数不超过 2 的地点' },
]

function locationsWithinTwo(state, fromId) {
  const within = new Set([fromId])
  const first = state.locations.find(location => location.id === fromId)?.connections || []
  for (const id of first) {
    within.add(id)
    for (const second of state.locations.find(location => location.id === id)?.connections || []) within.add(second)
  }
  return within
}

export default {
  code: '05277',
  abilities: [
    {
      kind: 'played',
      label: '对一个非精英敌人造成 1 点伤害',
      resolve: ({ state, inv, api }) => {
        const affordable = MODES.filter(mode => inv.resources >= mode.extra)
        const modeId = affordable.length === 1 ? affordable[0].id : api.choice({ kind: 'effect', source: '05277', seat: inv.seat,
          prompt: '选择「帮个小忙」的结算模式（费用在打出后额外支付）。',
          options: affordable.map(mode => ({ id: mode.id, label: mode.label })) })
        const mode = MODES.find(item => item.id === modeId) || affordable[0]
        if (!mode) return
        if (mode.extra) api.loseResources(inv.seat, mode.extra)
        const locations = mode.range ? locationsWithinTwo(state, inv.location) : new Set([inv.location])
        const pool = state.enemies.filter(enemy => !enemy.elite && locations.has(enemy.location))
        if (!pool.length) { api.info('「帮个小忙」：没有符合条件的非精英敌人。'); return }
        const chosen = pool.length === 1 ? pool[0].id : api.choice({ kind: 'target', source: '05277', seat: inv.seat,
          prompt: '选择要伤害的非精英敌人。', options: pool.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = pool.find(item => item.id === chosen) || pool[0]
        api.damageEnemy(enemy, mode.damage, inv.seat)
        api.info(`「帮个小忙」对「${enemy.name}」造成 ${mode.damage} 点伤害。`)
      },
    },
  ],
  modifiers: [

  ],
}
