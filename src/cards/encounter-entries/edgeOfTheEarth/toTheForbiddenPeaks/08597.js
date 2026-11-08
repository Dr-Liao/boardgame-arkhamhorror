// 08597 失落山峰（Forbidden Peaks）· agenda
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   强制 - 在你移动到一个地点后：将你所有线索放回供应堆。
// 背面：将放在一边的星之恐怖敌人放置入场，位于高度最高的，有调查员的地点。所有位于该地点的调查员各自失去其对所有[[探险]]支援的控制权，并将那些支援放在自己所处的地点。 / 阅读剧本手册中的冒险幕间故事：悲剧袭来。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08597",
  scope: "agenda",
  implemented: true,
  agendaRule: {
    onMove: "returnClues",
    onReveal: "spawnTerrorOfTheStars"
  }
}
