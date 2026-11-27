// 09079 传神佳墨（Living Ink）· 秘术师支援 · 0 经验 · 定制。
// 卡面：定制。购买时选择并圈选一个技能。使用(3 充能)。
//       当你每个回合开始时，移除传神佳墨的 1 充能。如果传神佳墨没有充能，将其弃掉。
//       你得到所选技能 +1。
//
const CUSTOM_CHECKS = Object.freeze([
  { name: 'Shifting Ink', checks: 1, text: 'You may play Living Ink under the control of another investigator at your location.' },
  { name: 'Subtle Depiction', checks: 1, text: 'At the start of your turn, you may choose not to remove 1 charge from Living Ink and ignore its ability for the remainder of the round.' },
  { name: 'Imbued Ink', checks: 2, text: 'Living Ink enters play with 2 additional charges and takes up an arcane slot instead of a body slot.' },
  { name: 'Eldritch Ink', checks: 2, text: 'Choose another skill.' },
  { name: 'Eldritch Ink', checks: 3, text: 'Choose another skill.' },
  { name: 'Macabre Depiction', checks: 3, text: 'Living Ink gains: "[reaction] After you reveal a chaos token with a symbol, exhaust Living Ink: Place 1 charge on it."' },
  { name: 'Vibrancy', checks: 3, text: 'Living Ink grants an additional +1 to the chosen skills and -1 to each other skill.' },
])

import { customizationChoiceValues, customizationOptionFullyChecked } from '../../engine/tsk-customizable.js'

const code = '09079'
const skills = ['willpower', 'intellect', 'combat', 'agility']
const isChecked = (checks, index) => checks.filter(option => option === index).length >= CUSTOM_CHECKS[index].checks
const ownerOf = (inv, source) => source.ownerSeat ?? inv.seat
const checked = (state, inv, source, index) => customizationOptionFullyChecked(state, ownerOf(inv, source), code, index)
const suppressionKey = source => `livingInkSuppressed:${source.id}`
const suppressed = (state, source) => state.scenarioFlags?.[suppressionKey(source)] === state.round

function skillAmount({ state, inv, source }, skill) {
  if (suppressed(state, source)) return 0
  const selected = customizationChoiceValues(state, ownerOf(inv, source), code)
  const chosen = selected.length ? selected : ['willpower',
    ...(checked(state, inv, source, 3) ? ['intellect'] : []),
    ...(checked(state, inv, source, 4) ? ['combat'] : [])]
  if (checked(state, inv, source, 6)) return chosen.includes(skill) ? 2 : -1
  return chosen.includes(skill) ? 1 : 0
}

export default {
  code,
  uses: 3,
  usesType: 'charges',
  discardWhenEmpty: true,
  customizationOptions: CUSTOM_CHECKS,
  customizationChoices: { kind: 'skill', base: 1, options: { 3: 1, 4: 1 } },
  customizationEffects: {
    playUnderAnyAtLocation: checks => isChecked(checks, 0),
    slots: checks => isChecked(checks, 2) ? ['Arcane'] : null,
  },
  abilities: [
    {
      kind: 'entersPlay',
      label: '灌墨：额外 2 充能，占用法术槽而非身体槽',
      resolve: ({ state, inv, source, api }) => {
        if (checked(state, inv, source, 2)) api.addUses(source, 2)
      },
    },
    {
      kind: 'forced',
      trigger: 'turnBegins',
      label: '你的回合开始时移除 1 充能',
      criteria: [({ inv, context }) => context.seat === inv.seat],
      resolve: ({ state, inv, source, api }) => {
        if (checked(state, inv, source, 1) && api.choice({
          kind: 'effect', source: code, seat: inv.seat, canSkip: true,
          prompt: '暗纹：可以保留 1 充能并在本轮忽略传神佳墨的能力。',
          options: [{ id: 'remove', label: '移除 1 充能' }, { id: 'retain', label: '保留 1 充能并忽略能力' }],
        }) === 'retain') {
          api.setScenarioFlag(suppressionKey(source), state.round)
        } else {
          api.spendUses(source, 1)
        }
      },
    },
    {
      kind: 'reaction',
      trigger: 'symbolRevealed',
      label: '冥纹：揭示符号标记后，横置并放置 1 充能',
      cost: { exhaust: true },
      criteria: [({ state, inv, source, context }) => context.seat === inv.seat
        && checked(state, inv, source, 5) && !suppressed(state, source)],
      resolve: ({ source, api }) => api.addUses(source, 1),
    },
  ],
  modifiers: skills.map(skill => ({ target: `skill:${skill}`, amount: context => skillAmount(context, skill) })),
}
