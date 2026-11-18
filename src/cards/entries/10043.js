// 10043 鼠面具（Mouse Mask）· 温顺的守望者 · 探寻者支援 · 无槽位 · [[道具]]/[[护符]]/[[面具]]
// 卡面：
//   每位调查员仅限 1 张 [[面具]]。
//   使用（2 贡品）。你揭示地点或将新的地点放置入场后，补满其中的 1 个贡品。
//   [fast] 花费 1 贡品：你本次技能检定得到 +2 [willpower] 或 +2 [intellect]。（每次检定仅限一次。）
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 每位调查员仅限 1 张 [[面具]] = 条目级 assetRule.controlledTraitLimit
//     （assets.js#exceedsControlledTraitLimit，canEquip / assetReplacementPlans 共用一份判定）。
//   · 贡品 = 本卡实例上的 uses（usesType 'offerings'，与 09123 的贡品同款元数据）。
//   · 「新的地点放置入场后」= 窗口 locationPlaced（locations.js#placeLocation 在 placeLocation 后开窗，
//     context = { when, seat, location }；只有存在监听者时才开窗，见 window-listeners.js）。
//   · 「[fast] 花费 1 贡品」= free 描述子 + cost.uses，挂 test.beforeCommit / test.afterCommit 玩家窗口
//     （performTest 在投入前/揭示前开窗）；「每次检定仅限一次」= limit { scope: 'perTest', owner: 'instance' }。
//   · 「+2 意志或 +2 智识」= 本次检定的技能加值（api.addPendingTestBonus，与 09123 的「+2 技能值」同一读点）。
//
// approximation（simplified）：
//   1. 「揭示地点后补满贡品」缺少描述子窗口读点：locations.js#revealLocation 只调用旧式
//      triggerReaction('locationRevealed')（只结算 legacyReaction），没有 reactionWindow 调用点，
//      因此声明式描述子收不到该时机。当前只在「新地点放置入场」（locationPlaced）时补满；
//      见 artifacts/migration/fhv/primitive-requests/10043.json。
//   2. 「+2 意志或 +2 智识」用检定层面的 +2 实现（引擎没有「只对某技能加值」的写入点）；两者在本卡
//      允许的检定里等价。
export default {
  code: '10043',
  name: '鼠面具',
  uses: 2,
  usesType: 'offerings',
  assetRule: { controlledTraitLimit: { trait: 'Mask', amount: 1 } },
  simplified: true,
  note: 'approximation: 「揭示地点后补满贡品」缺描述子窗口读点（locationRevealed 只走旧式 triggerReaction），当前只在新地点入场（locationPlaced）时补满；+2 意志/智识按本次检定 +2 结算。见 primitive-requests/10043.json。',
  abilities: [
    {
      kind: 'forced',
      trigger: 'locationPlaced',
      id: 'mouseMaskReplenishOnPlacement',
      label: '新地点入场后：补满 1 个贡品',
      criteria: [({ source }) => Boolean(source) && (Number(source.uses) || 0) < 2],
      resolve: ({ source, api }) => {
        const room = 2 - (Number(source.uses) || 0)
        if (room <= 0) return
        api.addUses(source, 1)
        api.info(`🎭 「鼠面具」：新地点入场，补满 1 个贡品（共 ${source.uses || 0} 个）。`)
      },
    },
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      id: 'mouseMaskBoost',
      label: '[fast] 花费 1 贡品：本次检定 +2 意志或 +2 智识（每次检定一次）',
      cost: { uses: 1 },
      limit: { scope: 'perTest', owner: 'instance' },
      criteria: [({ state }) => [].concat(state.skillTest?.skill || [])
        .some(skill => skill === 'willpower' || skill === 'intellect')],
      resolve: ({ state, inv, api }) => {
        const skills = [].concat(state.skillTest?.skill || [])
          .filter(skill => skill === 'willpower' || skill === 'intellect')
        if (!skills.length) return
        const skill = skills.length === 1 ? skills[0] : api.choice({
          kind: 'skill', source: '10043', seat: inv.seat,
          prompt: '「鼠面具」：选择本次检定 +2 的技能。',
          options: skills.map(item => ({ id: item, label: item === 'willpower' ? '+2 意志' : '+2 智识' })),
        })
        api.addPendingTestBonus(2)
        api.info(`🎭 「鼠面具」：花费 1 贡品，本次检定 +2（${skill === 'willpower' ? '意志' : '智识'}）。`)
      },
    },
  ],
  modifiers: [],
}
