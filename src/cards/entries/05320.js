// 05320 超级加倍
// 卡面：卓越。
// 卡面：[reaction]在你打出一张事件后，横置超级加倍：再次打出该事件，如同其在你手牌中。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05320 超级加倍：挂在新接线的 eventPlayed 窗口上的 reaction；横置自身后
// 用 api.replayPlayedCode 重放刚打出事件的打出效果（同 03306 遗觉记忆的通道）。

export default {
  code: '05320',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'eventPlayed',
      cost: { exhaust: true },
      label: '横置：再次打出刚打出的事件',
      criteria: ctx => ctx.context?.seat === ctx.inv?.seat && ctx.context?.cardCode !== '05320',
      resolve: ({ inv, context, api }) => {
        const code = context?.cardCode || context?.cardId
        if (!code) return
        api.replayPlayedCode(inv.seat, code)
        api.info(`${inv.name} 用「超级加倍」再次打出了「${api.cardName(code)}」。`)
      },
    },
  ],
  modifiers: [

  ],
}
