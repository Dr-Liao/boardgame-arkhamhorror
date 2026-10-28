// 05095 秘社新信徒
// 归属：战役共用 · theCircleUndone；遭遇组：silver_twilight_lodge
// 卡面：生成 - 任意无人地点。冷漠。
// 卡面：强制 - 在秘社新信徒入场后：在上面放置 1 个毁灭标记。
// 卡面：[action]：谈判。检定[willpower](2)。如果你检定成功，移除秘社新信徒上的所有毁灭标记。
//
// 生成点用 enemyRule.spawnAnyEmpty（引擎 src/engine/encounter.js 的通用「任意无人地点」分支）；
// 入场毁灭走 enemySpawnRule.doomOnSpawn + 共享 enemySpawned 钩子；
// 谈判是引擎的通用 Parley 原语（src/engine/parley.js）：条目声明 actionKind:'parley' 的
// action 描述子，legalMoves / 行动点 / 借机攻击豁免 / 目标校验都由引擎处理。

import { enemyParleyDifficultyBonus } from '../../../_shared.js'

export default {
  code: '05095',
  scope: 'enemy',
  implemented: true,
  enemyRule: { spawnAnyEmpty: true },
  enemySpawnRule: { doomOnSpawn: 1 },
  abilities: [
    {
      kind: 'action',
      actionKind: 'parley',
      label: '谈判秘社新信徒（意志 2）：成功移除其上所有毁灭标记',
      // 行动点由 legalMoves 的通用谈判行动统一扣除（dispatch 的 actionCost），描述子不再重复扣。
      cost: { action: 1 },
      resolve: ({ state, inv, source, api }) => {
        // 05097 秘社玄仪的「直到一轮结束，对该敌人谈判难度 +2」：与章节 behavior 共用读点。
        const bonus = enemyParleyDifficultyBonus(source, state.round)
        api.test(inv.seat, 'willpower', 2 + bonus, {
          source: { type: 'scenario', action: 'parley', name: '谈判', code: '05095', ability: true },
          resolve: result => {
            if (!result.success) return
            api.clearDoomOnCard(source)
            api.info?.('秘社新信徒身上的毁灭标记被全部移除。')
          },
        })
      },
    },
  ],
}
