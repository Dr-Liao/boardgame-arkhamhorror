// 10592 绝世发现 · 幕 2（theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[fast] 在鳄龟混种所在地点的某个相邻地点的调查员共同花费 1 [per_investigator] 个线索：
//   在本轮剩余时间内，将鳄龟混种的巡逻地点改成该地点。
//   强制 - 当敌军阶段结束时：鳄龟混种所在地点每有一个重整状态的[[异形]]敌人，鳄龟混种受到 1 点伤害。
//   目标 - 当一轮结束时，如果鳄龟混种在起始地点，立即推进。
// 背面（奇异构造）：如果是第一日，阅读下列内容（→结局 2）；否则（→结局 1）。
//
// 快速改巡逻 = behavior.actions/performAction（deepths* 见 behavior），敌军阶段末伤害见
// behavior.enemyPhaseEnd 的近似（enemyPhaseAfterHunters），目标见 behavior.checkObjectives，
// 背面见 behavior.actReveal。数据型条目。
export default {
  code: '10592',
  scope: 'act',
  implemented: true,
  flags: {
    fastAction: { action: 'depthsChangeHybridPatrol', perInvestigatorClues: 1, duration: 'round' },
    forcedEnemyPhaseEnd: { damagePerReadyAbomination: 1 },
    objective: { type: 'chelydranHybridAtStartingLocation', timing: 'roundEnd' },
    back: { resolutionByDay: { 1: 'resolution2', otherwise: 'resolution1' } },
  },
  note: '数据型幕条目；快速改巡逻由 behavior.actions/performAction 结算（引擎巡逻只读条目静态目标，本轮改目标用「敌军阶段后走一步」近似，见 note 于 behavior），敌军阶段末伤害与目标/背面也在 behavior。',
  abilities: [],
}
