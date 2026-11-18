// 10706b 十字路口 · 地点（The Vale · 黑夜面 [night]，[[中心]]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10706b）：[[毒堇谷]]。[[中心]]。黑夜面。帷幕 2，线索 2，连接符号 ◆ →
//   ▲ / ■ / ★ / ● / ♥ / ☾。
//   敌军阶段期间，每个在十字路口的[[破碎]]敌人失去冷漠。
//   [reaction] 你成功在十字路口躲避[[破碎]]敌人且超过难度至少 3 点后，如果当前幕为「山谷的命运（版本四）」：
//     记住「前路已通」。
//
// 读点（数据型条目，规则在章节层）：摆面/连接同 10705a；「失去冷漠」由章节 behavior 在敌军阶段开头
//   写 enemy.aloof / 读 enemy-aloof.js 的 enemyRule.losesAloofWhen（条目无法按地点声明，见 note）；
//   「记住前路已通」是 fateOfTheVale 幕 3a v.IV 的记号。
export default {
  code: '10706b',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale', 'Central'],
    side: 'night', period: 'night', oppositeCode: '10706a',
    printedShroud: 2, printedClues: 2, printedVictory: 0, cluesFixed: false,
    symbol: 'diamond',
    connectsTo: ['triangle', 'square', 'star', 'circle', 'heart', 'moon'],
    central: true,
    shatteredEnemiesLoseAloofDuringEnemyPhase: true,
    reactionEvadeShatteredByThree: { rememberIfActFateOfTheValeIV: ['theRoadIsClear'] },
  },
  note: '数据型地点条目：破敌失去冷漠由章节 behavior 在敌军阶段读点结算（引擎 losesAloofWhen 只挂在敌人条目上）。',
  abilities: [],
}
