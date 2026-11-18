// 10661 破碎自我 Shattered Self · 调查员（换身卡）（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：你的手牌上限减少 3 张。X 为你的手牌数（最多为 5）。[reaction] 在你将卡牌投入你正在执行的技能检定后：该卡牌技能图标翻倍，直到本次检定结束（每次检定一次）。[elder_sign] 效果：+2。你可以抽取 1 张卡牌。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.shatteredSelf / form → behavior.shatterSelves（applyInvestigatorForm 换卡）
//   · flags.handSizePenalty → behavior.handSizePenalty（引擎 api-misc.js#handSizePenalty）
//   · flags.handSizeValueMax → behavior.statModifier（四项技能 = min(手牌数, 5)）
//   · flags.elderSignDelta → behavior.elderSign（引擎 turn-flow.js#elderSignEffect）
//   · flags.oldMemoryCode → behavior.returnToTrueSelf
export default {
  code: '10661',
  scope: 'scenario',
  implemented: true,
  flags: {
    shatteredSelf: true,
    form: 'shattered',
    handSizePenalty: 3,
    handSizeValueMax: 5,
    oldMemoryCode: '10661b',
    elderSignDelta: 2,
  },
  note: 'approximation: [reaction]「投入卡牌的技能图标翻倍」与旧印的「可以抽取 1 张卡牌」缺少条目级窗口/收益读点，只实现手牌上限、X 技能与旧印 +2；破碎自我被击败 → 疯狂按阵亡处理。',
  abilities: [],
}
