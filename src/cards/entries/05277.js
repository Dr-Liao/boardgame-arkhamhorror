// 05277 帮个小忙
// 卡面：对你所在地点的一个非[[精英]]敌人造成1点伤害。
// 卡面：[reaction]在你打出帮个小忙时，提升其费用2点：“造成1点伤害”变为“造成2点伤害”。
// 卡面：[reaction]在你打出帮个小忙时，提升其费用2点：“你所在地点”变为“与你所在地点之间连接次数不超过2的地点”。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// R7：两条 [reaction] 改为挂在引擎 beforePlayCost 窗口（正在打出的卡自身条目的 reaction 可作候选来源）：
// 窗口内把选择记到 inv.playUpgrades05277 并累加 context.costIncrease（引擎支付前加费）；
// played 的 resolve 只读该选择决定伤害/目标范围，不再在 resolve 内补付资源。

const UPGRADE_COST = 2

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

function targetsAt(state, inv, range) {
  const locations = range ? locationsWithinTwo(state, inv.location) : new Set([inv.location])
  return state.enemies.filter(enemy => !enemy.defeated && !enemy.elite && locations.has(enemy.location))
}

function canAffordUpgrade(inv, context) {
  const base = Number(context?.cost || 0)
  const extra = Number(context?.costIncrease || 0)
  return (inv.resources || 0) >= base + extra + UPGRADE_COST
}

export default {
  code: '05277',
  playCondition: [{
    when: ({ state, inv }) => {
      if (targetsAt(state, inv, false).length) return true
      // 本地没有目标时只能靠「+2 费改范围」打法：基础 2 + 额外 2 = 4，必须付得起。
      return targetsAt(state, inv, true).length > 0 && (Number(inv.resources) || 0) >= 4
    },
    message: '连接次数不超过 2 的地点内没有非[[精英]]敌人（或资源不足 4：基础 2 + 提升费用 2），不能打出「帮个小忙」',
  }],
  abilities: [
    {
      kind: 'reaction', trigger: 'beforePlayCost',
      label: '打出帮个小忙时：提升费用 2 点（造成 2 点伤害）',
      criteria: [({ state, inv, context }) => context?.cardCode === '05277'
        && !context?.playUpgrades?.damage
        && canAffordUpgrade(inv, context)
        && targetsAt(state, inv, false).length > 0],
      resolve: ({ api, context }) => {
        context.playUpgrades = { ...(context.playUpgrades || {}), damage: true }
        context.costIncrease = Number(context.costIncrease || 0) + UPGRADE_COST
        api.info('帮个小忙：提升费用 2 点，改为造成 2 点伤害。')
      },
    },
    {
      kind: 'reaction', trigger: 'beforePlayCost',
      label: '打出帮个小忙时：提升费用 2 点（目标改为 2 次连接内的地点）',
      criteria: [({ state, inv, context }) => context?.cardCode === '05277'
        && !context?.playUpgrades?.range
        && canAffordUpgrade(inv, context)
        && targetsAt(state, inv, true).length > 0],
      resolve: ({ api, context }) => {
        context.playUpgrades = { ...(context.playUpgrades || {}), range: true }
        context.costIncrease = Number(context.costIncrease || 0) + UPGRADE_COST
        api.info('帮个小忙：提升费用 2 点，目标改为与你所在地点连接次数不超过 2 的地点。')
      },
    },
    {
      kind: 'played',
      label: '对一个非精英敌人造成 1 点伤害（升级在打出费用窗口选择）',
      resolve: ({ state, inv, api, context }) => {
        const upgrades = context?.playCost?.playUpgrades || {}
        const range = Boolean(upgrades.range)
        const damage = upgrades.damage ? 2 : 1
        const pool = targetsAt(state, inv, range)
        if (!pool.length) { api.info('「帮个小忙」：没有符合条件的非精英敌人。'); return }
        const chosen = pool.length === 1 ? pool[0].id : api.choice({ kind: 'target', source: '05277', seat: inv.seat,
          prompt: '选择要伤害的非精英敌人。', options: pool.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = pool.find(item => item.id === chosen) || pool[0]
        api.damageEnemy(enemy, damage, inv.seat)
        api.info(`「帮个小忙」对「${enemy.name}」造成 ${damage} 点伤害。`)
      },
    },
  ],
}
