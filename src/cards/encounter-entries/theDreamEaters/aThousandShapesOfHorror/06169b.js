// 06169b 敌人「不可名状之物」（The Unnamable · 终极异形）· 万千骇形（议程 I 的背面）
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：生成 - 阁楼或楼上的走廊。冷漠。猎手。不能被击败。
// 调查员「找到了破碎的镜子」「研究了一幅亵渎的肖像画」「发现了缺失的骨头」时，各给它 -1 攻击与 -1 躲避。
//
// 依据：
//   · 不能被击败 → 引擎读 definition 的 cannotBeDefeated（enemyRule 会被并进 definition）；
//   · -1 攻击/-1 躲避 → 条目 enemyStatRule.rememberedFacts 数据，本章 behavior 的
//     enemyStatModifier 在转发共享层后按记住的事实现算（不写敌人实例快照）；
//   · 生成 - 阁楼或楼上的走廊 → enemySpawnRule.spawnChoices（chapter behavior 的 spawnLocation
//     在无指定生成点的路线上按在场地点选择；议程 I 背面的显现走 06169a.js）。
export default {
  code: '06169b',
  scope: 'enemy',
  implemented: true,
  // 数值与「冷漠/猎手」由 definition 的印刷数据提供；「不能被击败」是引擎读点。
  enemyRule: { cannotBeDefeated: true },
  enemyStatRule: {
    // 每满足一项：攻击 -1、躲避 -1（上限 3，事实只有 3 项）。读点：本章 behavior.enemyStatModifier。
    // 三个事实 = 卡面括号里的三条「Remember」记录（记在 scenarioFlags.remembered）。
    rememberedFacts: {
      facts: ['foundACrackedMirror', 'studiedADesecratedPortrait', 'noticedTheMissingBones'],
      amount: -1,
      cap: 3,
    },
  },
  enemySpawnRule: {
    // 生成指示：阁楼或楼上的走廊（在场地点里选；都不在场时由调用方决定）。
    spawnChoices: ['06181', '06178'],
  },
}
