// 90083 伊格蛇族（Serpents of Yig）· 中立 · 敌人/弱点 · 进阶（马泰奥神父）。
// 卡面（cards-data 90083）：
//   进阶。猎物 - 仅限马泰奥神父。猎手。
//   显现 - 从混乱袋与所有游戏区域中查找 [elder_sign] 标记与每个 [bless] 标记，将它们封印在伊格蛇族上。
//
// 引擎读点：
//   · 弱点敌人 = 引擎 weakness.js 的 enemy 分支（spawnEnemy 出场）；
//     `enemyWeakness.sealsElderSign` 是该分支读取的显式标记：显现时把混乱袋中的 [elder_sign]
//     封印到敌人上（与 04014 原版同一读点，enemies.js 离场时归还封印标记）。
//   · 猎手/猎物 = enemyWeakness.hunter / prey（敌人行为读点）。
// 缺原语：进阶要求「所有游戏区域中的 [elder_sign] 与每个 [bless] 一起封印」：
//   引擎的 sealsElderSign 只处理混乱袋里的 [elder_sign]，不扫描已封印/场上的同标记，也不处理 bless
//   → primitive-requests/core-cards-a-90083-serpents-advanced-seal.json；当前近似只封印 [elder_sign]。
const code = '90083'

export default {
  code,
  enemyWeakness: { sealsElderSign: true, hunter: true, prey: 'bearer' },
  abilities: [],
  modifiers: [],
  note: '近似：只实现「显现时把混乱袋中的 [elder_sign] 封印在伊格蛇族上」（enemyWeakness.sealsElderSign 既有读点）；「扫描所有游戏区域、并把每个 [bless] 也封印」缺原语 → primitive-requests/core-cards-a-90083-serpents-advanced-seal.json。',
}
