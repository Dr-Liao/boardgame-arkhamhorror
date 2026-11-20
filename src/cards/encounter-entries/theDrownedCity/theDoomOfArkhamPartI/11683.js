// 11683 将临的风暴 · 议程 1（阿卡姆的毁灭 第一部分）。
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartI（P7 终章上篇）。
// 卡面：强制 - 本密谋被放置毁灭标记时：提高调查员队长所在地点的淹没等级。
//       [action]：撤退。你放弃搜寻。（背面：每位尚未被消灭的调查员立刻撤退。）
// 读点：behavior.doomPlaced（放置毁灭 → 提高队长所在地点水位）；撤退由
//       scenario.resignAnywhere + definition 的议程条目声明，引擎 moves.js 统一放行。
export default {
  code: '11683',
  scope: 'agenda',
  implemented: true,
  flags: { resignAnywhere: true, floodOnDoom: 'lead' },
  note: '数据型条目：毁灭阈值 14 由 definition.stage() 读卡表；强制能力在 behavior.doomPlaced。',
  abilities: [],
}
