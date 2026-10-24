// 05278 干一天活计拿一天钱
// 卡面：永久。
// 卡面：你每场游戏开始拥有额外2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05278 干一天活计拿一天钱：纯数据卡。开局循环在统计阶段把永久卡放进场时读
// registeredEntry(code).startingResources，本卡 +2（读点见 src/engine/setup.js 的永久卡段）。
// 与 02037「负债」(-2) 同一条读点，方向相反。

export default {
  code: '05278',
  startingResources: 2,
  abilities: [

  ],
  modifiers: [

  ],
}
