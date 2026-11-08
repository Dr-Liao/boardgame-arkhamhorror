// 08642 和蔼的古老者（Benign Elder Thing）· enemy
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   生成 - 任意无人地点。
//   和蔼的古老者入场带有1个毁灭标记。
//   强制 - 在和蔼的古老者被击败时：在当前密谋上放置1个毁灭标记。
//   [action]：谈判。检定[willpower](3)。如果你检定成功，将和蔼的古老者从游戏中移除。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08642",
  scope: "enemy",
  implemented: true,
  enemyRule: {
    spawn: "anyEmpty",
    onSpawnDoom: 1,
    onDefeatDoom: 1,
    parley: {
      skill: "willpower",
      difficulty: 3,
      effect: "removeFromGame"
    }
  }
}
