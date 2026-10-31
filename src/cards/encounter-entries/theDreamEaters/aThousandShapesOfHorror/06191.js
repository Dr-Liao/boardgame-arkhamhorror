// 06191 诡计「难以描述的鬼魅」（Indescribable Apparition）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：
// 显现 - 将难以描述的鬼魅放置入场，放到你的威胁区域。
// 不可名状之物位于你所在地点时，你得到每项技能值 -1。
// [action] [action]：弃掉难以描述的鬼魅。
//
// 依据 Haskell Treachery/Cards/.../IndescribableApparition.hs：
//   · 进威胁区 → encounterResolve 调 api.threat；
//   · 每项技能 -1 → treacheryRule.skillModifierWhileEnemyAtYourLocation 数据，
//     本章 behavior.statModifier 在转发共享层后遍历威胁区结算（不写调查员实例字段）；
//   · [action][action] 弃掉 → threatAction（noTest + actions: 2），共享层 performEncounterAction 结算。
export default {
  code: '06191',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    threatArea: true,
    skillModifierWhileEnemyAtYourLocation: { enemyCode: '06169b', amount: -1 },
  },
  threatAction: {
    rule: 'tshDiscardIndescribableApparition',
    label: '[action][action]：弃掉「难以描述的鬼魅」',
    actions: 2,
    noTest: true,
    target: 'threat',
  },
  encounterResolve(state, inv, treachery, api) {
    api.threat?.(inv.seat, '06191')
    api.info?.(`👻 「难以描述的鬼魅」进入 ${inv.name} 的威胁区域（不可名状之物在场时全技能 -1）。`)
    return true
  },
}
