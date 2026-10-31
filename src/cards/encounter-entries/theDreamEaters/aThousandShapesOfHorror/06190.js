// 06190 诡计「无尽深入」（Endless Descent）· 万千骇形（4 张）
// 归属：关卡专用 · aThousandShapesOfHorror。卡面（显现）：将位于最上方地点的所有调查员和敌人移动到其
// 连接的下方地点。将最上方的地点翻至其未揭示面，弃掉其所有标记和附属，将其放到最下方的地点下方。
// 将所有未揭示的地点混洗以打乱位置，使你无法辨认。将本卡牌加入胜利区。
//
// 依据 Haskell Treachery/Cards/.../EndlessDescent.hs：
//   这段要重排整条纵向地点链（翻回未揭示面、清标记/附属、把顶点挪到底部、洗乱未揭示地点），
//   不是单卡效果能由 api 表达的一次性顺序（需要同时改多条地点的 verticalIndex/connections，
//   并保留「哪张是随机阶梯」的身份）。因此流程放在本章 behavior.js 的 `endlessDescent` 流程里
//   （TCU 的同类跨卡顺序也留在 behavior），条目只声明 flow id 与实现标记；behavior 按数据分派，不写卡号分支。
export default {
  code: '06190',
  scope: 'treachery',
  implemented: true,
  flags: { flow: 'endlessDescent' },
  note: '显现的「重排纵向链 + 翻面 + 清标记/附属 + 洗乱未揭示地点 + 进胜利区」由 behavior.resolveEncounter 的 endlessDescent 流程结算。',
}
