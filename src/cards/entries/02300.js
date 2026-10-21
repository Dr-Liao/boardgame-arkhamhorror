// 02300 屠怪勇士
// 卡面：攻击。如果本次攻击对一个非[[精英]]敌人检定成功，击败该敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02300',
  abilities: [
    {
      kind: 'played',
      label: '屠怪勇士',
      effect: { type: 'fight', defeatNonEliteOnSuccess: true },
    },
  ],
  modifiers: [

  ],
}
