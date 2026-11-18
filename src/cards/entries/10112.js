// 10112 围魏救赵（Elaborate Distraction）· 潜袭者事件 · 0 经验 · 3 资源 · 诡计/Double
// 卡面：作为打出围魏救赵的额外费用，花费一个行动。打出围魏救赵不会触发趁乱攻击。
//       对于你所在地点和所有连接地点的每个敌人（选择一项）：
//       · 如果该敌人非[[精英]]，自动躲避它。
//       · 对该敌人造成 1 点伤害。
//
// 一卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「Double：作为额外费用，花费一个行动」= played 描述子 cost: { action: 1 }；
//     读点 ability.js#playedActionCost（legalMoves / validateMove / doPlay 共用，扣费与预览同源）。
//   · 「不会触发趁乱攻击」= played.noOpportunityAttack（dispatch.js 的 playNoAoO 读点）。
//   · 目标集合「你所在地点 + 每个连接地点」= state.locations 的 connections（只取在场地点；
//     「连接」不区分移动限制，与印刷 connected location 同口径）。
//   · 每个敌人二选一 = api.choice（id: evade / damage / skip）；躲避走 api.autoEvadeEnemy
//     （横置并脱离交战，enemies.js#autoEvadeEnemy），伤害走 api.damageEnemy。
//     非[[精英]]限定只作用于「自动躲避」这一项；精英仍可选择造成伤害。
const CODE = '10112'

function reachableLocations(state, inv) {
  const here = (state.locations || []).find(location => location.id === inv.location)
  return new Set([inv.location, ...(here?.connections || [])])
}

function reachableEnemies(state, inv) {
  const ids = reachableLocations(state, inv)
  return (state.enemies || []).filter(enemy => ids.has(enemy.location)
    && !enemy.defeated && !enemy.removedFromGame)
}

export default {
  code: CODE,
  name: 'Elaborate Distraction',
  playCondition: [{
    when: ({ state, inv }) => reachableEnemies(state, inv).length > 0,
    message: '你所在地点或连接地点没有敌人',
  }],
  abilities: [
    {
      kind: 'played',
      cost: { action: 1 },
      noOpportunityAttack: true,
      label: '对所在地点与每个连接地点的每个敌人：自动躲避（非精英）或造成 1 点伤害；Double 额外花费 1 行动',
      resolve: ({ state, inv, api }) => {
        const enemies = reachableEnemies(state, inv)
        if (!enemies.length) {
          api.info('「围魏救赵」：你所在地点和连接地点都没有敌人。')
          return
        }
        for (const enemy of enemies) {
          const canEvade = !enemy.elite && api.canAutoEvade(enemy, inv.seat)
          const options = []
          if (canEvade) options.push({ id: 'evade', label: `自动躲避「${enemy.name}」（非精英）` })
          options.push({ id: 'damage', label: `对「${enemy.name}」造成 1 点伤害` })
          options.push({ id: 'skip', label: '不处理这个敌人' })
          const where = enemy.location === inv.location ? '所在地点' : '连接地点'
          const pick = api.choice({
            kind: 'target', source: CODE, seat: inv.seat,
            prompt: `「围魏救赵」：「${enemy.name}」（${where}）选择一项。`,
            options,
          })
          if (pick === 'evade' && canEvade) {
            if (api.autoEvadeEnemy(enemy)) api.info(`💨 「围魏救赵」：自动躲避「${enemy.name}」。`)
          } else if (pick === 'damage') {
            api.damageEnemy(enemy, 1, inv.seat)
            api.info(`💥 「围魏救赵」：对「${enemy.name}」造成 1 点伤害。`)
          }
        }
      },
    },
  ],
  modifiers: [],
}
