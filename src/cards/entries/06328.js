// 06328 神识之眼
// 卡面：多重。使用(3秘密)。
//       [reaction]在你将要检定你的[intellect]、[combat]或[agility]时，花费1秘密：改为检定你的[willpower]。
//       [free]弃掉你手中的一张神识之眼：在这张神识之眼上放置2秘密。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06328 神识之眼（[[仪式]]支援，多重）：
//   · [reaction] 检定开始时（testBegins 窗口）花 1 秘密把本次检定的技能改为意志：
//     引擎没有「替换本次检定技能」的通用 API，但 testBegins 窗口里写入的 pendingBonus
//     会在成算前并入检定值（tests.js ST.2 的 pendingBonus 读点），因此按「意志值 - 原技能值」
//     把本次检定的技能值改成意志值（等价于用意志代替该技能），只在单一目标技能时提供；
//   · [free] 弃掉手中一张同名卡，给本拷贝 +2 秘密：criteria 要求手牌有同名卡，
//     resolve 走 api.discardFromHand + api.addUses。
// 显式简化：以「技能值改为意志」而不是「技能本身替换为意志」，因此不影响依赖检定技能的其它效果。


const REPLACEABLE = ['intellect', 'combat', 'agility']

function testingSkill(context) {
  const list = Array.isArray(context?.skill) ? context.skill : [context?.skill]
  return list.length === 1 ? list[0] : null
}

export default {
  code: '06328',
  uses: 3,
  usesType: 'secrets',
  simplified: true,
  note: '以「本次检定技能值改为意志值」近似「改为检定意志」（引擎没有替换本次检定技能的 API；'
    + 'pendingBonus 读点只改检定值，不改变 test.skill 本身）。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'testBegins',
      label: '花费 1 秘密：本次检定的技能值改为你的意志值',
      cost: { uses: 1 },
      // 每次技能检定最多用一次（否则能力窗口的询问循环会重复提供同一反应）。
      limit: 'oncePerTest',
      criteria: [({ inv, context }) => context?.seat === inv.seat && REPLACEABLE.includes(testingSkill(context))],
      resolve: ({ inv, api, context }) => {
        const skill = testingSkill(context)
        if (!skill) return
        const delta = api.stat(inv.seat, 'willpower') - api.stat(inv.seat, skill)
        if (delta) api.addPendingTestBonus(delta)
        api.info(`👁 ${inv.name} 花费 1 秘密：「神识之眼」把本次检定改为按意志值结算。`)
      },
    },
    {
      kind: 'action',
      label: '[free] 弃掉手中一张「神识之眼」：在这张神识之眼上放置 2 秘密',
      cost: { action: false },
      criteria: [({ inv }) => (inv?.hand || []).includes('06328')],
      resolve: ({ inv, api, source }) => {
        if (!source) return
        if (!(inv.hand || []).includes('06328')) { api.info('手中没有另一张「神识之眼」。'); return }
        api.discardFromHand(inv.seat, '06328')
        api.addUses(source, 2)
        api.info(`👁 ${inv.name} 弃掉一张「神识之眼」，在这张上放置 2 秘密（当前 ${source.uses}）。`)
      },
    },
  ],
  modifiers: [],
}
