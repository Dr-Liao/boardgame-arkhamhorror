// 12068 萨梯的面具（Mask of Silenus）
// 卡面：使用(3充能)。
//       [reaction] 在你将要揭示一个混乱标记时，花费1充能：额外揭示1个标记。选择其中1个标记结算，并忽略另一个。
//       如果你结算了带有符号的标记，受到1点恐惧。
//
// 读点：
//   · 充能 → uses/usesType；
//   · 「改为揭示 2 个标记、选 1 结算」+「结算符号则 1 恐惧」+「0 充能不弃牌」→ 条目级
//     `chaosTokenExtraReveal: { symbolHorror, keepWhenEmpty }`（tests.js 的扩展读点，与 01071 诡秘石像同款路径：
//     询问是否花 1 充能、双抽、二选一，并忽略另一个）；
//   · symbolHorror: 1 —— 结算的标记带符号（skull/cultist/tablet/elderthing）时受到 1 点恐惧；
//   · keepWhenEmpty: true —— 印刷文本没有「充能耗尽弃掉本卡」，故 0 充能时留在场上。
export default {
  code: '12068',
  uses: 3,
  usesType: 'charges',
  chaosTokenExtraReveal: { symbolHorror: 1, keepWhenEmpty: true },
  abilities: [],
  modifiers: [],
}
