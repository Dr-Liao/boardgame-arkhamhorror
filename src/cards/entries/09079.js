// 09079 传神佳墨（Living Ink）· 秘术师支援 · 0 经验 · 定制。
// 卡面：定制。购买时选择并圈选一个技能。使用(3 充能)。
//       当你每个回合开始时，移除传神佳墨的 1 充能。如果传神佳墨没有充能，将其弃掉。
//       你得到所选技能 +1。
//
// 读点：uses/usesType/discardWhenEmpty（实例初始化 + 描述子结算后的统一弃置读点）；
//       turnBegins 强制移除 1 充能；modifiers 的 skill:* 修正；
//       定制勾选通过 api.tsk.customizable.checked 读取（web 定制面板与这里同一份账本）。
//
// approximation（已写 primitive-request/09079.json）：
//   · 「购买时圈选技能」没有构筑期选择读点。基础所选技能按意志近似；Eldritch Ink（第 4/5 项）
//     分别把智识/战斗追加为所选技能。
//   · Shifting Ink 的「置于其他调查员控制下」需要条目级 playUnderAnyAtLocation 的运行时开关，
//     当前字段是静态布尔，未实现（note）。
//   · Imbued Ink 的「改为占用法术槽」没有实例级槽位覆盖读点，仅实现额外 2 充能（note）。
const CUSTOM_CHECKS = Object.freeze([
  { name: 'Shifting Ink', checks: 1, text: 'You may play Living Ink under the control of another investigator at your location.' },
  { name: 'Subtle Depiction', checks: 1, text: 'At the start of your turn, you may choose not to remove 1 charge from Living Ink and ignore its ability for the remainder of the round.' },
  { name: 'Imbued Ink', checks: 2, text: 'Living Ink enters play with 2 additional charges and takes up an arcane slot instead of a body slot.' },
  { name: 'Eldritch Ink', checks: 2, text: 'Choose another skill.' },
  { name: 'Eldritch Ink', checks: 3, text: 'Choose another skill.' },
  { name: 'Macabre Depiction', checks: 3, text: 'Living Ink gains: "[reaction] After you reveal a chaos token with a symbol, exhaust Living Ink: Place 1 charge on it."' },
  { name: 'Vibrancy', checks: 3, text: 'Living Ink grants an additional +1 to the chosen skills and -1 to each other skill.' },
])

const checkedIndexes = (state, inv) => {
  const list = state?.campaign?.tsk?.customizations?.bySeat?.[inv?.seat]?.['09079']
  return Array.isArray(list) ? list : []
}
const checkedCount = (state, inv, index) => checkedIndexes(state, inv).filter(value => value === index).length
const chosenSkills = (state, inv) => {
  const chosen = new Set(['willpower'])
  if (checkedCount(state, inv, 3) > 0) chosen.add('intellect')
  if (checkedCount(state, inv, 4) > 0) chosen.add('combat')
  return chosen
}
const skillAmount = (state, inv, skill) => {
  const chosen = chosenSkills(state, inv).has(skill)
  const vibrancy = checkedCount(state, inv, 6) > 0
  return (chosen ? 1 : 0) + (vibrancy ? (chosen ? 1 : -1) : 0)
}

export default {
  code: '09079',
  simplified: true,
  note: 'approximation: 见 primitive-request/09079.json（购买时所选技能近似为意志；Shifting Ink 的运行时控制权切换与灌墨的槽位替换未实现）',
  uses: 3,
  usesType: 'charges',
  discardWhenEmpty: true,
  customizationOptions: CUSTOM_CHECKS,
  abilities: [
    {
      kind: 'entersPlay',
      label: '灌墨：额外 2 充能（法术槽替换由 primitive-request 跟踪）',
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        if (checkedCount(state, inv, 2) > 0) {
          api.addUses(source, 2)
          api.info('🖋️ 「传神佳墨」以额外 2 充能入场（灌墨）。')
        }
      },
    },
    {
      kind: 'forced',
      trigger: 'turnBegins',
      label: '你回合开始时：移除 1 充能；没有充能则弃掉',
      criteria: [({ inv, context }) => context?.seat === inv.seat],
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        if (checkedCount(state, inv, 1) > 0) {
          const answer = api.choice({
            kind: 'reaction', source: '09079', seat: inv.seat, canSkip: true,
            prompt: '暗纹：是否选择不移除 1 充能，并在本轮忽略传神佳墨的能力？',
            options: [{ id: 'skip', label: '不移除并忽略能力' }, { id: 'remove', label: '照常移除 1 充能' }],
          })
          if (answer === 'skip') {
            const skillNames = ['willpower', 'intellect', 'combat', 'agility']
            api.addEffect({
              duration: 'endOfRound',
              label: '暗纹：本轮忽略传神佳墨的技能加成',
              modifiers: skillNames.map(skill => ({ target: `skill:${skill}`, amount: -skillAmount(state, inv, skill) }))
                .filter(modifier => modifier.amount !== 0),
            }, inv.seat)
            api.info('🖋️ 「传神佳墨」：暗纹生效，本轮不移除充能且忽略其技能加成。')
            return
          }
        }
        api.spendUses(source, 1)
        api.info('🖋️ 「传神佳墨」：移除 1 充能。')
      },
    },
    {
      kind: 'reaction',
      trigger: 'symbolRevealed',
      label: '冥纹：揭示符号标记后，横置并放置 1 充能',
      cost: { exhaust: true },
      criteria: [({ state, inv, context }) => checkedCount(state, inv, 5) > 0
        && (context?.seat == null || context.seat === inv.seat)],
      resolve: ({ source, api }) => {
        if (!source) return
        api.addUses(source, 1)
        api.info('🖋️ 「传神佳墨」：冥纹生效，放置 1 充能。')
      },
    },
  ],
  modifiers: [
    { target: 'skill:willpower', amount: ({ state, inv }) => skillAmount(state, inv, 'willpower') },
    { target: 'skill:intellect', amount: ({ state, inv }) => skillAmount(state, inv, 'intellect') },
    { target: 'skill:combat', amount: ({ state, inv }) => skillAmount(state, inv, 'combat') },
    { target: 'skill:agility', amount: ({ state, inv }) => skillAmount(state, inv, 'agility') },
  ],
}
