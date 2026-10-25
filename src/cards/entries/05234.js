// 05234 诱敌（潜袭者 · 0 经验）
// 卡面：躲避。自动躲避你所在地点的一个非[[精英]]敌人。
// 卡面：[reaction]在你打出诱敌时，提升其费用2点：「一个非[[精英]]敌人」变为「最多2个非[[精英]]敌人」。
// 卡面：[reaction]在你打出诱敌时，提升其费用2点：「你所在地点」变为「与你所在地点之间连接次数不超过2的地点」。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// R7：两条 [reaction] 改为挂在引擎 beforePlayCost 窗口（正在打出的卡自身条目的 reaction 可作候选来源）：
// 窗口内把选择记到 inv.playUpgrades05234 并累加 context.costIncrease（引擎在支付前加费）；
// played 的 resolve 只读该选择决定躲避数量/目标范围，不再在 resolve 内补付资源。

const UPGRADE_COST = 2

// 与 fromId 相距不超过 2 次连接的地点（含直接连接与二段连接），不含自身。
function locationsWithinTwo(state, fromId) {
  const connectionsOf = id => state.locations.find(location => location.id === id)?.connections || []
  const direct = connectionsOf(fromId)
  const out = []
  for (const id of [...direct, ...direct.flatMap(connectionsOf)]) {
    if (id === fromId || out.includes(id)) continue
    if (!state.locations.some(location => location.id === id)) continue
    out.push(id)
  }
  return out
}

const localTargets = (state, inv) => state.enemies.filter(enemy =>
  !enemy.defeated && !enemy.elite && enemy.location === inv.location)
const nearTargets = (state, inv) => {
  const near = locationsWithinTwo(state, inv.location)
  return state.enemies.filter(enemy => !enemy.defeated && !enemy.elite && near.includes(enemy.location))
}

function canAffordUpgrade(inv, context) {
  const base = Number(context?.cost || 0)
  const extra = Number(context?.costIncrease || 0)
  return (inv.resources || 0) >= base + extra + UPGRADE_COST
}

export default {
  code: '05234',
  // 卡面两项都以「躲避」为目标：没有任何可自动躲避的非精英敌人（所在地点或 2 次连接内）时不能打出。
  playCondition: [{
    when: ({ state, inv }) => {
      if (localTargets(state, inv).length) return true
      // 本地无目标、只能靠范围模式：至少要有 4 资源（基础 2 + 提升费用 2）才能打出并支付升级。
      return nearTargets(state, inv).length > 0 && (Number(inv.resources) || 0) >= 4
    },
    message: '附近没有可自动躲避的非[[精英]]敌人（或资源不足 4：基础 2 + 提升费用 2），不能打出「诱敌」',
  }],
  abilities: [
    {
      kind: 'reaction', trigger: 'beforePlayCost',
      label: '打出诱敌时：提升费用 2 点（「一个非精英敌人」→「最多 2 个」）',
      criteria: [({ state, inv, context }) => context?.cardCode === '05234'
        && !(inv.playUpgrades05234 || []).includes('pair')
        && canAffordUpgrade(inv, context)
        && localTargets(state, inv).length > 0],
      resolve: ({ inv, api, context }) => {
        inv.playUpgrades05234 = [...(inv.playUpgrades05234 || []), 'pair']
        context.costIncrease = Number(context.costIncrease || 0) + UPGRADE_COST
        api.info('诱敌：提升费用 2 点，改为最多 2 个非精英敌人。')
      },
    },
    {
      kind: 'reaction', trigger: 'beforePlayCost',
      label: '打出诱敌时：提升费用 2 点（「你所在地点」→「2 次连接内的地点」）',
      criteria: [({ state, inv, context }) => context?.cardCode === '05234'
        && !(inv.playUpgrades05234 || []).includes('far')
        && canAffordUpgrade(inv, context)
        && nearTargets(state, inv).length > 0],
      resolve: ({ inv, api, context }) => {
        inv.playUpgrades05234 = [...(inv.playUpgrades05234 || []), 'far']
        context.costIncrease = Number(context.costIncrease || 0) + UPGRADE_COST
        api.info('诱敌：提升费用 2 点，改为与你所在地点连接次数不超过 2 的地点。')
      },
    },
    {
      kind: 'played',
      label: '诱敌：自动躲避非精英敌人（升级在打出费用窗口选择）',
      resolve: ({ state, inv, api }) => {
        const upgrades = Array.isArray(inv.playUpgrades05234) ? inv.playUpgrades05234.slice() : []
        delete inv.playUpgrades05234
        const upToTwo = upgrades.includes('pair')
        const far = upgrades.includes('far')
        const nearIds = locationsWithinTwo(state, inv.location)
        let candidates
        if (far) {
          const withEnemies = nearIds.filter(id => state.enemies.some(enemy =>
            !enemy.defeated && !enemy.elite && enemy.location === id))
          if (!withEnemies.length) { api.info('「诱敌」：2 次连接内没有非[[精英]]敌人。'); return }
          const targetLocation = withEnemies.length === 1 ? withEnemies[0] : api.choice({
            kind: 'location', source: '05234', seat: inv.seat,
            prompt: '选择敌人所在的地点（与你相距不超过 2 次连接）。',
            options: withEnemies.map(id => ({ id, label: api.locationName(id) })),
          })
          candidates = state.enemies.filter(enemy =>
            enemy.location === targetLocation && !enemy.defeated && !enemy.elite)
        } else {
          candidates = localTargets(state, inv)
        }
        if (!candidates.length) { api.info('没有可自动躲避的非[[精英]]敌人。'); return }
        const limit = upToTwo ? 2 : 1
        const evaded = []
        for (let count = 0; count < limit && candidates.length; count++) {
          const options = [
            ...(count > 0 ? [{ id: 'skip', label: '不再躲避' }] : []),
            ...candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
          ]
          const pickedId = options.length === 1 ? options[0].id : api.choice({
            kind: 'target', source: '05234', seat: inv.seat, canSkip: count > 0,
            prompt: count === 0 ? '选择要自动躲避的非[[精英]]敌人。' : '是否再自动躲避 1 个非[[精英]]敌人？',
            options,
          })
          if (pickedId === 'skip') break
          const enemy = candidates.find(item => item.id === pickedId)
          if (!enemy) break
          api.autoEvade(enemy)
          evaded.push(enemy)
          candidates = candidates.filter(item => item !== enemy)
        }
        if (!evaded.length) { api.info('「诱敌」没有躲避任何敌人。'); return }
        api.info(`🎭 「诱敌」自动躲避了 ${evaded.length} 个非[[精英]]敌人：${evaded.map(enemy => enemy.name).join('、')}。`)
      },
    },
  ],
}
