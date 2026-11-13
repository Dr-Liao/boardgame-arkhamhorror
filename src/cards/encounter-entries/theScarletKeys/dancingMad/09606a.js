// 09606a 德西德柔·戴佳多·欧瓦瑞兹（Desiderio Delgado Álvarez）· enemy（遭遇牌背版本）
//
// 归属：关卡专用 · theScarletKeys/dancingMad（P7）。
// 卡面（中）：警戒。隐匿1[每人]。猎手。反击。
//   德西德柔·戴佳多·欧瓦瑞兹得到+2[每人]生命值。
//   强制 - 场景1或2期间，在德西德柔·戴佳多·欧瓦瑞兹受到伤害时：改为自动躲避他。
//   [reaction]在躲避德西德柔·戴佳多·欧瓦瑞兹且超过难度至少2点后，如果你所在地点有另一张他，
//   则那一张他对这一张他造成2点伤害。
//
// 逐卡规则写在 `enemyRule` 数据里，读点在本章 `behavior.js`（与其它章节 behavior 读 enemyRule 的
// 约定一致，见 docs/card-entry-files.md §2.1）：
//   · concealed                     → behavior.concealedMiniSet（真身 1 张 + X 张诱饵，X 按人数）
//   · healthPerInvestigatorBonus    → behavior.enemyStatModifier（+2 × 调查员数）
//   · autoEvadeInsteadOfDamageActs  → behavior.enemyDamageAmount（幕 1–2 伤害改为自动躲避）
//   · otherCopyEvadeDamage          → behavior.afterEvade（另一张对他造成 2 点伤害）
// 09607a 是同一张印刷文字的另一份（反面为剧情资产 09607b），规则只在 behavior 实现一次。
export default {
  code: '09606a',
  name: '德西德柔·戴佳多·欧瓦瑞兹',
  scope: 'enemy',
  implemented: true,
  note: '两张德西（09606a/09607a）印刷文字相同、反面不同；规则实现一次（章节 behavior 按 enemyRule 分派），'
    + '本条只声明数据。近似：伤害替换与「另一张对他造成伤害」见 behavior.scenarioApproximations。',
  enemyRule: {
    concealed: { value: 1, perInvestigator: true },
    healthPerInvestigatorBonus: 2,
    autoEvadeInsteadOfDamageActs: [1, 2],
    otherCopyEvadeDamage: 2,
  },
}
