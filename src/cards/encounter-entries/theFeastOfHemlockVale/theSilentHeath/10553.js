// 10553 失落的遗产 · 幕 1（寂静荒野）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：目标 - 在一轮结束时，位于珀尔庄园废墟地点的调查员可以共同花费所需数量的线索以推进。
// 背面（The Warrens）：将放在一边的岩中恐怖遭遇组的三张地点随机放置入场，未揭示，与三张
//       起始地点相邻；拿取剩余的放在一边的地点（盐厅、幼虫隧道、水晶温室）以及遭遇牌库顶的
//       3 张卡牌，混洗后随机在每个地点底下正面朝下发 1 张。
// 读点：目标走 definition.ACT_STAGES[1].objective（引擎 act-agenda.js 的轮末共同支付）
//       + behavior.roundEndActIndex（幕 1 只在轮末支付）；背面在 behavior.actReveal 的
//       act1Back（warrensBack 标记）。
export default {
  code: '10553',
  scope: 'act',
  implemented: true,
  flags: { warrensBack: true },
  note: '数据型条目：线索目标由 definition 的 objective 声明；背面布置在 behavior.act1Back。',
  abilities: [],
}
