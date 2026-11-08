// 08608 星之恐怖（Terror of the Stars）· enemy
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   猎手。庞大。
//   星之恐怖得到+3[per_investigator]生命值。
//   X等于你所在地点的高度(至少为1)。
//   强制 - 当一轮结束时：将星之恐怖所在地点的所有调查员移动到下方紧挨着的地点。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
// 读点：behavior.enemyStatModifier（perInvestigatorHealth / levelStats=X 占位）；
//       behavior.roundEnded（roundEnd:"moveDownToBelow"）。Hunter/Massive 由印刷文本在
//       definition.encounterDefinitions 派生，不在条目重抄。
export default {
  code: "08608",
  scope: "enemy",
  implemented: true,
  enemyRule: {
    perInvestigatorHealth: true,
    levelStats: "level",
    roundEnd: "moveDownToBelow"
  }
}
