// 01151 阿卡姆密林 · 扭曲的道路
// 归属：关卡专用 · theDevourerBelow（夜之狂热 · 第三幕：地底噬魔）
// 遭遇组：tentacles
// 卡面：强制 - 在你离开本地点时：检定[intellect](3)。如果你检定失败，取消本次移动的效果。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 扭曲的道路（01151）：离开时智力(3)检定，失败取消本次移动。
// 迁移自 movement.js 的 `prevLoc.id === 'twistingPaths'` 分支（REPORT.md §2.1）。

export default {
  code: '01151',
  name: '阿卡姆密林 · 扭曲的道路',
  scope: 'location',
  text: '强制 - 离开时：智力（3）检定，失败取消本次移动。',
  locationRule: {
    onLeave: { test: { skill: 'intellect', difficulty: 3 }, cancelMessage: '🌀 「扭曲的道路」：{name} 迷路了，移动被取消。' },
  },
}
