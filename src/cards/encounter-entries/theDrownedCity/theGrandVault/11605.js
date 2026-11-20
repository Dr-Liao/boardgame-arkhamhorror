// 11605 黑暗中的滑行者 · 敌人（生成：最近的淹没地点；不能进入未淹没地点；敌军阶段强制攻击/移动）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 近似：生成规则与「不能进入未淹没地点」只在条目声明；生成落点的最近淹没筛选与敌军阶段强制尚未接线（引擎没有敌人侧「最近淹没地点」生成钩子），见 worker 报告。
export default {
  code: '11605',
  scope: 'enemy',
  implemented: true,
  flags: {"spawnNearestFlooded":true,"cannotEnterUnflooded":true},
  note: "生成规则与「不能进入未淹没地点」只在条目声明；生成落点的最近淹没筛选与敌军阶段强制尚未接线（引擎没有敌人侧「最近淹没地点」生成钩子），见 worker 报告。",
  abilities: [],
}
