// 03228 身先士卒
// 卡面：如果本次技能检定成功，重整你所在地点的一个[[盟友]]支援并治愈其1点伤害或1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03228',
  abilities: [
    {
      kind: 'commit',
      label: '身先士卒',
      skill: { onSuccess: { readyAndHealAlly: true } },
    },
  ],
  modifiers: [

  ],
}
