// 05111 情报报告
// 卡面：发现你所在地点的1个线索。
// 卡面：[reaction]在你打出情报报告时，提升其费用2点：“发现……的1个线索”变为“发现……的2个线索”。
// 卡面：[reaction]在你打出情报报告时，提升其费用2点：“你所在地点”变为“与你所在地点之间连接次数不超过2的地点”。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// R5：两条「打出时提升费用 2 点」改为挂在引擎的 beforePlayCost 窗口（正在打出的卡自身条目的 reaction
// 已可作为候选来源）。窗口里把选择记到 inv.playUpgrades05111 并累加 context.costIncrease（引擎支付前加费）；
// played 的 resolve 只读该选择结算发现数量/目标范围，不再在 resolve 内付费。
// range 升级只列出「距离 0..2 内仍有线索」的合法地点（含自身地点）；无目标时不提供。

const DESTINATION_UPGRADE_COST = 2

function locationsWithin(state, originId, maxSteps) {
  const byId = new Map(state.locations.map(location => [location.id, location]))
  const seen = new Set([originId])
  let frontier = [originId]
  const found = []
  for (let step = 0; step < maxSteps; step++) {
    const next = []
    for (const id of frontier) {
      for (const connected of byId.get(id)?.connections || []) {
        if (seen.has(connected) || !byId.has(connected)) continue
        seen.add(connected)
        found.push(connected)
        next.push(connected)
      }
    }
    frontier = next
  }
  return found
}

function rangeTargetsFor(state, inv) {
  return [inv.location, ...locationsWithin(state, inv.location, 2)]
    .filter(id => (state.locations.find(location => location.id === id)?.clues || 0) > 0)
}

function canAffordUpgrade(inv, context) {
  const base = Number(context?.cost || 0)
  const extra = Number(context?.costIncrease || 0)
  return (inv.resources || 0) >= base + extra + DESTINATION_UPGRADE_COST
}

export default {
  code: '05111',
  abilities: [
    {
      kind: 'reaction', trigger: 'beforePlayCost',
      label: '打出情报报告时：提升费用 2 点（改为发现 2 个线索）',
      criteria: [({ inv, context }) => context?.cardCode === '05111'
        && !context?.playUpgrades?.clues && canAffordUpgrade(inv, context)],
      resolve: ({ api, context }) => {
        context.playUpgrades = { ...(context.playUpgrades || {}), clues: true }
        context.costIncrease = Number(context.costIncrease || 0) + DESTINATION_UPGRADE_COST
        api.info('情报报告：提升费用 2 点，改为发现 2 个线索。')
      },
    },
    {
      kind: 'reaction', trigger: 'beforePlayCost',
      label: '打出情报报告时：提升费用 2 点（改为距离 0..2 的有线索地点）',
      criteria: [({ state, inv, context }) => context?.cardCode === '05111'
        && !context?.playUpgrades?.range && canAffordUpgrade(inv, context)
        && rangeTargetsFor(state, inv).length > 0],
      resolve: ({ api, context }) => {
        context.playUpgrades = { ...(context.playUpgrades || {}), range: true }
        context.costIncrease = Number(context.costIncrease || 0) + DESTINATION_UPGRADE_COST
        api.info('情报报告：提升费用 2 点，改为与你连接次数不超过 2 的地点。')
      },
    },
    {
      kind: 'played',
      label: '情报报告：发现线索（升级在打出费用窗口选择）',
      resolve: ({ state, inv, api, context }) => {
        const upgrades = context?.playCost?.playUpgrades || {}
        let locationId = inv.location
        if (upgrades.range) {
          const targets = rangeTargetsFor(state, inv)
          if (targets.length) {
            locationId = targets.length === 1 ? targets[0]
              : api.choice({ kind: 'location', source: '05111', seat: inv.seat,
                prompt: '情报报告：选择发现线索的地点（与你所在地点连接次数不超过 2）。',
                options: targets.map(id => ({ id, label: api.locName(id) })) })
          }
        }
        const amount = upgrades.clues ? 2 : 1
        api.discoverClue(inv.seat, amount, locationId)
        api.info(`情报报告：「${api.locName(locationId)}」发现 ${amount} 个线索。`)
      },
    },
  ],
  modifiers: [],
}
