// 10560 水晶温床 · 地点（寂静荒野，放一边）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：Revelation - 将水晶温床放置入场，与抽取它的地点相邻（[codex] Φ）。
//       [reaction] 你在水晶温床结束自己回合后，受到 1 点直接恐惧：抽取水晶温床底下一堆卡牌中
//       最顶上的一张。（团队每轮仅限一次。）
// 印刷：shroud 3、每调查员 2 条线索、特性 [[Cave]][[Lair]][[Blight]]、单面。
// 读点：behavior.revealCave 读 codex（Φ）→ 生成暗堆；暗堆行动与结束回合反应共用幕 2 的
//       silentHeathDrawBeneath 读点。
export default {
  code: '10560',
  scope: 'location',
  implemented: true,
  flags: { codex: 'crystalNursery', lair: true },
  note: 'approximation：「结束回合后受 1 点直接恐惧再抽取」的强制反应没有逐地点读点，'
    + '当前只保留暗堆抽取行动（恐惧/每轮限次未单独结算）。',
  abilities: [],
}
