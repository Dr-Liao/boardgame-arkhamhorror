// 05315 “我见过更糟的……”
// 卡面：快速。在你受到伤害和/或恐惧时打出。
// 卡面：取消你刚受到的伤害和/或恐惧中最多2点。然后，获得同等数量的资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05315 “我见过更糟的……”：harmDealt 窗口的快速事件；取消最多 2 点，并按取消数量获得资源。
// 取消/换算走通用原语 api.cancelHarm（同 02261 / 03157 的口径），gainResources 为卡面差异。

export default {
  code: '05315',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'harmDealt',
      criteria: { selfOnly: true },
      label: '取消最多 2 点伤害/恐惧并换成资源',
      resolve: ({ inv, api }) => {
        api.cancelHarm(inv.seat, {
          maximum: 2, gainResources: true, source: '05315',
          prompt: '选择「我见过更糟的……」要取消的伤害与恐惧（最多 2 点）。',
        })
      },
    },
  ],
  modifiers: [

  ],
}
