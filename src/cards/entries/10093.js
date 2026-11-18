// 10093 洪荒赞歌（Antediluvian Hymn）· 潜修者 · 事件 · 2 资源 · 预兆/双重
// 卡面：
//   作为打出洪荒赞歌的额外费用，花费一个行动。
//   揭示遭遇牌库顶 5 张卡牌。每揭示 1 张卡牌，你可以在混乱袋中加入 1 个[curse]标记，以将该卡牌
//   放到遭遇牌库底。将其余卡牌以任意顺序放回遭遇牌库顶。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「双重」＝「作为额外费用，花费一个行动」：played 描述子 cost:{ action: 1 }，
//     唯一读点是 ability.js#playedActionCost（moves.js / actions.js 的预览=校验=扣费同源）。
//   · 遭遇牌库顶 5 张：api.scenario.encounterDeckCards()（只读）+ api.scenario.takeEncounterDeckCard(code)
//     （从顶取出；state.encounterDeck 的写入口）。
//   · 每张「加 1 诅咒换放底」：逐张询问 + api.chaosTokens.add('curse', 1, { exact: true })（标记池上限读点）
//     + api.scenario.putOnEncounterDeck([code], { bottom: true })。
//   · 其余放回牌库顶：api.scenario.putOnEncounterDeck(rest)（默认放顶，pop 读顶）。
//
// 近似披露（simplified）：「将其余卡牌以任意顺序放回遭遇牌库顶」按原顺序放回（不提供任意排序界面）；
// 见 artifacts/migration/fhv/primitive-requests/10093.json。
const CODE = '10093'
const REVEAL_COUNT = 5

export default {
  code: CODE,
  name: '洪荒赞歌',
  simplified: true,
  note: 'simplified: 「其余卡牌以任意顺序放回牌库顶」按原顺序放回（未提供任意排序选择）；'
    + '其余（额外行动费、逐张加诅咒换放底、牌库顶/底搬运）都走既有原语。',
  abilities: [
    {
      kind: 'played',
      cost: { action: 1 },
      label: '额外花 1 行动：揭示遭遇牌库顶 5 张，可逐张加 1 诅咒把它放到牌库底，其余放回牌库顶',
      resolve: ({ state, inv, api }) => {
        const deck = api.scenario.encounterDeckCards()
        const revealed = deck.slice(-REVEAL_COUNT).reverse() // 从牌库顶到底
        if (!revealed.length) {
          api.info('「洪荒赞歌」：遭遇牌库是空的。')
          return
        }
        const taken = []
        for (const code of revealed) if (api.scenario.takeEncounterDeckCard(code)) taken.push(code)
        api.info(`📜 「洪荒赞歌」：揭示遭遇牌库顶 ${taken.length} 张——${taken.map(code => api.cardName(code)).join('、')}。`)
        const toTop = []
        let cursed = 0
        for (const code of taken) {
          const answer = api.choice({
            kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
            prompt: `「洪荒赞歌」：「${api.cardName(code)}」——加入 1 个[curse]标记把它放到遭遇牌库底？`,
            options: [
              { id: 'curse', label: '加入 1 个诅咒，放到遭遇牌库底', cardCode: code },
              { id: 'top', label: '放回遭遇牌库顶', cardCode: code },
            ],
          })
          if (answer === 'curse' && api.chaosTokens.add('curse', 1, { exact: true }) === 1) {
            api.scenario.putOnEncounterDeck([code], { bottom: true })
            cursed += 1
            continue
          }
          toTop.push(code)
        }
        // 「任意顺序放回牌库顶」：这里按原顺序放回（toTop 是顶→底，push 顺序反过来才是同一顺序）。
        if (toTop.length) api.scenario.putOnEncounterDeck([...toTop].reverse())
        api.info(`📜 「洪荒赞歌」：加入 ${cursed} 个诅咒标记，${toTop.length} 张牌放回遭遇牌库顶。`)
      },
    },
  ],
  modifiers: [],
}
