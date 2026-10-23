// 05011 家族遗产
// 卡面：永久。普雷斯顿·费尔蒙特牌库专用。
// 卡面：[action]：将本卡牌上的所有资源移动到你的资源池。
// 卡面：强制 - 在你的回合开始时：在本卡牌上放置4资源(从供应堆拿取)。本卡牌上的资源可以被花费，
//       如同在你的资源池中。当你的回合结束时，弃掉本卡牌上的所有资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 「回合开始放 4」「回合结束弃掉」「获得的资源寄存到这里」都在
// src/engine/resource-bank.js（普雷斯顿的 investigator.resourceBank 声明指向这张卡）；
// 这里只有卡面自己的主动行动。

export default {
  code: '05011',
  abilities: [
    {
      kind: 'action',
      label: '把家族遗产上的所有资源移进资源池',
      cost: { action: true },
      resolve: ({ inv, api }) => {
        const moved = api.resourceBank.withdraw(inv)
        if (!moved) api.info('家族遗产上没有资源。')
      },
    },
  ],
  modifiers: [],
}
