// 10111 雀面具（Sparrow Mask · The Wanderer's Companion）· 潜袭者支援 · 0 经验 · 1 资源 · 无槽位 · 道具/护符/面具
// 卡面：每位调查员仅限 1 张[[面具]]。
//       使用(2 贡品)。你受到伤害和/或恐惧后，补充 1 贡品。
//       [fast] 花费 1 贡品：你本次技能检定得到 +2[willpower] 或 +2[agility]。（每次检定仅限一次。）
//
// 一卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「每位调查员仅限 1 张[[面具]]」= assetRule.controlledTraitLimit: { trait: 'Mask', amount: 1 }
//     （assets.js#exceedsControlledTraitLimit 是唯一读点，canEquip 调用；与 10023/10067 同一原语）。
//   · 使用(2 贡品) = 条目 uses / usesType 'offerings'：实例初始化读 newPlayerAssetInstance，
//     补充走 api.addUses（不设 discardWhenEmpty，耗尽的贡品不清零弃置）。
//   · 「你受到伤害和/或恐惧后」= forced + trigger 'harmAssigned'（enemies.js#applyHarm 在
//     实际受到伤害/恐惧后开窗，context = { seat, damage, horror }；全部分配给支援时 actual 为 0、不开窗）。
//   · 「[fast] 花费 1 贡品：本次检定 +2 意志或 +2 敏捷」= kind:'free' +
//     trigger ['test.beforeCommit','test.afterCommit'] + duringOwnSkillTest（本人的检定）+
//     cost.uses（不花行动）+ limit perTest（每次检定仅限一次）；加值走 api.addPendingTestBonus(2)。
const CODE = '10111'
const MAX_OFFERINGS = 2
const FAST_SKILLS = ['willpower', 'agility']

const testSkills = state => {
  const skill = state.skillTest?.skill
  return Array.isArray(skill) ? skill : (skill ? [skill] : [])
}

export default {
  code: CODE,
  name: 'Sparrow Mask (The Wanderer\'s Companion)',
  uses: MAX_OFFERINGS,
  usesType: 'offerings',
  assetRule: { controlledTraitLimit: { trait: 'Mask', amount: 1 } },
  abilities: [
    {
      kind: 'forced',
      trigger: 'harmAssigned',
      silent: true,
      label: '你受到 1 点或更多伤害/恐惧后：补充 1 个贡品（上限 2）',
      criteria: [({ inv, source, context }) => context?.seat === inv.seat
        && ((Number(context?.damage) || 0) > 0 || (Number(context?.horror) || 0) > 0)
        && (Number(source?.uses) || 0) < MAX_OFFERINGS],
      resolve: ({ source, api }) => {
        api.addUses(source, 1)
        api.info(`🕊 雀面具：受到伤害/恐惧后补充 1 个贡品（${source.uses}/${MAX_OFFERINGS}）。`)
      },
    },
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      cost: { action: false, uses: 1 },
      limit: { scope: 'perTest', owner: 'instance' },
      label: '花 1 贡品：本次[willpower]或[agility]检定 +2 技能值（每次检定仅限一次）',
      criteria: [({ state }) => testSkills(state).some(skill => FAST_SKILLS.includes(skill))],
      resolve: ({ state, inv, api }) => {
        const usable = FAST_SKILLS.filter(skill => testSkills(state).includes(skill))
        if (!usable.length) return
        let skill = usable[0]
        if (usable.length > 1) {
          const answer = api.choice({
            kind: 'effect', source: CODE, seat: inv.seat,
            prompt: '雀面具：本次检定得到 +2[意志]或 +2[敏捷]？',
            options: usable.map(id => ({ id, label: id === 'willpower' ? '+2[意志]' : '+2[敏捷]' })),
          })
          if (usable.includes(answer)) skill = answer
        }
        api.addPendingTestBonus(2)
        api.info(`🕊 雀面具：花费 1 贡品，本次检定 +2${skill === 'willpower' ? '[意志]' : '[敏捷]'}。`)
      },
    },
  ],
  modifiers: [],
}
