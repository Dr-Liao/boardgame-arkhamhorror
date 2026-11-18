// 10556 珀尔庄园废墟 · 地点（寂静荒野，起始地点）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：[action]：撤退。你将荒野抛在身后。将所有你控制的水晶残骸加入胜利区。
// 印刷：shroud 3、固定 1 条线索、特性 [[Ruins]]、符号等号（连接三角与圆形）。
// 读点：撤退行动由 definition 的地点 resign 字段提供（引擎 legalMoves）；「撤退时把受控水晶
//       残骸加入胜利区」在 behavior.investigatorEliminated（resignRemains 标记）。
export default {
  code: '10556',
  scope: 'location',
  implemented: true,
  flags: { resignRemains: true },
  note: '数据型条目：地点数值由 definition 读取；撤退时的残骸献纳在 behavior。',
  abilities: [],
}
