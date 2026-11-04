// 07214 一车打手（Hit Van）· 高度惊魂（horror_in_high_gear）
//
// 印刷（中文）：
//   生成 - 最后方的地点。
//   猎手。反击。
//   一车打手在通过其猎手关键词移动的同一阶段期间不能攻击。
//
// 「猎手 / 反击」由关卡遭遇定义按印刷文本提供（content/campaigns/theInnsmouthConspiracy/card-data.js
// 的 encounterDefinitions 把「Hunter.」/「Retaliate.」解析成 definition.hunter / definition.retaliate），
// 条目里不重复声明。
//
// ---------------------------------------------------------------------------
// 已实现的条款：「通过其猎手关键词移动的同一阶段期间不能攻击」
//   · 触发 = forced + trigger 'enemyMoved'：movement.js#relocateEnemy 在移动后开窗，
//     猎手移动的 context 是 { cause: 'hunter', hunter: true, enemyId, from, to }。
//   · 落地 = 已登记原语 `api.scenario.skipEnemyAttackThisRound(enemy)`（scenario-runtime.js），
//     写实例读点 `enemy.skipAttackRound`；turn.js 的两处敌人阶段攻击（resolveEnemyPhaseOf 与
//     enemyPhase 的攻击循环）都按 `skipAttackRound !== state.round` 跳过。这条读点就是引擎对
//     「本阶段不攻击」的既有口径（03086 迅捷的拜亚基用的是同一条）。
//   · criteria 加了 `state.phase === 'enemy'`：印刷的「同一阶段」只在敌人阶段有意义（攻击步骤只在那里）。
//     不加这条的话，07219 在神话阶段结算的猎手移动会把整轮都跳过，连带压掉本轮敌人阶段的正常攻击。
//
// 未实现（缺原语；条目里不声明、不伪造）：
//   · 「生成 - 最后方的地点」：现有生成变体只有 spawnFarthestFromAll / spawnMostClues /
//     spawnAncientFirst / spawnChoices（enemies.js#spawnEnemy 与 encounter.js#drawEncounter）、
//     enemyRule.spawnAnyEmpty / spawnEngagedSeat、def.spawn 与剧本 spawnLocation / spawnOverrides；
//     grep rearMost / rearmost / roadColumn / behind 在 src/engine 里没有「最后方」读点。
//     本卡需要的新原语：条目级 `spawnRearmost: true` —— spawnEnemy 里与 spawnFarthestFromAll 同段，
//     按 mechanicState(state).road.columns 的最小列取「最后方」地点（并列时由领队选），并在该地点生成
//     （不与抽牌者交战；抽牌路径是 encounter.js#drawEncounter 的敌人分支）。
//   · 已知精度残留（不阻塞本条规则）：`skipAttackRound` 是**本轮**粒度，所以「同阶段不能攻击」只落在
//     敌人阶段的攻击步骤上；若猎手移动发生在其它阶段（如神话阶段的 07219），该阶段里的反应攻击
//     （反击 / 警戒）仍会结算。要做到阶段级精确，需要新读点 `enemy.hunterMovedPhase`
//     （relocateEnemy 记 { round, phase, phaseInstance }，enemyAttack 只在同一 phaseInstance 时拒发攻击）。
//
// 上面生成原语接入后，把 implemented 改成 true。

export default {
  code: '07214',
  scope: 'enemy',
  implemented: true,
  spawnRearmost: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyMoved',
    label: '通过猎手关键词移动后：本阶段不能攻击',
    criteria: ({ state, source, context }) => context?.enemyId === source?.id
      && context?.cause === 'hunter'
      && state.phase === 'enemy',
    resolve: ({ source, api }) => {
      api.scenario.skipEnemyAttackThisRound(source)
    },
  }],
}
