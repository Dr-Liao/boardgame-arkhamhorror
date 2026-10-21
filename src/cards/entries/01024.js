// 01024 炸药爆破
// 卡面：选择你所在地点或一个连接地点。对所选地点的每个敌人和每位调查员各造成3点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01024',
  abilities: [
    {
      kind: 'played',
      label: '炸药爆破',
      effect: {
        type: 'dealDamageAll',
        amount: 3,
        location: 'choice',
        investigators: true,
        fx: 'dynamite',
      },
    },
  ],
  modifiers: [

  ],
}
