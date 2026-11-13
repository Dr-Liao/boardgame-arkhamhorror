// 09627 虚空奇美拉（Void Chimera · Fellbeak / 凶残巨喙）· 敌人 · on_thin_ice
//
// 归属：关卡专用 · theScarletKeys/onThinIce（P7）。
// 卡面（中）：巡逻（有最多调查员的[[荒地]]地点）。反击。
//   虚空奇美拉（凶残巨喙）得到 +1[per_investigator]生命值。
//
// 读点（章节 behavior，条目只声明数据）：
//   · 「巡逻」→ TSK P2 原语 `tsk-coterie.js#patrolDestination`：behavior.enemyPhaseStart 读
//     `enemyRule.patrol`（`{ trait:'Wilderness', mostInvestigators:true }`），先按「调查员最多的[[荒地]]」
//     解析成 `{ kind:'named', locationId }` 写进敌人实例，再取最短路径下一步并 `api.moveEnemy`；
//   · 「+1[per_investigator] 生命值」→ definition 的 `healthPerPlayerBonus: 1`（spawnEnemy 读点）；
//   · 「反击」由 definition 的印刷关键字进入敌人实例。
export default {
  code: '09627',
  name: '虚空奇美拉（凶残巨喙）',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    patrol: { kind: 'trait', trait: 'Wilderness', mostInvestigators: true },
    retaliate: true,
    healthPerPlayerBonus: 1,
  },
  note: 'approximation: 巡逻目标由内容层按「[[荒地]]地点中调查员最多」解析为命名地点（原语只认 named/trait），'
    + '平手按地点 id 稳定排序；巡逻移动发生在敌人阶段开始（`enemyPhaseStart`），与猎手移动同一时段。',
}
