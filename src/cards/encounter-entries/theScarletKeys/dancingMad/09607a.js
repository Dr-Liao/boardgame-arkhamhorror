// 09607a 德西德柔·戴佳多·欧瓦瑞兹（Desiderio Delgado Álvarez）· enemy（与剧情资产 09607b 同面）
//
// 归属：关卡专用 · theScarletKeys/dancingMad（P7）。
// 卡面（中）：警戒。隐匿1[每人]。猎手。反击。
//   德西德柔·戴佳多·欧瓦瑞兹得到+2[每人]生命值。
//   强制 - 场景1或2期间，在德西德柔·戴佳多·欧瓦瑞兹受到伤害时：改为自动躲避他。
//   [reaction]在躲避德西德柔·戴佳多·欧瓦瑞兹且超过难度至少2点后，如果你所在地点有另一张他，
//   则那一张他对这一张他造成2点伤害。
//
// 与 09606a 是同一段印刷文字的两个卡位（本张反面为剧情资产 09607b）：规则在 `behavior.js` 实现一次，
// 两个条目只声明同一份 enemyRule 数据（读点：concealedMiniSet / enemyStatModifier /
// enemyDamageAmount / afterEvade）。`linkedCardCode` 由卡表给出（09607b），卡片行为不重复写。
export default {
  code: '09607a',
  name: '德西德柔·戴佳多·欧瓦瑞兹',
  scope: 'enemy',
  implemented: true,
  note: '与 09606a 同一段印刷文字；反面是剧情资产 09607b。行为实现一次（章节 behavior），本条只声明数据。',
  enemyRule: {
    concealed: { value: 1, perInvestigator: true },
    healthPerInvestigatorBonus: 2,
    autoEvadeInsteadOfDamageActs: [1, 2],
    otherCopyEvadeDamage: 2,
  },
}
