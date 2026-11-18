// 10573 追踪（On the Trail）· 幕 2
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：[action] 花费 1[per_investigator] 线索并选择一个连接的[[黑暗]]地点的敌人：把该敌人移到你的地点。
//       目标 - 在有调查员进入真菌洞穴时立即推进。
// 背面：在真菌洞穴生成放一边的鳖类混种；把海伦·彼得斯移出游戏；
//       如果希奥·彼得斯由任意调查员控制，读([codex] Σ)。
//
// 一张卡一个文件：行动在 behavior.actions/performAction（lostSisterLureFromDark），
// 目标在 checkObjectives（enters），背面在 actReveal（spawnSetAsideEnemy + removeResident + codex）。
export default {
  code: '10573',
  scope: 'act',
  implemented: true,
  abilities: [],
  flags: {
    actStage: 2,
    objective: 'enters',
    objectiveLocation: 'fungalCave',
    action: 'moveDarkEnemy',
    cluesPerInvestigator: 1,
    backSpawnsLimulusAtFungalCave: true,
    backRemovesHelen: true,
    backReadsCodexSigma: true,
  },
  note: '数据型条目：行动与背面都由章节 behavior 分派；10583a 的「放在一边」读点见 SET_ASIDE_ENEMY_CODES。',
}
