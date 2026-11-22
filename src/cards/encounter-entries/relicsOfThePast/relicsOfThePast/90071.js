// 90071 内部密室（往昔遗物 · 内部密室）
// 行为实现统一在章节 behavior.js 的既有钩子（startLocation / setup* / actions / performAction /
// actReveal / agendaReveal / allResigned / drawStoryAsset / resolveEncounter / resolution 等）。
// 本条目只声明引擎可直接读取的归属字段；不要写回 encounter-abilities.js。
export default {
  code: '90071',
  name: '内部密室',
  scope: 'location',
  implemented: true,
}
