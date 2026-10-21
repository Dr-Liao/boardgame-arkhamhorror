// 02018 团队合作
// 卡面：你所在地点的调查员彼此之间可以给出或交易任意数量的[[道具]]支援、[[盟友]]支援或资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02018',
  abilities: [
    { kind: 'played', label: '团队合作', effect: { type: 'teamwork' } },
  ],
  modifiers: [

  ],
}
