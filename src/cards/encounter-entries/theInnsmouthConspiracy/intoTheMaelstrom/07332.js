// 07332 水生异怪（Aquatic Abomination）· 暗潮之下（into_the_maelstrom）· 敌人
//
// 印刷（中文）：
//   猎手。
//   水生异怪移动时，完全淹没的地点视作相互连接。
//   水生异怪在通过其猎手关键词移动的同一阶段期间不能攻击。
//
// 印刷（英文）：
//   Hunter.
//   While Aquatic Abomination is moving, fully flooded locations are considered to be connected to one another.
//   Aquatic Abomination cannot attack during the same phase it moved via its hunter keyword.
//
// 引擎读点：
//   · 「猎手」是印刷关键词，由关卡遭遇定义按英文正文解析（content/.../card-data.js 的
//     encounterDefinitions 把首行「Hunter.」放进 definition.hunter），条目不再重复声明。
//   · 第 2 条「移动时完全淹没地点视为相互连接」：条目级 `enemyRule.hunterTreatsFloodedConnected: true`，
//     读点 src/engine/turn.js#hunterStep（按 flood.js 的有效淹没等级 ≥ 2 为猎手追加临时相邻边；
//     只影响这一次寻路视图，不改 state.locations[].connections、不影响调查员移动）。
//   · 第 3 条「通过猎手关键词移动的同一阶段期间不能攻击」：用已登记原语
//     `api.scenario.skipEnemyAttackThisRound(enemy)`（scenario-runtime.js，写 enemy.skipAttackRound，
//     turn.js:189/244 的攻击步骤按 `skipAttackRound !== state.round` 跳过），
//     触发窗口 `enemyMoved`（movement.js:387-390，context 带 cause:'hunter'），与 07214 同口径。
//     精度残留（与 07214 相同）：skipAttackRound 是**本轮**粒度；本章 eventWindowInstances:true 下
//     至少落在敌人阶段的攻击步骤上。阶段级精确需要 enemyAttack 读 movement.js:383 已记录的
//     lastHunterMove.phaseInstance —— 现有 lastHunterMove 已经记录，但攻击处没有读它。
//
// 实现状态：implemented:true（三条印刷条款全部接线）。
//
// 一卡一文件：本卡行为只在这里维护；不要写回 encounter-abilities.js。

export default {
  code: '07332',
  scope: 'enemy',
  implemented: true,
  enemyRule: { hunterTreatsFloodedConnected: true },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyMoved',
    label: '通过猎手关键词移动后：本阶段不能攻击',
    criteria: ({ state, source, context }) => context?.enemyId === source?.id
      && context?.cause === 'hunter'
      && state.phase === 'enemy',
    resolve: ({ source, api }) => {
      api.scenario.skipEnemyAttackThisRound(source)
    },
  }],
}
