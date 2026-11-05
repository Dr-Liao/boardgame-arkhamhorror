// 07327 缟玛瑙守卫（Onyx Guardians）· 伊哈·恩斯雷圣堂地点 · 暗潮之下 第八章
//
// 印刷（中文）：
//   敌军阶段期间，每个处于重整状态的[[古神]]敌人可以攻击本地点的调查员，如同其已交战。
//   [action]如果你控制黄色钥匙，将其放在本地点上，且本地点的调查员共同花费1[每调查员]个线索：
//   自动躲避每个[[古神]]敌人。移除本地点的淹没标记。直到本场游戏结束，本地点不能被淹没。
//   (团队每场游戏仅限一次。)
// 印刷（英文）：
//   During the enemy phase, each ready [[Ancient One]] enemy can attack investigators here as if
//   they were engaged.
//   [action] If you control the yellow key, place it on this location and investigators here spend
//   1 [per_investigator] clues, as a group: Automatically evade each [[Ancient One]] enemy. Unflood
//   this location. For the remainder of the game, this location cannot be flooded.
//   (Group limit once per game.)
//
// 引擎读点：
//   · 第一句 = `locationRule.enemiesAttackAsIfEngagedHere: ['Ancient One']`：读点在敌军阶段的
//     攻击枚举（turn.js#enemyPhase：待攻击名单 = 已交战敌人 ∪ 本地点的 as-if-engaged 敌人；
//     enemies.js#enemyAttacksAsIfEngaged 校验「重整 + 同地点 + 特性匹配 + 文本未被涂白」）。
//     只影响「谁能攻击」，不建立交战关系。修复前这一整句未实现（审计 H16）。
//   · 第二句 = abilities 的一条 [action]：`additionalKeyCost {yellow, destination:'source'}` 把
//     黄色钥匙放到本地点（key-cost.js 的 destination holder = location:<id>）、`cost.groupClues`
//     团队线索、`limit perGame/group` 团队每场游戏一次；结算 = 自动躲避每个[[古神]] +
//     永久排水/锁定（api.mechanics.water.set 0 + lock；_shared.js#evadeTraitAndDrainLocation）。
//   · 「以完全淹没入场（即使未揭示）」= locationRule.entersPlayFlooded（读点 locations.js#placeLocation）。

import { evadeTraitAndDrainLocation } from '../../_shared.js'

export default {
  code: '07327', scope: 'location', implemented: true,
  locationRule: {
    // 背面：伊哈·恩斯雷圣堂以完全淹没入场（即使未揭示）。读点 locations.js#placeLocation。
    entersPlayFlooded: 2,
    // 「敌军阶段期间，每个重整的[[古神]]敌人可以攻击本地点的调查员，如同已交战」。
    enemiesAttackAsIfEngagedHere: ['Ancient One'],
  },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '放置黄色钥匙并共同花费每人1个线索：躲避古神并永久排水',
    cost: { groupClues: ({ state }) => state.numInvestigators },
    additionalKeyCost: { colors: ['yellow'], destination: 'source' },
    limit: { scope: 'perGame', owner: 'group' },
    resolve: evadeTraitAndDrainLocation,
  }],
}
