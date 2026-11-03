// 07292a 达贡（沉睡面）· 达贡密教巢穴
//
// 印刷（中文）：
//   达贡正在沉睡。他不能攻击，不能与调查员交战，免疫调查员行动和玩家卡牌效果。
//   强制 - 本地点的调查员技能检定失败后：在达贡上放置1资源。然后，如果达贡上有至少
//          1[per_investigator]+2资源，将他翻面。
//   [action] 花费1钥匙：从达贡上移除1资源。
//
// 引擎读点：
//   · 「沉睡」= enemyRule.slumbering。免疫/不能攻击/不能交战全部由 effect-provenance 的
//     enemyEffectAllowed / enemyPlayerEffectBlocked 在攻击、交战、伤害与各写入口统一执行；
//     圣堂地点这类遭遇来源的自动躲避/横置仍然照常。
//   · 检定失败窗口是 testEnds（引擎只在有监听者时派发），context.result.success 判定失败，
//     inv 是本次检定的调查员（窗口按 context.seat 决定座位）。
//   · 翻面走物理换面：07292b 的 linkedToCode 指回 07292a，换面保留实例 id/计数/附件。

const ALL_KEY_COLORS = ['red', 'yellow', 'green', 'blue', 'purple', 'white', 'black']

export default {
  code: '07292a', scope: 'enemy', implemented: true,
  enemyRule: { slumbering: true },
  abilities: [{
    kind: 'forced', trigger: 'testEnds',
    label: '本地点的调查员技能检定失败后：在达贡上放置1资源，达到 1[per_investigator]+2 时翻面',
    criteria: ({ inv, source, context }) => Boolean(source && inv && context?.result
      && context.result.success === false && inv.location === source.location),
    resolve: ({ state, source, api }) => {
      const resources = Number(source.resources || 0) + 1
      api.scenario.setEnemyResources(source, resources)
      // 1[per_investigator] + 2：按当前调查员人数计算，达到即翻面（同一窗口只翻一次）。
      if (resources < state.numInvestigators + 2) return
      if (source.code === '07292a') api.scenario.flipEnemy(source, '07292b')
    },
  }, {
    kind: 'action', actionKind: 'activate',
    label: '花费1个钥匙：从达贡上移除1个资源',
    additionalKeyCost: { colors: ALL_KEY_COLORS, scope: 'here' },
    criteria: ({ source }) => Number(source?.resources || 0) > 0,
    resolve: ({ source, api }) => {
      api.scenario.setEnemyResources(source, Math.max(0, Number(source.resources || 0) - 1))
    },
  }],
}
