// 09060 狐朋狗友（Friends in Low Places）· 游荡者（Rogue）事件 · 0 经验 · 定制。
//
// 卡面：定制。当你购买狐朋狗友时，选择并记录一个[[特性]]。
//       查看你牌库顶的 6 张卡牌。每查看一张具有所选[[特性]]的卡牌，你可以花费 1 资源，以将该卡牌
//       加入你的手牌。将剩下的卡牌洗入你的牌库。
// 定制栏（逐项实现在 resolve 里读 api.tsk.customizable.checked）：
//       1 格 Helpful / 2 格 Versatile / 2 格 Bolstering / 2 格 Clever / 2 格 Prompt / 3 格 Experienced / 3 格 Swift。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
import { customizationChoiceValues, customizationOptionFullyChecked } from '../../engine/tsk-customizable.js'

const CODE = '09060'
const TRAIT_RECORD = '09060:trait'
const SECOND_TRAIT_RECORD = '09060:trait2'

const OPTIONS = [
  { name: 'Helpful', checks: 1, text: 'When you play Friends in Low Places, you may choose another investigator at your location to resolve its effects.' },
  { name: 'Versatile', checks: 2, text: 'Choose another [[Trait]]: _____. When you play Friends in Low Places, you may choose one of the looked-at cards with both chosen [[Traits]] to add to your hand without spending 1 resource.' },
  { name: 'Bolstering', checks: 2, text: 'Each card added to your hand by Friends in Low Places gains a [wild] icon until the end of the phase.' },
  { name: 'Clever', checks: 2, text: 'Instead of shuffling the remaining cards into your deck, you may place each of them on the top of your deck, in any order.' },
  { name: 'Prompt', checks: 2, text: 'Friends in Low Places gains fast and "play during any [fast] window".' },
  { name: 'Experienced', checks: 3, text: 'Increase the number of cards looked at by 3.' },
  { name: 'Swift', checks: 3, text: 'You may play one of the cards added to your hand (paying its cost).' },
]

const checked = (state, seat, index) => customizationOptionFullyChecked(state, seat, CODE, index)
const cardOptions = (codes, api) => codes.map((code, index) => ({
  id: String(index), cardCode: code, label: api.cardName(code),
}))

function resolve({ state, inv, api }) {
  const unlocked = index => checked(state, inv.seat, index)
  const selected = customizationChoiceValues(state, inv.seat, CODE)
  const firstTrait = selected[0] ?? api.campaignRecord(TRAIT_RECORD)
  const secondTrait = unlocked(1) ? selected[1] ?? api.campaignRecord(SECOND_TRAIT_RECORD) : null
  if (!firstTrait) return

  let resolver = inv
  if (unlocked(0)) {
    const others = api.investigatorsAt(inv.location).filter(owner => owner.seat !== inv.seat)
    if (others.length) {
      const picked = api.choice({
        kind: 'investigator', source: CODE, seat: inv.seat, canSkip: true,
        prompt: '是否改由同地点的另一位调查员结算《狐朋狗友》？',
        options: [{ id: 'self', label: '由你结算' }, ...others.map(owner => ({ id: String(owner.seat), label: owner.name }))],
      })
      resolver = others.find(owner => String(owner.seat) === picked) || inv
    }
  }
  const seat = resolver.seat
  const total = unlocked(5) ? 9 : 6
  const lookedAt = api.topDeckCodes(seat, total).slice().reverse()
  const cards = lookedAt.map(code => api.takeDeckCard(seat, code)).filter(Boolean)
  const matching = code => {
    const traits = api.cardTraits(code).map(trait => trait.toLowerCase())
    const first = traits.includes(String(firstTrait).toLowerCase())
    const second = secondTrait && traits.includes(String(secondTrait).toLowerCase())
    return { matchesEither: first || second, matchesBoth: first && second }
  }
  const eligibleFree = cardOptions(cards, api).filter(option => matching(option.cardCode).matchesBoth)
  const free = eligibleFree.length ? api.choice({
    kind: 'card', source: CODE, seat, canSkip: true,
    prompt: '可以免费将其中一张同时具有两种所选特性的牌加入手牌。',
    options: [{ id: 'skip', label: '不免费加入' }, ...eligibleFree],
  }) : 'skip'

  const added = []
  const rest = []
  for (const [index, code] of cards.entries()) {
    const freeCard = String(index) === free
    const paid = !freeCard && matching(code).matchesEither && api.availableResources(seat) > 0
      && api.choice({
        kind: 'card', source: CODE, seat, canSkip: true,
        prompt: `是否花 1 资源，将「${api.cardName(code)}」加入手牌？`,
        options: [{ id: 'take', cardCode: code, label: '花 1 资源加入手牌' }, { id: 'skip', label: '不加入' }],
      }) === 'take' && api.spendResources(seat, 1) === 1
    if (!freeCard && !paid) {
      rest.push(code)
      continue
    }
    api.putInHand(seat, code, unlocked(2) ? { skillIcons: ['wild'] } : undefined)
    const handIndex = state.investigators[seat].hand.length - 1
    added.push({ code, handIndex })
  }

  if (rest.length) {
    const reorder = unlocked(3) && api.choice({
      kind: 'effect', source: CODE, seat, canSkip: true,
      prompt: '可按任意顺序把剩余卡放在牌库顶。',
      options: [{ id: 'shuffle', label: '洗回牌库' }, { id: 'order', label: '排列并放回牌库顶' }],
    }) === 'order'
    const ordered = []
    if (reorder) {
      while (rest.length > 1) {
        const id = Number(api.choice({
          kind: 'card', source: CODE, seat,
          prompt: '选择下一张放回牌库顶的卡牌（从顶到底）。',
          options: cardOptions(rest, api),
        }))
        ordered.push(rest.splice(id, 1)[0])
      }
    }
    ordered.push(...rest)
    for (const code of ordered.reverse()) api.putOnTopOfDeck(seat, code)
    if (!reorder) api.shuffleDeck(seat)
  }

  const playable = unlocked(6) ? added.filter(card => api.canPlayAsEffect(seat, card.code)) : []
  if (playable.length) {
    const picked = api.choice({
      kind: 'card', source: CODE, seat, canSkip: true,
      prompt: '可支付费用，打出一张刚加入手牌的卡。',
      options: [{ id: 'skip', label: '不打出' }, ...playable.map(({ code, handIndex }) => ({
        id: String(handIndex), cardCode: code, label: api.cardName(code),
      }))],
    })
    const card = playable.find(item => String(item.handIndex) === picked)
    if (card) api.playAsEffect(seat, card.code, { handIndex: card.handIndex })
  }
}

export default {
  code: CODE,
  customizationOptions: OPTIONS,
  customizationChoices: { kind: 'playerTrait', base: 1, options: { 1: 1 } },
  customizationEffects: {
    fast: checks => checks.filter(index => index === 4).length >= OPTIONS[4].checks,
  },
  abilities: [{
    kind: 'played',
    label: '查看牌库顶 6 张：为每张具有已选特性的卡花 1 资源，加入手牌；其余洗回',
    resolve,
  }],
  modifiers: [],
}
