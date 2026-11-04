// 07320 伊哈·恩斯雷门扉 · 漩涡深处
//
// 印刷（中文）：
//   正面：无文字（静态地点）。
//   背面（未揭示面「Y'ha-nthlei」）：伊哈·恩斯雷门扉以部分淹没入场（即使其未揭示）。
//
// 引擎读点：
//   · 本章起始地点就是本卡（chapter-data startLocation '07320'）；章节 setup 的
//     lateAfterDeckSetup 也设过一次部分淹没。
//   · 背面「以部分淹没入场（即使未揭示）」由 locationRule.entersPlayFlooded 声明：
//     读点 locations.js#placeLocation，在地点入场时设置水位并派发 floodChanged 窗口。
//
// 一卡一文件：本卡行为只在这里维护；不要写回 encounter-abilities.js。

export default {
  code: '07320', scope: 'location', implemented: true,
  locationRule: { entersPlayFlooded: 1 },
}
