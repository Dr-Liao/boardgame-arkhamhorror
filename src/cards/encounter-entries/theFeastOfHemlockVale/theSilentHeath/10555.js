// 10555 水晶果园 · 地点（寂静荒野）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：[action] 在水晶果园的调查员共同花费 1[per_investigator] 个线索：将一张你控制的
//       水晶残骸加入胜利区。
// 印刷：shroud 2、每调查员 1 条线索、特性 [[Blight]]、符号三角（连接等号与圆形）。
// 读点：behavior.actions / performAction 的 silentHeathCrystalGrove（crystalGrove 标记）；
//       印刷数值由 definition.location() 从卡表读取。
export default {
  code: '10555',
  scope: 'location',
  implemented: true,
  flags: { crystalGrove: true },
  note: '数据型条目：地点数值/连接由 definition 读取；行动在 behavior。',
  abilities: [],
}
