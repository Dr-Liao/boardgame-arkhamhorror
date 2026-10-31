// 06148 伊伯生物（theSearchForKadath）· 敌人（怪物 / 精英，冷漠 / 猎手，蜂拥1[per_investigator]，胜利1）
// 卡面：猎物 - 仅限位于[[遗迹]]地点的调查员。冷漠。猎手。蜂拥1[每名调查员]。
// 卡面：敌军阶段的「敌人攻击」步骤期间，伊伯生物不攻击与其交战的调查员，
//       改为攻击位于其地点的每位调查员（即便未与其交战）。
//
// 一卡一文件：规则数据在这里声明；章节 behavior.enemyPhaseAfterHunters 读取并接线
// （先由行为结算「攻击本地每位调查员」，再用 api.skipEnemyAttackThisRound 跳过引擎的正常攻击）。
export default {
  code: '06148', scope: 'enemy', implemented: true,
  enemyRule: { attacksEachInvestigatorAtLocation: true },
}
