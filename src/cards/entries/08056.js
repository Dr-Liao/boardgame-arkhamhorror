// 08056 刚毅果敢（Moxie）· 游荡者（Rogue）资产 · 3 经验（03111 的升级版）。
//
// 卡面：快速。[[沉稳]]卡牌场上仅限 1 张。
//       你得到 +1[willpower] 和 +1[agility]。
//       非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给刚毅果敢。
//       [free] 花费 1 资源：你本次技能检定得到 +1[willpower] 或 +1[agility]。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：`fast + composure + freeTriggers + modifiers`（assetEffect 合并处，与 03107/03111 同口径）。
// 非直接伤害与恐惧分配都须在调查员卡之前优先承接。
export default {
  code: '08056',
  fast: true,
  composure: true,
  freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
    { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
  ],
  abilities: [],
  flags: { composureDamage: true },
  modifiers: [
    { target: 'skill:willpower', amount: 1 },
    { target: 'skill:agility', amount: 1 },
  ],
}
