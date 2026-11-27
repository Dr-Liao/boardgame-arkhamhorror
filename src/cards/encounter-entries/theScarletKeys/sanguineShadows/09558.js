// 09558 履约夜魇（Bound Nightgaunt）· enemy
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   猎手。
//   攻击履约夜魇时，揭示的每个混乱标记的负值修正翻倍。
export default {
  code: '09558',
  scope: 'enemy',
  implemented: true,
  enemyRule: { doubleNegativeOnFight: true },
}
