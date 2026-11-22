// 60301 温妮弗雷德·哈巴默克
// 卡面：[fast]如果本次技能检定中投入了2张你控制的不同非弱点卡牌：抽取1张卡牌。(每次检定限一次。)
// 卡面：[elder_sign]效果：+1。本次检定结束后，你每成功超过难度2点，便将你投入本次检定的一张卡牌返回手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

function chooseCommittedCards(state, inv, api, result) {
  if (!result?.success) return
  const committed = state.skillTest.committed.filter(item => item.seat === inv.seat)
  const count = Math.min(committed.length, Math.floor((result.successBy ?? result.value - result.difficulty) / 2))
  for (let number = 0; number < count; number++) {
    const pick = committed.length === 1 ? 0 : Number(api.choice({
      kind: 'card', source: '60301', seat: inv.seat,
      prompt: '选择要返回手牌的一张已投入卡牌。',
      options: committed.map((item, index) => ({
        id: String(index), cardCode: item.code, label: api.cardName(item.code),
      })),
    }))
    const [selected] = committed.splice(pick, 1)
    if (selected) api.setCommitDestination(selected, 'hand')
  }
}

export default {
  code: '60301',
  kind: 'investigator',
  flags: { testWindowObserver: true },
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    label: '旧印：成功每超过 2 点，收回一张已投入卡牌',
    resolve: ({ state, inv, api }) => {
      api.afterCurrentTest(result => chooseCommittedCards(state, inv, api, result))
      return { delta: 1 }
    },
  },
  abilities: [{
    kind: 'free',
    trigger: 'test.afterCommit',
    label: '本次已投入两张不同名的非弱点卡：抽 1 张牌',
    limit: { scope: 'perTest', owner: 'player' },
    criteria: ({ state, inv, helpers }) => helpers.canDrawCards()
      && new Set((state.skillTest?.committed || [])
        .filter(item => item.seat === inv.seat && !helpers.isWeakness(item.code))
        .map(item => helpers.cardName(item.code))).size >= 2,
    resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
  }],
}
