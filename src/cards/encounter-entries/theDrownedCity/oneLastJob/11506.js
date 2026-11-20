// 11506 谢尔顿帮 · 幕 2（金盆洗手，Hibb's Roadhouse 线）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：萨迪·谢尔顿获得：「[action] 花费至多 4 个资源：谈判。检定[willpower]或[combat](5)。
//       作为本行动费用花费的每个资源使本次检定难度 -1。你每成功超过难度 1 点，在萨迪·谢尔顿上放置你的 1 个线索。」
//       目标 - 当伤害被放置到萨迪·谢尔顿上时，推进。目标 - 如果萨迪·谢尔顿上有 3 个线索，推进。
// 印刷：背面「欧巴尼恩帮找上门」——生成内奥米与帮派执行者、搜索帮派士兵、转移线索、有线索的罪犯敌人获得冷漠。
// 读点：behavior.checkObjectives 读 flags.bossCode/bossClueGoal；behavior.actions 的
//       oneLastJobBossParley 读 flags.parleyResourcesUpTo/parleyDifficulty；
//       背面在 behavior.actReveal：api.damageEnemy 给对手头目 2 伤害、api.choose 选移动线索数量/目标、
//       api.takeEnemyClues + api.moveClueToEnemy 完成线索转移；
//       flags.criminalCluesGainAloof 由 behavior.syncCriminalAloof 读取（api.setEnemyKeywords 同步 aloof）。
export default {
  code: '11506',
  scope: 'act',
  implemented: true,
  flags: {
    bossCode: '11510',
    bossClueGoal: 3,
    parleyResourcesUpTo: 4,
    parleyDifficulty: 5,
    parleySkills: ['willpower', 'combat'],
    criminalCluesGainAloof: true,
  },
  note: '数据型条目：目标/谈判参数由 flags 声明、behavior 读取；'
    + '背面「把至多 2 个线索从头目移到同地点非精英敌人」由 behavior.act2Back 用 api.takeEnemyClues + api.moveClueToEnemy 实现；'
    + '「有线索的[[罪犯]]敌人获得冷漠」由 behavior.syncCriminalAloof（api.setEnemyKeywords，phaseBegan/enemySpawned/线索变动后续期）。',
  abilities: [],
}
