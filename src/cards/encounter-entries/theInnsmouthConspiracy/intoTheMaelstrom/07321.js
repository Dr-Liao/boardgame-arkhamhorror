// 07321 沉没厅堂 · 漩涡深处
//
// 印刷（中文）：
//   [action] 如果你控制黑色钥匙：将其放在沉没厅堂上。
//   强制 - 敌人进入沉没厅堂后，如果黑色钥匙在沉没厅堂上：对该敌人造成 2 点伤害。
//   背面（未揭示面「Y'ha-nthlei」）：伊哈·恩斯雷以部分淹没入场（即使其未揭示）。
//
// 引擎读点：
//   · 地点主动行动：scope 'location' + kind 'action' + actionKind 'activate'；非玩家实体
//     的行动由 parley.js#parleyMovesFor 枚举（legalMoves），执行走
//     ability-exec.js#doEntityAbility。
//   · 「若你控制黑色钥匙：将其放在此处」用 additionalKeyCost
//     （colors:['black'], destination:'source'）：key-cost.js 只把调查员持有的黑钥匙列为
//     候选，支付时 transferKey(..., { reveal:true }) 直接放到 location:<id>，不需要在
//     resolve 里再写一遍（同 07323/07324 的钥匙费用写法）。
//   · 「敌人进入后」：条目级窗口 'enemyEnteredLocation'（movement.js#relocateEnemy 派发，
//     仅章节 eventWindowInstances:true 时开窗；TIC 八章都是 true），context 带
//     { enemy, location, from, to }。钥匙是否在此用 _shared 的 keysAt（默认只回已揭示
//     颜色；黑色钥匙由上面的费用以揭示状态放置）。
//   · 伤害走 api.scenario.damageEnemy(enemyId, 2, seat, source)：敌人伤害的唯一入口，
//     会继续派发 enemyDamaged / 击败等后续窗口。
//   · 背面「以部分淹没入场（即使未揭示）」由 locationRule.entersPlayFlooded 声明：
//     读点 locations.js#placeLocation（07320–07323 部分淹没，07324–07327 完全淹没）。
//
// 一卡一文件：本卡行为只在这里维护；不要写回 encounter-abilities.js。

import { keysAt } from '../../_shared.js'

export default {
  code: '07321', scope: 'location', implemented: true,
  locationRule: { entersPlayFlooded: 1 },
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '将你控制的黑色钥匙放在沉没厅堂上',
    additionalKeyCost: { colors: ['black'], destination: 'source' },
    resolve: () => {},
  }, {
    kind: 'forced', trigger: 'enemyEnteredLocation', silent: true,
    label: '敌人进入后，若黑色钥匙在此：对该敌人造成2点伤害',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ state, source, context }) => context.location === source.id
      && Boolean(context.enemy) && keysAt(state, `location:${source.id}`).includes('black'),
    resolve: ({ inv, source, context, api }) => {
      api.scenario.damageEnemy(context.enemy.id, 2, inv.seat, '07321')
    },
  }],
}
