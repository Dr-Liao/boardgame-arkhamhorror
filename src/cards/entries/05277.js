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
//
// 修正（审计 R2）：
//   · 「与你所在地点之间连接次数不超过 2 的地点」不含自身地点（把 fromId 移出集合）；
//   · 先算出每种模式的目标池，只提供「有合法目标且付得起」的模式，再扣额外费用，避免白扣费；
//   · 增加打出条件：没有任何可伤害目标时不能打出（基础模式无目标时至少要能选范围模式）。

const MODES = [
  { id: 'base', extra: 0, damage: 1, range: false, label: '造成 1 点伤害（你所在地点，非精英）' },
  { id: 'damage', extra: 2, damage: 2, range: false, label: '费用 +2：造成 2 点伤害' },
  { id: 'range', extra: 2, damage: 1, range: true, label: '费用 +2：目标改为连接次数不超过 2 的地点' },
  { id: 'both', extra: 4, damage: 2, range: true, label: '费用 +4：2 点伤害，且目标在连接次数不超过 2 的地点' },
]

// 「与你所在地点之间连接次数不超过 2 的地点」：距离 1–2，不含自身地点。
function locationsWithinTwo(state, fromId) {
  const within = new Set()
  const first = state.locations.find(location => location.id === fromId)?.connections || []
  for (const id of first) {
    if (id === fromId || !state.locations.some(location => location.id === id)) continue
    within.add(id)
    for (const second of state.locations.find(location => location.id === id)?.connections || []) {
      if (second !== fromId) within.add(second)
    }
  }
  return within
}

function targetsFor(state, inv, mode) {
  const locations = mode.range ? locationsWithinTwo(state, inv.location) : new Set([inv.location])
  return state.enemies.filter(enemy => !enemy.defeated && !enemy.elite && locations.has(enemy.location))
}

export default {
  code: '05277',
  playCondition: [{
    when: ({ state, inv }) => {
      const local = targetsFor(state, inv, MODES[0])
      if (local.length) return true
      // 本地没有目标时只能靠「+2 费改范围」打法，至少要付得起这笔额外费用。
      return targetsFor(state, inv, MODES[2]).length > 0 && (inv.resources || 0) >= 2
    },
    message: '连接次数不超过 2 的地点内没有非[[精英]]敌人，不能打出「帮个小忙」',
  }],
  abilities: [
    {
      kind: 'played',
      label: '对一个非精英敌人造成 1 点伤害',
      resolve: ({ state, inv, api }) => {
        // 只保留「有合法目标且额外费用付得起」的模式；再从中选择。
        const usable = MODES.filter(mode => (inv.resources || 0) >= mode.extra && targetsFor(state, inv, mode).length > 0)
        if (!usable.length) { api.info('「帮个小忙」：没有符合条件的非精英敌人。'); return }
        const modeId = usable.length === 1 ? usable[0].id : api.choice({ kind: 'effect', source: '05277', seat: inv.seat,
          prompt: '选择「帮个小忙」的结算模式。',
          options: usable.map(mode => ({ id: mode.id, label: mode.label })) })
        const mode = usable.find(item => item.id === modeId) || usable[0]
        if (!mode) return
        if (mode.extra) api.loseResources(inv.seat, mode.extra)
        const pool = targetsFor(state, inv, mode)
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
