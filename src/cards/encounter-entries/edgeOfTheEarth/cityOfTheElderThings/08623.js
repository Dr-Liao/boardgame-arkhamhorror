// 08623 自下而来的毁灭（Doom from Below）· agenda
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [free]在你回合期间，花费1个线索：查看你所在行或列的一个城市景观的已揭示面。(每轮仅限一次。)
//   [free]在你回合期间，花费3个线索：移动到你所在行或列的任意地点。(每轮仅限一次。)
// 背面：(→结局2) 队伍被引导至隐秘隧道（参考 DoomFromBelow.hs：AdvanceAgenda 背面 → push R2）。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08623",
  scope: "agenda",
  implemented: true,
  agendaRule: {
    // 引擎 runAgendaReveal（phases.js）在密谋翻到背面时把 content 的 agendaRule.onReveal 交给
    // behavior.agendaReveal 分派：'resolution2' 由它写 R2 记录并用真实 finishScenario 结束本关。
    onReveal: "resolution2",
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
