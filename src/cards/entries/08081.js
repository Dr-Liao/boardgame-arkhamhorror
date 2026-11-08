// 08081 有胆有识（3 级）
// 卡面：快速。[[沉稳]]卡牌场上仅限1张。
//       你得到+1[willpower]和+1[intellect]。
//       非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给有胆有识。
//       [free]花费1资源：你本次技能检定得到+1[willpower]或+1[intellect]。
//
// 读点：
//   · 沉稳（composure）由引擎 harm-threat.js#assignHarm 读「非直接恐惧先分配给本卡」；
//     伤害侧的强制分配暂无引擎读点 → 已提交 primitive request m2-3-08081（见 artifacts/）。
//     approximation: 目前只有恐惧侧生效；伤害仍按普通分配（印刷要求伤害也先分配给本卡）。
//   · 两组 +1 修正走 entry.modifiers（skill:willpower / skill:intellect）。
//   · 资源换 +1 检定走 freeTriggers（与 03115 同构，引擎自动询问档位）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08081',
  fast: true,
  composure: true,
  freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
    { skill: 'intellect', cost: { resources: 1 }, bonus: 1 },
  ],
  abilities: [],
  modifiers: [
    { target: 'skill:willpower', amount: 1 },
    { target: 'skill:intellect', amount: 1 },
  ],
}
