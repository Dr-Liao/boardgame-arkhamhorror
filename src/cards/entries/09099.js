// 09099 便携万能工具（Pocket Multi Tool）· 幸存者支援 · 0 经验 · 定制。
// 卡面：定制。每位调查员仅限 1 张。
//       [fast] 在你执行的技能检定期间，横置便携万能工具：你本次检定得到 +1 技能值。
//
const CUSTOM_CHECKS = Object.freeze([
  { name: 'Detachable', checks: 1, text: 'Other investigators at your location may use the ability on Pocket Multi Tool.' },
  { name: 'Pry Bar', checks: 1, text: 'You get an additional +1 skill value if this is during a skill test on a treachery.' },
  { name: 'Sharpened Knife', checks: 2, text: 'You get an additional +1 skill value if this is during an attack.' },
  { name: 'Signal Mirror', checks: 2, text: 'You get an additional +1 skill value if this is during an evasion attempt.' },
  { name: 'Magnifying Lens', checks: 2, text: 'You get an additional +1 skill value if this is during an investigation.' },
  { name: 'Lucky Charm', checks: 3, text: 'After you fail a skill test, ready Pocket Multi Tool.' },
  { name: 'Spring-Loaded', checks: 4, text: 'Pocket Multi Tool\'s ability is now a [reaction] ability with the trigger: "When you would fail a skill test you are performing, exhaust Pocket Multi Tool..."' },
])

// 2026-11-16 P2-3：Sharpened Knife/Signal Mirror/Magnifying Lens（2 格）与 Lucky Charm（3 格）
// 必须勾满才生效；Pry Bar（1 格）不受影响。
import { customizationOptionFullyChecked } from '../../engine/tsk-customizable.js'

const code = '09099'
const checked = (state, owner, index) => customizationOptionFullyChecked(state, owner.seat, code, index)
const controller = (state, inv, source) => state.investigators.find(owner =>
  owner.assets.some(asset => asset.id === source.id)) || inv

function testBonus({ state, inv, source, api }) {
  const owner = controller(state, inv, source)
  const test = state.skillTest
  let amount = 1
  if (checked(state, owner, 1) && (state._treacheryResolving || api.cardType(test?.source?.code) === 'treachery')) amount++
  if (checked(state, owner, 2) && test?.actionKind === 'fight') amount++
  if (checked(state, owner, 3) && test?.actionKind === 'evade') amount++
  if (checked(state, owner, 4) && test?.actionKind === 'investigate') amount++
  return amount
}

export default {
  code,
  limitPerInvestigator: true,
  assetRule: { trackTestTarget: true },
  teamActivatable: ({ state, owner }) => checked(state, owner, 0),
  customizationOptions: CUSTOM_CHECKS,
  abilities: [
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      label: '技能检定期间横置：本次检定 +1 技能值（定制项可再 +1）',
      cost: { exhaust: true },
      criteria: [({ state, inv, source }) => !checked(state, controller(state, inv, source), 6)],
      resolve: args => args.api.addPendingTestBonus(testBonus(args)),
    },
    {
      kind: 'reaction',
      trigger: 'testWouldFail',
      allowTeamActivation: true,
      label: '弹簧式：将要检定失败时横置，本次检定 +1 技能值（定制项可再 +1）',
      cost: { exhaust: true },
      criteria: [({ state, inv, source, context }) => {
        const owner = controller(state, inv, source)
        return context.seat === inv.seat && checked(state, owner, 6)
          && (owner === inv || checked(state, owner, 0))
      }],
      resolve: args => args.api.setReactionFlag('testBonus', (args.context.testBonus || 0) + testBonus(args), args.context),
    },
    {
      kind: 'reaction',
      trigger: 'skillTestFail',
      label: '幸运符：你检定失败后重整便携万能工具',
      criteria: [({ state, inv, source }) => source.exhausted && checked(state, inv, 5)
        && state.skillTest?.seat === inv.seat],
      resolve: ({ source, api }) => api.ready(source),
    },
  ],
  modifiers: [],
}
