// 08622 恐惧潜伏（Lurking Horrors）· agenda
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [free]在你回合期间，花费1个线索：查看你所在行或列的一个城市景观的已揭示面。(每轮仅限一次。)
//   [free]在你回合期间，花费3个线索：移动到你所在行或列的任意地点。(每轮仅限一次。)
// 背面：阅读剧本手册中的冒险幕间故事：凝视疯狂。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08622",
  scope: "agenda",
  implemented: true,
  agendaRule: {
    freeActions: [
      {
        rule: "cityLookRowOrColumn",
        clues: 1,
        oncePerRound: true,
        label: "花费 1 线索：查看所在行/列一个城市景观的已揭示面（每轮一次）"
      },
      {
        rule: "cityMoveAlongRowOrColumn",
        clues: 3,
        oncePerRound: true,
        label: "花费 3 线索：移动到所在行/列的任意地点（每轮一次）"
      }
    ]
  }
}
