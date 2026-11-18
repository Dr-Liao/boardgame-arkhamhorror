// 10584a 虾类混种[day]（Crustacean Hybrid · In the Light）· 双面敌人（白日面，印刷 2 张）
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：逃逸。猎手。虾类混种得到 +X 生命值，X 为当前天数。
//       强制 - 虾类混种将要受到一次攻击的伤害时：将该伤害减少至 1。
//
// 一张卡一个文件：数值走 behavior.enemyStatModifier('health')（+天数），减伤走
// behavior.enemyDamageAmount（攻击来源时取 Math.min(damage, 1)）。
export default {
  code: '10584a',
  scope: 'enemy',
  implemented: true,
  flags: {
    crustaceanHybrid: true,
    hybridSide: 'day',
    partnerCode: '10584b',
    healthByDay: true,
    reduceAttackDamageTo: 1,
    keywords: ['elusive', 'hunter'],
    victory: 0,
    elite: true,
    abomination: true,
    setAside: true,
  },
  note: '近似：enemyDamageAmount 拿到的是来源标识，非攻击来源不视为「一次攻击的伤害」（引擎不提供窗口区别）。',
}
