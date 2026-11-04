// 07252 惨遭俘获！（Captured!）· 剧情卡（双面）· TIC 第六章《雾中之光》
//
// 印刷（中文）：
//   当第一次有调查员被俘，阅读下列文本：
//   你被五花大绑，拖行在深深的地下，然后扔进一间紧锁的囚室，周围全是滴水的石墙。抓住你的人
//   脚步声渐渐远去，对你的叫喊全都充耳不闻。
//   将被俘的调查员从其地点移除，将该调查员每个占手部槽位的支援返回其手牌。
//   将该调查员的迷你卡牌侧放，以示其被俘。被俘的调查员不能移动、攻击，也不能与敌人交战。
//   将本剧情卡牌翻到"拘禁室"面并放置入场。它不存在于任何已有的行或列，只通过连接图标与
//   沉没岩洞地点连接。将被俘的调查员放在拘禁室。
//   从现在起，每当有调查员被俘，结算相同的效果(将其每个占手部槽位的支援返回手中；侧放其迷你
//   卡牌；将其放到拘禁室)。
//
// 印刷（English）：
//   The first time an investigator is captured, read the following: … Remove the captured
//   investigator from their location and return each asset in that investigator's hand slots to
//   their hand. Turn that investigator's mini-card sideways to indicate that they have been
//   captured. Captured investigators cannot move, fight, or be engaged. Flip this story card over
//   to its "Holding Cells" side and put it into play. It is not on any existing row or column, and
//   is only connected to Sunken Grotto locations through its connection icons. Place the captured
//   investigator in Holding Cells. From now on, whenever an investigator is captured, resolve this
//   same effect.
//
// 模板位置（一卡一文件）：本文件；行为实现在 src/engine/capture.js（捕获原语，唯一写入口）。
//
// 引擎读点：
//   · 首次被俘的物理效果（手槽支援返手 / 解除交战 / 侧放标记 / 放到拘禁室）由
//     src/engine/capture.js#captureSeat 统一结算；本条目用 `flags.captureLocation` 声明翻面结果：
//     剧情面离场 == 翻到背面，背面是地点卡 07252b（拘禁室）。
//   · 坐标 (column 5, row 1) 取 content/campaigns/theInnsmouthConspiracy/chapter-data.json 的
//     setup.expandedMap.holdingCells.displayPosition；excludeFromRowColumn=true → `isolated`，
//     不落在任何行/列；与沉没岩洞的连接由 07252b 的 symbols 动态连线和 locations.js 的
//     linkLocationBySymbols / syncDynamicLocationSymbols 自动完成（只通过连接图标相连）。
//   · 首次剧情文本由引擎在 `captured.storyShown !== true` 时从 state.scenario.storyAssets['07252']
//     的卡面文本下发（kind:'story'）；之后每次被俘只结算同样的物理效果、不再读文本。
//   · 本卡没有 abilities 描述子：它不是窗口/行动来源，行为全部由捕获原语承担
//     （与 07062a「纯参考卡」同口径，但本卡需要 flags 声明翻面目标，故保留条目文件）。
//
// implemented: true（引擎读点 src/engine/capture.js#ensureStoryCaptureLocation 已接线并有测试）。

export default {
  code: '07252', scope: 'storyAsset', implemented: true,
  flags: {
    captureLocation: { code: '07252b', column: 5, row: 1, isolated: true },
  },
}
