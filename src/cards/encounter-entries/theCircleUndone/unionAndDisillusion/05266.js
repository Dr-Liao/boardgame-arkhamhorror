// 05266 夜鹰（Whip-poor-will）
// 归属：关卡专用 05238《聚合幻灭》（uad）。卡面：生成 - 首位调查员所在地点；
// 你所在地点的每张夜鹰使你的所有技能 -1。
// 一卡一文件：规则只在这里维护；生成地点走 enemySpawnRule，技能光环走 enemyStatRule.skillAura
// （共享读点：TCU encounter-rules 的 spawnLocation 转发 / statModifier）。
export default {
  code: '05266',
  scope: 'enemy',
  implemented: true,
  enemySpawnRule: { spawnAtFirstInvestigator: true },
  enemyStatRule: { skillAura: { amount: -1, locationBound: true } },
}
