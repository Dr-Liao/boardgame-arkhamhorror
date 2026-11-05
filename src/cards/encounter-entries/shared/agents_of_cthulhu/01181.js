// 01181 年幼的深潜者（Young Deep One）· 克苏鲁的爪牙（agents_of_cthulhu）
//
// 印刷（中文）：
//   猎物 - [combat]最低。
//   猎手。
//   强制 - 年幼的深潜者与你交战后：受到1点恐惧。
// 印刷（英文）：
//   Prey - Lowest [combat].
//   Hunter.
//   Forced - After Young Deep One engages you: Take 1 horror.
//
// 归属：跨战役复用（夜之狂热 · 地底噬魔 / 印斯茅斯各章）。
//   · 夜之狂热内部用旧运行期键 `youngDeepOne`：`definition.js` 的
//     `identities.enemies.youngDeepOne = { originalCode: '01181' }` 让实例带上 originalCode，
//     能力枚举（ability-rules.js#entityAbilityEntry 先查 originalCode）仍能读到本条目。
//   · 印斯茅斯各章的遭遇牌库直接使用**印刷卡号** 01181（`chapter-data.json` 的 thePitOfDespair/
//     inTooDeep 牌库）：修复前条目以旧键 `youngDeepOne` 注册，`registeredEntry('01181')` 为
//     MISSING，「交战受 1 恐惧」与猎物「[combat] 最低」都不结算（审计 H14）。
//
// 引擎读点：
//   · 「交战后受 1 恐惧」= abilities 的 forced + trigger `enemyEngaged`（读点：
//     enemies.js#engageEnemy → triggerReaction；非玩家实体来源按 originalCode 取条目）。
//   · 「猎物 - [combat] 最低」= 关卡遭遇定义解析印刷文本得到的 `prey: lowestCombat`
//     （content/campaigns/.../card-data.js#encounterDefinitions 的 Prey 规则表），条目不再重复声明。
//   · 「猎手」同样由遭遇定义的印刷文本解析提供。
// 归属目录：跨战役复用 → shared/agents_of_cthulhu/（旧路径 nightOfTheZealot/theDevourerBelow/
// youngDeepOne.js 已按归属算法迁移）。

export default {
  code: '01181',
  name: '年幼的深潜者',
  scope: 'enemy',
  implemented: true,
  text: '猎物 - [combat]最低。猎手。强制 - 年轻深潜者与你交战后：受到1点恐惧。',
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged', silent: true,
    criteria: { when: ({ source, context, inv }) => source?.id === context?.enemy?.id && inv?.seat === context?.seat },
    resolve: ({ api, inv, source }) => {
      api.info(`😱 「${source.name || '年幼的深潜者'}」交战强制：${inv.name} 受到 1 点恐惧。`)
      api.horror(inv.seat, 1)
    },
  }],
}
