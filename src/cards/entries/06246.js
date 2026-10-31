// 06246 迅速撤退
// 卡面：每次技能检定最多投入1张。
//       将迅速撤退在基础躲避行动期间投入时，其获得[agility][agility]和以下文本：
//       “如果本次检定成功且超过难度至少2点，你可以自动躲避你所在地点的另一个敌人。”
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06246 迅速撤退（技能卡）：印刷 1 个敏捷图标。
//   · 「每次技能检定最多投入1张」→ 检定档案 skill.maxPerTest:1（tests.js 的投入过滤读点）；
//   · 「基础躲避行动期间投入时获得 [agility][agility]」→ 条件图标的唯一读点
//     conditionalIcons 只支持 5 种调查员状态条件，没有「检定来源/基础行动」条件，
//     因此用恒真条件（剩余生命+神智 ≥ 0）表达「每次投入都给 +2 敏捷」的近似（显式简化）；
//   · 「成功且超过难度至少2点，自动躲避另一个敌人」→ commit 档案没有「成功后自定义结算」读点，
//     未实现（见 note）。
//
// 显式简化：条件图标按「每次投入都给」近似；成功差值≥2 的自动躲避另一敌人未实现。

export default {
  code: '06246',
  simplified: true,
  note: '未实现：①「仅在基础躲避行动期间投入时」+2 敏捷图标（conditionalIcons 无检定来源条件，'
    + '现按恒真条件近似为每次投入都给）；②检定成功且超过难度≥2时自动躲避另一敌人的成功后结算'
    + '（commit 档案只有 icons / conditionalIcons / onSuccess 数据键，无自定义成功后结算）。',
  abilities: [
    {
      kind: 'commit',
      label: '迅速撤退（投入时获得 +2 敏捷图标）',
      skill: {
        maxPerTest: 1,
        // 恒真条件：等价于「投入即给 +2 敏捷」的近似（引擎没有「基础躲避行动」条件）。
        conditionalIcons: [{ when: { remainingHealthSanityAtLeast: 0 }, icons: { agility: 2 } }],
      },
    },
  ],
  modifiers: [],
}
