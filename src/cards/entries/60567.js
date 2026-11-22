// 60567 尾随猎物（Stalk Prey）· 事件（1 费，战术）
// 卡面：查找遭遇牌库顶 9 张卡牌，找出一个敌人，将其抽取，并混洗遭遇牌库。
//       然后，抽取 1 张卡牌并发现你所在地点的 1 个线索。
//       如果该敌人不在你所在地点，你可以朝其所在地点移动一次。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「查找遭遇牌库找出一个敌人并抽取」= api.searchEncounterDeck({ type:'enemy', from:['deck'],
//     spawn:'engaged', seat, shuffleDeck:true })（scenario-runtime#searchEncounterCard 是「按印刷数据
//     搜索遭遇牌并生成」的唯一入口：从牌库移除 + 洗牌 + 以该调查员所在地点交战生成，三件事一处收口）；
//   · 「顶 9 张」由卡面自己收窄：先只读 state.encounterDeck 的顶部 9 张（数组末位是顶），其中没有敌人
//     就不调用搜索原语（原语没有「仅查顶 N 张」参数，不先收窄会错误地从牌库深处抽敌人）；没有抽到敌人时
//     仍需按卡面洗回遭遇牌库，走 api.scenario.shuffleEncounterDeck；
//   · 「抽 1 张牌 / 发现 1 个线索」= api.drawCards / api.discoverClue；
//   · 「若敌人不在你所在地点，可朝其移动一次」在当前统一生成入口下不可达：抽到的敌人按规则生成在你
//     所在地点并交战，因此没有单独实现（近似已写在 note）。
const CODE = '60567'
const SEARCH_COUNT = 9

// 遭遇牌库顶 9 张里「离顶最近」的敌人（数组末位是牌库顶）。
function topEnemyFromEncounterDeck(state, api) {
  const deck = state.encounterDeck || []
  const top = deck.slice(Math.max(0, deck.length - SEARCH_COUNT))
  for (let index = top.length - 1; index >= 0; index -= 1) {
    if (api.cardType(top[index]) === 'enemy') return top[index]
  }
  return null
}

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    label: '查找遭遇牌库顶 9 张中的敌人并抽取；抽 1 张牌并发现你所在地点的 1 个线索',
    resolve: ({ state, inv, api }) => {
      const found = topEnemyFromEncounterDeck(state, api)
      if (found) {
        const drawn = api.searchEncounterDeck({
          type: 'enemy', from: ['deck'], spawn: 'engaged', seat: inv.seat, shuffleDeck: true,
        })
        if (drawn) api.info(`尾随猎物：从遭遇牌库顶 9 张中找出并抽取「${api.cardName(drawn)}」。`)
      } else {
        // 顶 9 张没有敌人：卡面仍要求混洗遭遇牌库，但遭遇牌库没有变动。
        api.scenario.shuffleEncounterDeck()
        api.info('尾随猎物：遭遇牌库顶 9 张中没有敌人，混洗遭遇牌库。')
      }
      api.drawCards(inv.seat, 1)
      api.discoverClue(inv.seat, 1)
    },
  }],
  modifiers: [],
  note: '近似：遭遇牌库顶 9 张里有多名敌人时，引擎原语按「离顶最近的一名」抽取（印刷的查找允许多名中选一）；「若该敌人不在你所在地点，可朝其移动一次」在当前统一生成入口下不可达（抽到的敌人按规则生成在你所在地点并交战），未单独实现。',
}
