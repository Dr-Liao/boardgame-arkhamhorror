// 06273 漆黑蜘蛛（Pitch Spider，敌人，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：descent_into_the_pitch（PONR）。
// 卡面：Spawn - 任意漆黑之海地点（如可能，生成在无人的漆黑之海地点）。
//       Swarming X。X 为本剧本参考卡上的伤害数量。
//       强制 - 在漆黑蜘蛛攻击你时：其不同时造成伤害和恐惧，改为造成其中一项。
// 实现：Swarming 由 TDE card-data 解析成 scenarioDamage 规格，X 读 state.scenarioFlags.referenceDamage
//   （PONR 章节写），共享层 enemySpawned 自动放蜂拥卡；生成地点写 flags.spawn 供 spawnLocation 数据分派；
//   「伤害/恐惧二选一」需要敌军攻击结算的内容读点 → 已登记 coordinator request。
export default {
  code: '06273',
  scope: 'enemy',
  implemented: true,
  flags: {
    spawn: { kind: 'titles', titles: ['Sea of Pitch'], emptyIfAble: true },
    attackDealsEitherDamageOrHorror: true,
  },
  simplified: true,
  note: '生成地点已由共享 spawnLocation 数据分派；「攻击时伤害/恐惧二选一」需要敌人攻击结算的内容读点（引擎无通道）。',
}
