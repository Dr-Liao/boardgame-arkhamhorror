// 07292b 达贡（苏醒狂怒）· 达贡密教巢穴
//
// 印刷（中文）：
//   庞大。
//   达贡得到 +6[per_investigator] 生命值。
//   强制 - 本地点的调查员技能检定失败后：重整达贡。达贡攻击该调查员。
//
// 引擎读点：
//   · 生命值 = 印刷 6 + 本卡条目的 enemyHealth 修正（6 × 调查员人数），逐次读点计算，
//     不写 state；换面回 07292a 后修正随当前面一起失效。
//   · 「检定失败」监听与 07292a 同一窗口：testEnds + context.result.success === false，
//     inv 是本次检定的调查员；本能力在沉睡面不存在，因此免疫守卫不会挡住自己的强制。
//   · 「重整 + 攻击」都走 scenarioRuntime 的写入口（沉睡守卫只拦玩家卡来源，这里是敌人卡
//     自己的强制，来源是遭遇卡）。

export default {
  code: '07292b', scope: 'enemy', implemented: true,
  modifiers: [{
    target: 'enemyHealth',
    amount: ({ state }) => 6 * state.numInvestigators,
  }],
  abilities: [{
    kind: 'forced', trigger: 'testEnds',
    limit: { scope: 'perWindow', owner: 'instance' },
    label: '本地点的调查员技能检定失败后：重整达贡，达贡攻击该调查员',
    criteria: ({ inv, source, context }) => Boolean(source && inv && context?.result
      && context.result.success === false && inv.location === source.location),
    resolve: ({ inv, source, api }) => {
      api.scenario.readyEnemy(source)
      api.scenario.attack(source, inv)
    },
  }],
}
