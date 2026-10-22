// 04086 埃兹特里的守卫者
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：guardians_of_time
// 卡面：生成 - 任意无人地点(如可能，生成在[[古代]]地点)。
// 卡面：警戒。冷漠。
// 卡面：强制 -  在敌军阶段期间，敌人攻击时，如果埃兹特里的守卫者处于重整状态且未处于交战状态：其攻击每个连接地点的每位调查员。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 埃兹特里的守卫者（04086）：04048「搜索遗迹」时不能攻击也不能被攻击；
// 04049「守备森严的遗迹」时战斗与躲避 +1。
// 迁移自 theUntamedWilds 的 enemyCannotAttack / enemyCannotBeAttacked / enemyStatModifier。

import { actThreeIs } from '../../../_shared.js'

export default {
  code: '04086', implemented: true,
  name: '埃兹特里的守卫者',
  scope: 'enemy',
  text: '搜索遗迹时不能攻击也不能被攻击；守备森严的遗迹时战斗与躲避 +1。',
  enemyRule: { spawnAnyEmpty: true }, spawnAncientFirst: true,
  modifiers: [
    { target: 'cannot:attack', condition: { when: ({ state }) => actThreeIs(state, 'search') } },
    { target: 'cannot:beAttacked', condition: { when: ({ state }) => actThreeIs(state, 'search') } },
    { target: 'enemyFight', amount: 1, condition: { when: ({ state }) => actThreeIs(state, 'guarded') } },
    { target: 'enemyEvade', amount: 1, condition: { when: ({ state }) => actThreeIs(state, 'guarded') } },
  ],
}
