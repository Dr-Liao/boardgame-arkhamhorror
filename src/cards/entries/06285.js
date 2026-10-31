// 06285 黑猫
// 卡面：每当你在技能检定期间揭示[tablet]、[elder_thing]或[elder_sign]符号，你可以不使用该符号的效果，
//       改为选择使用以下效果：
//       [tablet]：-1。黑猫受到1点直接伤害。
//       [elder_thing]：-1。黑猫受到1点直接恐惧。
//       [elder_sign]：+5。治愈黑猫的全部伤害和恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06285 黑猫（[[盟友]]·[[化身]]）：纯数据卡——槽位/图标/特性都在 cards-data，条目无需额外行为。
// 显式简化：符号效果「替换」没有引擎读点（现有 state.skillTest.symbolEffect 是 05033 的
//   「取消/额外结算 Mystic 卡符号效果」候选语义，不是把标记效果替换成自定义值），因此主效果未实现；
//   符号修正值与「黑猫承受直接伤害/恐惧、elder_sign 治愈」都无法从卡面声明触发。
// 纯数据通道已实现：[[盟友]]槽位、2 个万能图标由卡面数据进入构筑/投入/槽位读点。

export default {
  code: '06285',
  simplified: true,
  note: '未实现：卡面主效果「揭示 [tablet]/[elder_thing]/[elder_sign] 时改为使用以下效果'
    + '（-1 并让黑猫受到 1 点直接伤害/恐惧；+5 并治愈黑猫全部伤害与恐惧）」——引擎没有把符号效果'
    + '替换为卡面自定义值的读点（setSymbolEffect 只服务 05033 的取消/再结算候选）。'
    + '已实现的数据通道：[[盟友]]槽位、2 个万能图标、特性均来自 cards-data。',
  abilities: [],
  modifiers: [],
}
