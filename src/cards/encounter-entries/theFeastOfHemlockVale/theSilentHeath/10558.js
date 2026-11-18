// 10558 盐厅 · 地点（寂静荒野，放一边）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：Revelation - 将盐厅放置入场，与抽取它的地点相邻（[codex] Ω）。
//       [action] 在盐厅的调查员共同花费 1[per_investigator] 个线索：抽取盐厅底下一堆卡牌中
//       最顶上的一张。（团队每轮仅限一次。）
// 印刷：shroud 4、每调查员 3 条线索、特性 [[Cave]][[Lair]]、单面。
// 读点：behavior.revealCave 读 codex（Ω）→ 生成地点底下 3 张暗堆；暗堆行动在
//       behavior.actions / performAction（silentHeathDrawBeneath / silentHeathPeekBeneath）。
export default {
  code: '10558',
  scope: 'location',
  implemented: true,
  flags: { codex: 'saltChamber', lair: true },
  note: '数据型条目：地点数值由 definition 读取；法典 Ω 与暗堆在 behavior。',
  abilities: [],
}
