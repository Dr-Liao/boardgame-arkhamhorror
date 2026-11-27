// 06273 漆黑蜘蛛（Pitch Spider，敌人，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：descent_into_the_pitch（PONR）。
// 卡面：Spawn - 任意漆黑之海地点（如可能，生成在无人的漆黑之海地点）。
//       Swarming X。X 为本剧本参考卡上的伤害数量。
//       强制 - 在漆黑蜘蛛攻击你时：其不同时造成伤害和恐惧，改为造成其中一项。
// 蜂拥 X 由 scenarioDamage 规格读取剧本参考卡计数；共有的生成与攻击结算分别读取下列声明。
export default {
  code: '06273',
  scope: 'enemy',
  implemented: true,
  flags: {
    spawn: { kind: 'titles', titles: ['Sea of Pitch'], emptyIfAble: true },
    attackDealsEitherDamageOrHorror: true,
  },
}
