// 08641 星之恐怖（Terror of the Stars）· enemy
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   猎手。庞大。
//   星之恐怖得到+3[per_investigator]生命值。
//   星之恐怖处于重整状态时，位于星之恐怖所在地点的调查员不能花费或控制钥匙。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08641",
  scope: "enemy",
  implemented: true,
  enemyRule: {
    hunter: true,
    massive: true,
    perInvestigatorHealth: true,
    blocksKeysWhileReady: true
  }
}
