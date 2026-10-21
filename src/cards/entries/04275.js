// 04275 半球地图
// 卡面：你当前所在地点与至少2个其他地点相互连接时，你得到+1[willpower]和+1[intellect]。
// 卡面：你当前所在地点与至少4个其他地点相互连接时，你得到额外+1[willpower]和+1[intellect]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04275',
  passive: {"statsByConnections":{"count":2,"stats":{"willpower":1,"intellect":1}},"extraConnections":{"count":4,"stats":{"willpower":1,"intellect":1}}},
  abilities: [

  ],
  modifiers: [

  ],
}
