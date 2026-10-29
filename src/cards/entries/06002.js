// 06002 曼蒂·汤普森
// 卡面：[reaction] 在你所在地点的一位调查员将要查找自己的牌库或遭遇牌库，找出卡牌并结算某一效果时：
//       该调查员可以额外查找 3 张卡牌，或者该次查找多结算 1 个目标。(每轮仅限一次。)
// 卡面：[elder_sign] 效果：+0。查找你牌库顶的 3 张卡牌，找出其中一张，抽取该卡牌或者将其投入本次检定
//       (如可能)。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 主能力挂在 P6 原语 `searchWouldResolve` 窗口上（src/engine/deck-ops.js——所有「查找牌库」
//     的唯一实现）；额外张数写 context.extraCards，多结算目标写 context.extraTargets。
//   · 旧印走 api.lookAt（看牌 → 拿走 1 张）+ api.commitCards（改为投入本次检定）+ api.shuffleDeck。

export default {
  code: '06002',
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 0, searchTop: 3 },
  },
  elderSign: {
    id: '06002-eldersign',
    label: '旧印：+0，查找牌库顶 3 张，抽走或投入本次检定',
    resolve: ({ inv, api, state }) => {
      const taken = api.lookAt(inv.seat, {
        zone: 'deck', count: 3, choose: 1, source: 'mandyElderSign',
        prompt: '旧印：查找牌库顶 3 张，选择其中 1 张。',
      })
      const code = taken[0]
      if (code && state.skillTest) {
        const answer = api.choice({
          kind: 'effect', source: 'mandyElderSign', seat: inv.seat, canSkip: true,
          prompt: `旧印：「${api.cardName(code)}」要抽取，还是投入本次检定？`,
          options: [{ id: 'draw', label: '抽取这张卡牌' }, { id: 'commit', label: '投入本次检定' }],
        })
        if (answer === 'commit') api.commitCards(inv.seat, [code])
      }
      api.shuffleDeck(inv.seat)
      return { delta: 0 }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'searchWouldResolve',
      id: 'mandySearchBonus',
      label: '额外查找 3 张，或多结算 1 个目标',
      limit: { scope: 'perRound', owner: 'instance' },
      criteria: [({ inv, context, state }) => {
        const searcher = state?.investigators?.[context?.seat]
        return Boolean(searcher) && searcher.location === inv.location && context?.zone != null
      }],
      resolve: ({ inv, context, api, state }) => {
        const searcher = state.investigators[context.seat]
        const answer = api.choice({
          kind: 'effect', source: 'mandySearchBonus', seat: inv.seat,
          prompt: `${searcher.name} 正在查找${context.zone === 'encounterDeck' ? '遭遇牌库' : '牌库'}：额外查找 3 张，或多结算 1 个目标？`,
          options: [
            { id: 'cards', label: '额外查找 3 张卡牌' },
            { id: 'targets', label: '本次查找多结算 1 个目标' },
          ],
        })
        if (answer === 'cards') {
          context.extraCards = (Number(context.extraCards) || 0) + 3
          api.info(`${inv.name} 让这次查找额外多看 3 张卡牌。`)
        } else {
          context.extraTargets = (Number(context.extraTargets) || 0) + 1
          api.info(`${inv.name} 让这次查找多结算 1 个目标。`)
        }
      },
    },
  ],
  modifiers: [],
}
