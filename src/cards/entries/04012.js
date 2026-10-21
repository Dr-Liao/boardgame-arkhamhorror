// 04012 当场抓获
// 卡面：显现 - 重整你所在地点或一个连接地点的所有敌人。连接地点上的每个猎手敌人向你移动1个地点。如果没有敌人以此效果移动，将当场抓获洗回你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04012',
  abilities: [
    { kind: 'weakness', label: '当场抓获', weakness: { type: 'caughtRedHanded' } },
  ],
  modifiers: [

  ],
}
