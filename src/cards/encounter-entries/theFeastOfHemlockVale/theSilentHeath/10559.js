// 10559 幼虫隧道 · 地点（寂静荒野，放一边）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：Revelation - 将幼虫隧道放置入场，与抽取它的地点相邻。查找遭遇牌库和遭遇弃牌堆，
//       找出一张无彩幼虫敌人并将其生成在本地点（[codex] Ψ）。
//       [reaction] 你成功躲避位于幼虫隧道的敌人后：抽取本地点底下一堆卡牌中最顶上的一张。
//       （团队每轮仅限一次。）
// 印刷：shroud 2、每调查员 3 条线索、特性 [[Cave]][[Lair]]、单面。
// 读点：behavior.revealCave 读 searchLarva（搜索无彩幼虫）与 codex（Ψ 暗堆）；
//       「躲避成功后抽取暗堆顶」与盐厅/水晶温床共用幕 2 的暗堆行动读点。
export default {
  code: '10559',
  scope: 'location',
  implemented: true,
  flags: { codex: 'larvalTunnel', searchLarva: true, lair: true },
  note: 'approximation：「成功躲避后抽取暗堆顶」没有逐地点反应读点，统一由幕 2 的'
    + ' silentHeathDrawBeneath 行动覆盖（同一堆、同一张顶牌）。',
  abilities: [],
}
