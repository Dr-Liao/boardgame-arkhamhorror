// 10572 失踪的姐妹（The Missing Sibling）· 幕 1
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：强制 - 在发现了[[洞穴]]地点最后的线索后：把岩穴牌库顶的卡牌放进场，与该地点相邻。
//       目标 - 找到伊丽莎白·彼得斯！如果调查员「找到了磨损的狗链」并「发现了一串足迹」，立即推进。
// 背面：选一个[[海岸]]地点（尽量没有调查员），把放一边的真菌洞穴放到它旁边；
//       再用岩穴牌库顶补到真菌洞穴连接 4 个地点（或牌库为空）。
//
// 一张卡一个文件：目标判定在 behavior.checkObjectives，强制扩图在 behavior.cluesGained，
// 背面在 behavior.actReveal（placeFungalCaveAdjacent + fillFungalCaveNeighbors）。
export default {
  code: '10572',
  scope: 'act',
  implemented: true,
  abilities: [],
  flags: {
    actStage: 1,
    objective: 'remembered',
    objectiveMemories: ['foundATornDogLeash', 'foundASetOfFootprints'],
    forcedOnLastClueFromCave: 'placeCavernCardAdjacent',
    backPlacesFungalCave: true,
    backFillsToFourConnections: true,
  },
  note: '数据型条目：两个 Remembered 的读点只有 REMEMBERED 常量，幕目标与扩图在章节 behavior。',
}
