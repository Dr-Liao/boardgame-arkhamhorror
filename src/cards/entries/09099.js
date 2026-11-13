// 09099 便携万能工具（Pocket Multi Tool）· 幸存者支援 · 0 经验 · 定制。
// 卡面：定制。每位调查员仅限 1 张。
//       [fast] 在你执行的技能检定期间，横置便携万能工具：你本次检定得到 +1 技能值。
//
// 读点：free 描述子 + trigger（test.beforeCommit/test.afterCommit）+ duringOwnSkillTest；
//       横置费用 + api.addPendingTestBonus；定制勾选 api.tsk.customizable.checked。
//
// P1-8（2026-11-13）：幸运符（Lucky Charm）的「技能检定失败后」应挂**任意**检定失败窗口。
//   引擎在 tests.js:1278/1490 用 triggerReaction('skillTestFail') 派发，该入口末尾会打开
//   能力层窗口（encounter.js:518 openAbilityWindow），因此 reaction 描述子挂 'skillTestFail'
//   可达；旧的 attackFail/investigateFail/evadeFail 只覆盖三类检定的失败窗口。
//   失败 context 不带 seat（tests.js:1276 的 failContext 无 seat 字段），改用 state.skillTest.seat
//   判定「你执行的检定」。
//
// approximation（已写 primitive-request/09099.json）：
//   · Detachable（其他调查员也能用）与 Spring-Loaded（改成「将要失败时」的反应）
//     需要跨座位来源枚举/时点改写，逐项 note；其余勾选项（撬杆/尖刀/信号镜/放大镜/幸运符）已实现。
const CUSTOM_CHECKS = Object.freeze([
  { name: 'Detachable', checks: 1, text: 'Other investigators at your location may use the ability on Pocket Multi Tool.' },
  { name: 'Pry Bar', checks: 1, text: 'You get an additional +1 skill value if this is during a skill test on a treachery.' },
  { name: 'Sharpened Knife', checks: 2, text: 'You get an additional +1 skill value if this is during an attack.' },
  { name: 'Signal Mirror', checks: 2, text: 'You get an additional +1 skill value if this is during an evasion attempt.' },
  { name: 'Magnifying Lens', checks: 2, text: 'You get an additional +1 skill value if this is during an investigation.' },
  { name: 'Lucky Charm', checks: 3, text: 'After you fail a skill test, ready Pocket Multi Tool.' },
  { name: 'Spring-Loaded', checks: 4, text: 'Pocket Multi Tool\'s ability is now a [reaction] ability with the trigger: "When you would fail a skill test you are performing, exhaust Pocket Multi Tool..."' },
])

const checked = (state, inv, index) => {
  const list = state?.campaign?.tsk?.customizations?.bySeat?.[inv?.seat]?.['09099']
  return Array.isArray(list) && list.filter(value => value === index).length > 0
}

export default {
  code: '09099',
  simplified: true,
  note: 'approximation: 见 primitive-request/09099.json（Detachable 跨座位使用与 Spring-Loaded 的失败时点改写未实现，其余勾选项已实现）',
  limitPerInvestigator: true,
  // 本次检定属于攻击/躲避/调查的读点：performTest 只有声明 trackTestTarget 才写 actionKind。
  assetRule: { trackTestTarget: true },
  customizationOptions: CUSTOM_CHECKS,
  abilities: [
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      label: '技能检定期间横置：本次检定 +1 技能值（定制项可再 +1）',
      cost: { action: false, exhaust: true },
      resolve: ({ state, inv, api }) => {
        let amount = 1
        const test = state.skillTest
        const kind = String(test?.actionKind || '')
        if (checked(state, inv, 1) && (state._treacheryResolving || api.cardType(test?.source?.code) === 'treachery')) amount += 1
        if (checked(state, inv, 2) && kind === 'fight') amount += 1
        if (checked(state, inv, 3) && kind === 'evade') amount += 1
        if (checked(state, inv, 4) && kind === 'investigate') amount += 1
        api.addPendingTestBonus(amount)
        api.info(`🧰 「便携万能工具」：本次技能检定 +${amount} 技能值。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'skillTestFail',
      label: '幸运符：技能检定失败后重整便携万能工具',
      criteria: [({ state, inv }) => checked(state, inv, 5) && state.skillTest?.seat === inv.seat],
      resolve: ({ source, api }) => {
        if (!source) return
        api.ready(source)
        api.info('🧰 「便携万能工具」：幸运符生效，重整。')
      },
    },
  ],
  modifiers: [],
}
