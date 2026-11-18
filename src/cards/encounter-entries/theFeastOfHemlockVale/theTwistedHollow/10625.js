// 10625 猎踪混种 · 敌人（牌库 4 张）（theFeastOfHemlockVale/theTwistedHollow）
// 卡面：猎手。警戒。X 为当前黑暗等级（生命值 X）。
//     猎物 - 仅限拥有山谷提灯的调查员。
//     强制 - 猎踪混种攻击你后，如果你控制山谷提灯：将其翻至[[熄灭]]面并放置在你的地点。
// 卡表把 X 生命值记成 -2、伤害/恐惧记成 0；印刷是 1/1，因此 definition 覆盖为 health 0（X 由 behavior.enemyStatModifier 加黑暗等级）、damage 1、horror 1。

export default {
  code: '10625',
  scope: 'enemy',
  implemented: true,
  flags: {
    "stalkingHybrid": true,
    "hunter": true,
    "alert": true,
    "preyLantern": true,
    "healthX": "darkness",
    "printedDamage": 1,
    "printedHorror": 1,
    "attackFlipsLantern": true
  },
  note: "近似：「猎物仅限拥有山谷提灯的调查员」由 behavior.preyRank 给出优先权重；引擎没有 prey 的独立选择器。",
  abilities: [],
}
