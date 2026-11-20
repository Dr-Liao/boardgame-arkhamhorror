// 11507 欧巴尼恩帮 · 幕 2（金盆洗手，La Bella Luna 线）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：内奥米·欧巴尼恩获得：「[action] 花费至多 4 个资源：谈判。检定[intellect]或[agility](5)。
//       作为本行动费用花费的每个资源使本次检定难度 -1。你每成功超过难度 1 点，在内奥米·欧巴尼恩上放置你的 1 个线索。」
//       目标 - 当伤害被放置到内奥米·欧巴尼恩上时，推进。目标 - 如果内奥米·欧巴尼恩上有 3 个线索，推进。
// 印刷：背面「谢尔顿帮找上门」——生成萨迪与帮派执行者、搜索帮派士兵、转移线索、有线索的罪犯敌人获得冷漠。
// 读点：behavior.checkObjectives / oneLastJobBossParley 读本条目 flags；
//       背面在 behavior.actReveal：api.damageEnemy 给对手头目 2 伤害、api.choose 选移动线索数量/目标、
//       api.takeEnemyClues + api.moveClueToEnemy 完成线索转移；
//       flags.criminalCluesGainAloof 由 behavior.syncCriminalAloof 读取（api.setEnemyKeywords 同步 aloof）。
export default {
  code: '11507',
  scope: 'act',
  implemented: true,
  flags: {
    bossCode: '11511',
    bossClueGoal: 3,
    parleyResourcesUpTo: 4,
    parleyDifficulty: 5,
    parleySkills: ['intellect', 'agility'],
    criminalCluesGainAloof: true,
  },
  note: '数据型条目：与 11506 同构（头目换成内奥米）；背面线索转移由 behavior.act2Back'
    + '（api.takeEnemyClues + api.moveClueToEnemy）实现；「有线索罪犯敌人冷漠」由 behavior.syncCriminalAloof'
    + '（api.setEnemyKeywords，phaseBegan/enemySpawned/线索变动后续期）实现。',
  abilities: [],
}
