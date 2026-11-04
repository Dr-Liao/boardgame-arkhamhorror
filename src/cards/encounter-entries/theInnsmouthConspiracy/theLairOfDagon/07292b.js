// 07292b 达贡（苏醒狂怒面）· 达贡密教巢穴
//
// 印刷（中文）：
//   庞大。
//   达贡得到 +6[per_investigator]生命值。
//   强制 - 本地点的调查员技能检定失败后：重整达贡。达贡攻击该调查员。
//
// 引擎读点：
//   · 「庞大」等印刷关键词来自关卡遭遇定义（content 侧按印刷文本生成 enemyDef），
//     物理换面时由 physical-faces 的 ENEMY_FLAGS 按新面重设，条目不再重复声明。
//   · 生命值加成走条目 `modifiers: enemyHealth`（entityModifierTotal 的唯一读点）：
//     印刷 6 点 + 每名调查员 6 点，所以是「基础值 + 6 × 人数」，2 人局为 18。
//   · 检定失败窗口是 testEnds（只在真有监听者时派发）。换面后 `source` 已是同一张物理卡，
//     重整与攻击都走 scenarioRuntime 的写入口；此时条目已不是 slumbering，不必特殊放行。
//     注意：翻面的那一次检定失败不会回头结算新面的能力（时间线在旧面上已经过去）。

export default {
  code: '07292b', scope: 'enemy', implemented: true,
  modifiers: [{
    target: 'enemyHealth',
    amount: ({ state }) => 6 * state.numInvestigators,
  }],
  abilities: [{
    kind: 'forced', trigger: 'testEnds',
    label: '本地点的调查员技能检定失败后：重整达贡，达贡攻击该调查员',
    criteria: ({ inv, source, context }) => Boolean(inv && context?.result
      && context.result.success === false && inv.location === source.location),
    resolve: ({ inv, source, api }) => {
      api.scenario.readyEnemy(source)
      api.scenario.attack(source, inv)
    },
  }],
}
