// 07106 印斯茅斯面容 · 当地人
//
// 印刷（中文）：
//   显现 - 将「印斯茅斯面容」放置入场，放到你的威胁区域。
//   你得到-1[intellect]、-1神智，并且你获得[[深潜者]]特性。
//   [action]：检定[willpower](3)。如果你检定成功，弃掉「印斯茅斯面容」。
//
// 引擎读点：
//   · 放置入场：`api.threat(seat, code, { threatEffect })`（威胁区实例）+ `treacheryRule.threatArea`。
//   · 智识 -1 是威胁区卡的修正行：modifierSourceRows 把 inv.threat 当来源、持有者是控制者，
//     因此 `skill:intellect -1` 自动只作用于这张卡的持有者（getStat 走 modifierTotal）。
//   · 神智 -1 走**威胁区效果**通道（`threatEffect.sanityModifier`，与 04085「伊格的诅咒」同一读点，
//     getMaxSanity 直接读它）。注意：修正管线里的 `maxHealth`/`maxSanity` 目标目前**没有读点**
//     （getMaxSanity/getMaxHealth 不带 state，读不到 modifierTotal），因此这里不用它——
//     「声明了没人读」按未实现计。
//   · 「你获得[[深潜者]]特性」= `add:investigatorTrait` 授予目标：读点是 stats 的
//     investigatorTraits（卡面特性 + inv.traits + 声明式授予），由 api.investigatorTraits /
//     describe 的「特性」行消费；卡离场时授予随修正行一起消失，不需要写 inv.traits。
//   · 成功弃牌走 `api.removeThreat`（威胁区卡的唯一弃置写入口）。

export default {
  code: '07106', scope: 'treachery', implemented: true,
  treacheryRule: { threatArea: true },
  modifiers: [
    { target: 'skill:intellect', amount: -1 },
    { target: 'add:investigatorTrait', value: 'Deep One' },
  ],
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '检定意志(3)：成功后弃掉印斯茅斯面容',
    resolve: ({ inv, source, api }) => {
      api.test(inv.seat, 'willpower', 3, {
        source: { type: 'scenario', action: 'activate', code: '07106', name: inv.name, ability: true },
        resolve: result => {
          if (!result.success) return
          api.removeThreat(source)
          api.info?.(`🌊 ${inv.name} 摆脱了「印斯茅斯面容」。`)
        },
      })
    },
  }],
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, '07106', { threatEffect: { sanityModifier: -1 } })
    api.info?.(`🌊 ${inv.name} 被「印斯茅斯面容」缠上：智识 -1、神智 -1，并获得[[深潜者]]特性。`)
    return true
  },
}
