// xsky · location（合成）· obsidianCanyons
//
// 开阔天空：印刷上由 Ancient Evils / Chilling Cold / Striking Fear 的遭遇卡充当，没有实体地点卡。
// 按 P7 合成地点 schema 登记为 code 'xsky' 的地点（openSky1..14 共用这一份声明）。
// 11641/11642 印刷：「每名非弱点敌人可以如同开阔天空是一处地点般进入或离开开阔天空」
// ——即弱点敌人不能进入/生成在开阔天空。读点：enemy-entry.js#enemyCanEnterLocation（进入/生成/猎人移动共用）。
// 数据型条目：位置显示名/特性由 definition 的合成地点数据提供；本文件只承载地点规则声明。
export default {
  code: 'xsky',
  scope: 'location',
  implemented: true,
  locationRule: { weaknessEnemiesCannotEnter: true },
  note: '合成地点「开阔天空」（openSky1..14）：非弱点敌人可以如地点般进入/离开；弱点敌人不能进入或生成在此（enemy-entry.js#enemyCanEnterLocation 读点）。',
}
