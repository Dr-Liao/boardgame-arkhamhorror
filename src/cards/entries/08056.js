// 08056 刚毅果敢（Moxie）· 游荡者（Rogue）资产 · 3 经验（03111 的升级版）。
//
// 卡面：快速。[[沉稳]]卡牌场上仅限 1 张。
//       你得到 +1[willpower] 和 +1[agility]。
//       非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给刚毅果敢。
//       [free] 花费 1 资源：你本次技能检定得到 +1[willpower] 或 +1[agility]。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：`fast + composure + freeTriggers + modifiers`（assetEffect 合并处，与 03107/03111 同口径）。
// 「非直接恐惧必须先分配给沉稳」由引擎 composure 读点处理；「非直接伤害」目前只有
// redirectOneDamageToSelf 的单点转移，没有同口径的强制先分配 —— 已写 primitive request
// m2-2-08056.json（请求 composureDamage 读点），接线后本卡自动覆盖伤害分支。
export default {
  code: '08056',
  fast: true,
  composure: true,
  freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
    { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
  ],
  abilities: [],
  // approximation: 沉稳关键字只覆盖「非直接恐惧必须先分配」。非直接伤害用旧读点
  // assetRule.redirectOneDamageToSelf 近似（每次伤害结算把 1 点转移到本卡，而非全部）。
  assetRule: { redirectOneDamageToSelf: true },
  modifiers: [
    { target: 'skill:willpower', amount: 1 },
    { target: 'skill:agility', amount: 1 },
  ],
}
