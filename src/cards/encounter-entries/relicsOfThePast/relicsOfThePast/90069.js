// 90069 逃出生天（往昔遗物 · 幕 2）
// 行为实现统一在章节 behavior.js 的既有钩子（startLocation / setup* / actions / performAction /
// actReveal / agendaReveal / allResigned / drawStoryAsset / resolveEncounter / resolution 等）。
// 本条目只声明引擎可直接读取的归属字段；不要写回 encounter-abilities.js。
export default {
  code: '90069',
  name: '逃出生天',
  scope: 'act',
  implemented: true,
}
