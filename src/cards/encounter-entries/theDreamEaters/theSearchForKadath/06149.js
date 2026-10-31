// 06149 千面祭司（theSearchForKadath）· 敌人（类人 / 异教徒，印刷 3 张）
// 卡面：调查员已经发现了……
//       ……2个或更多的神迹时，千面祭司得到攻击值+1与躲避值+1。
//       ……4个或更多的神迹时，千面祭司得到生命值+2。
//       ……6个或更多的神迹时，千面祭司得到伤害值+1，并获得反击。
//
// 一卡一文件：数值阈值数据在这里声明；章节 behavior 的
// enemyStatModifier（攻击/躲避/生命）与 enemyAttackModifier（伤害）读取并接线。
// 数值来源：Haskell PriestOfAThousandMasks.hs（getSignsOfTheGods）。
// 简化：「获得反击」是运行期关键字，引擎只在 definition 解析印刷关键字
// （见 primitive-requests/w-p8-b-dynamic-retaliate.json）。
export default {
  code: '06149', scope: 'enemy', implemented: true,
  enemyRule: {
    signsOfTheGodsBonuses: [
      { atSigns: 2, fight: 1, evade: 1 },
      { atSigns: 4, health: 2 },
      { atSigns: 6, damage: 1, retaliate: true },
    ],
  },
}
