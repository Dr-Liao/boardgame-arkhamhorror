// 05109 赴汤蹈火
// 卡面：你所在地点的其他调查员受到的恐惧可以分配给赴汤蹈火。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：纯承伤数据卡（3 点神智来自卡面数据）。唯一的规则文本是「同地点其他调查员的恐惧可以分配给它」，
// 读点是 harm-threat.js 的 assignHarm：passive.assignHarmAtLocation 的支援会进入「同地点其他调查员」的
// 承伤候选（与 03021 勇气过人 / 02106 弟兄塞维尔同一读点）。条目不再需要 abilities。

export default {
  code: '05109',
  // 审计 R4：卡面只允许「其他调查员受到的恐惧」分配给它（伤害不接），passive 限定 'horror'。
  passive: { assignHarmAtLocation: 'horror' },
  abilities: [],
  modifiers: [],
}
