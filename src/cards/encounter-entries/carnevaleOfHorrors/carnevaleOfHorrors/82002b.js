// 82002b · 恐怖狂欢节（carnevaleOfHorrors）
// 归属：关卡专用 · carnevaleOfHorrors/carnevaleOfHorrors。
export default {
  code: '82002b',
  scope: 'enemy',
  implemented: true,
  flags: {"spawnRule":"clockwiseNearestEmptyFromLead"},
  note: "「生成 - 队长逆时针方向最近的、没有调查员的地点」由 behavior.spawnLocation 读 flags.spawnRule=clockwiseNearestEmptyFromLead；猎手/反击由 definition 关键词声明。",
  abilities: [],
}
