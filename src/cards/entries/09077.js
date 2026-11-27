// 09077 地下市场（Underworld Market）· 游荡者支援 · 2 经验 · 永久 / 卓越。
// 卡面：永久。卓越。你得到牌库卡牌张数 +10。
//       [reaction] 你在抽取起始手牌前，选择自己牌库里的 10 张[[违法]]卡牌：将其混洗，放在地下市场旁，
//       作为你的市场牌库。
//       [reaction] 当你回合开始时：揭示你市场牌库顶的 2 张卡牌。你可以花费 1 资源以抽取其中 1 张。
//       将其余卡牌以任意顺序放回市场牌库底。
//
const CODE = '09077'
const marketKey = source => `marketDeck:${source.id}`
const cardOptions = (cards, api) => cards.map((code, index) => ({
  id: String(index), cardCode: code, label: api.cardName(code),
}))

function shuffled(cards, api) {
  const result = [...cards]
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(api.random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

function setupMarket({ inv, source, api }) {
  const candidates = inv.deck.filter(code => api.cardTraits(code).some(trait => trait.toLowerCase() === 'illicit'))
  if (candidates.length < 10) return
  const answer = api.choice({
    kind: 'reaction', source: CODE, seat: inv.seat, canSkip: true,
    prompt: '抽起始手牌前，是否从牌库选 10 张[[违法]]卡牌组成市场牌库？',
    options: [{ id: 'skip', label: '不建立市场牌库' }, { id: 'build', label: '建立市场牌库' }],
  })
  if (answer !== 'build') return
  const chosen = []
  while (chosen.length < 10) {
    const picked = candidates.length === 10 - chosen.length ? 0 : Number(api.choice({
      kind: 'card', source: CODE, seat: inv.seat,
      prompt: `选择市场牌库中的第 ${chosen.length + 1} 张[[违法]]卡牌。`,
      options: cardOptions(candidates, api),
    }))
    const [code] = candidates.splice(picked, 1)
    const card = api.takeDeckCard(inv.seat, code)
    if (!card) return
    chosen.push(card)
  }
  api.setScenarioFlag(marketKey(source), shuffled(chosen, api))
  api.info('🕯️ 「地下市场」：已混洗 10 张[[违法]]卡牌并建立市场牌库。')
}

function visitMarket({ inv, source, api }) {
  const market = api.scenarioFlag(marketKey(source))
  if (!market?.length) return
  const shown = market.slice(0, 2)
  const rest = market.slice(2)
  if (api.availableResources(inv.seat) > 0) {
    const picked = api.choice({
      kind: 'card', source: CODE, seat: inv.seat, canSkip: true,
      prompt: '可以花费 1 资源抽取 1 张市场牌库揭示的卡牌。',
      options: [{ id: 'skip', label: '不抽取' }, ...cardOptions(shown, api)],
    })
    if (picked !== 'skip' && api.spendResources(inv.seat, 1) === 1) {
      const [code] = shown.splice(Number(picked), 1)
      api.putOnTopOfDeck(inv.seat, code)
      api.drawCardsLogged(inv.seat, 1)
    }
  }
  if (shown.length === 2 && shown[0] !== shown[1]) {
    const first = Number(api.choice({
      kind: 'card', source: CODE, seat: inv.seat,
      prompt: '选择在市场牌库底排在前面的卡牌。',
      options: cardOptions(shown, api),
    }))
    if (first === 1) shown.reverse()
  }
  api.setScenarioFlag(marketKey(source), [...rest, ...shown])
}

export default {
  code: CODE,
  deckConstruction: { sizeBonus: 10 },
  abilities: [
    { kind: 'setup', label: '抽取起始手牌前：选择 10 张[[违法]]卡牌组成市场牌库', resolve: setupMarket },
    {
      kind: 'reaction',
      trigger: 'turnBegins',
      limit: { scope: 'perTurn', owner: 'instance' },
      label: '揭示市场牌库顶 2 张，可花费 1 资源抽取 1 张',
      criteria: [({ state, inv, source, context }) => context.seat === inv.seat
        && state.scenarioFlags?.[marketKey(source)]?.length > 0],
      resolve: visitMarket,
    },
  ],
  modifiers: [],
}
