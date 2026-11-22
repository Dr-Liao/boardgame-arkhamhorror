// 82029 · 恐怖狂欢节（carnevaleOfHorrors）
// 归属：关卡专用 · carnevaleOfHorrors/carnevaleOfHorrors。
export default {
  code: '82029',
  scope: 'enemy',
  implemented: true,
  flags: {"spawnRule":"acrossFromLead"},
  note: "「生成 - 你对面地点」由 behavior.spawnLocation 读 flags.spawnRule=acrossFromLead；「不能查看其地点的面具行人另一面」等待阻止查看的读点，本轮未接线；反击由 definition 声明。",
  abilities: [],
}
