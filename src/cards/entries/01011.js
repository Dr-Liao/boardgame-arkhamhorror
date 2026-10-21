// 01011 医院债务
// 卡面：显现 - 将医院债务放置入场，放到你的威胁区域。
// 卡面：[free]：将你资源池的1资源移动到医院债务。(每轮限制两次。)
// 卡面：强制 - 在游戏结束时，如果医院债务的资源少于6：你本场冒险少取得2点经验值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01011',
  abilities: [
    {
      kind: 'weakness',
      label: '医院债务',
      weakness: { type: 'threat', debt: true, resources: 0, xpPenalty: 2 },
    },
  ],
  modifiers: [

  ],
}
