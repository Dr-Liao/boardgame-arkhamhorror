// 09558 履约夜魇（Bound Nightgaunt）· enemy
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   猎手。
//   攻击履约夜魇时，揭示的每个混乱标记的负值修正翻倍。
//
// 实现口径：引擎的 `enemyRule.doubleNegative` 读点在 test 的 doubleNegative 选项（combat.js 的
// 躲避路径）；攻击路径没有对应读点，因此本卡按现有读点接线并在 note 里披露差异，
// 攻击路径的翻倍登记为原语请求 extend.doubleNegativeOnFight。
export default {
  code: '09558',
  scope: 'enemy',
  implemented: true,
  simplified: true,
  enemyRule: { doubleNegative: true },
  note: '近似：`enemyRule.doubleNegative` 的引擎读点是躲避该敌人时翻倍（combat.js#doEvade → tests.js 的 doubleNegative）。印刷写的是「攻击它时」，攻击路径的负值翻倍需要新读点，已登记原语请求 extend.doubleNegativeOnFight；在它落地前本卡只在躲避路径生效。',
}
