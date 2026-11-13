// 09559 猫抓老鼠（Cat and Mouse）· treachery
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   险境。涌动。
//   显现 - 如果你所在地点有隐匿迷你卡牌，你可以将其揭露。如果此效果揭露了敌人迷你卡牌，
//   改为将其翻回，与你所在地点的隐匿迷你卡牌一同正面朝下混洗。
//
// 结算走 chapter behavior：`treacheryRule.resolveKind` 由 behavior 的
// `treacheryHandlerFor()` 分派到 catAndMouse（揭露诱饵 / 翻回真身并重洗）。
export default {
  code: '09559',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { resolveKind: 'catAndMouse' },
  note: '险境/涌动由 definition 的印刷数据（peril/surge）提供，召唤与抽取时机走引擎通用遭遇管线。',
}
