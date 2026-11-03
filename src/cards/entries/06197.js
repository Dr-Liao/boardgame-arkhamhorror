// 06197 熟能生巧
// 卡面：快速。在你所在地点的技能检定期间打出。查找你牌库顶的 9 张卡牌，找出一张[[精通]]技能
//       并将其投入本次技能检定（如可能）。将其余卡牌混洗回你的牌库。本次检定结束后，
//       如果检定成功，不将该技能弃掉，改为将该技能加入你的手牌中。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：快速事件 = played + fast + trigger（reactionWindow 的「快速事件统一通道」）。
// 「技能检定期间」用 testBegins 窗口（检定开始、投入之前，正是本卡要提前投入的时机）。
// 查找/投入走 api.moveCard（牌库→手牌）+ api.commitCards（进入本次检定的投入区）。
// 找到的技能投入时附上成功后回手元数据，检定收尾统一按结果处理去向。

export default {
  code: '06197',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'testBegins',
      label: '快速：查找牌库顶 9 张，找出[[精通]]技能投入本次检定',
      resolve: ({ state, inv, api }) => {
        if (!state.skillTest) return
        const top = (inv.deck || []).slice(-9)
        const matches = [...new Set(top.filter(code => api.cardType(code) === 'skill'
          && (api.cardTraits(code) || []).some(trait => String(trait).toLowerCase() === 'practiced')
          && api.canCommitCard(inv.seat, code)))]
        if (!matches.length) {
          api.shuffleDeck(inv.seat)
          api.info('牌库顶 9 张里没有可以投入本次检定的[[精通]]技能卡。')
          return
        }
        const answer = matches.length === 1 ? '0' : api.choice({
          kind: 'card', source: '06197', seat: inv.seat,
          prompt: '选择要投入本次检定的[[精通]]技能卡。',
          options: matches.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) })),
        })
        const code = matches[Number(answer)]
        if (!code) return
        api.moveCard({ code, from: 'deck', to: 'hand' })
        // 引擎在检定成算前把此处的追加投入统一并入局部检定值与结算队列。
        api.commitCards(inv.seat, [code], { source: '06197', onSuccessDestination: 'hand' })
        api.shuffleDeck(inv.seat)
        api.info(`${inv.name} 用「熟能生巧」找出「${api.cardName(code)}」并投入本次检定。`)
      },
    },
  ],
  modifiers: [],
}
