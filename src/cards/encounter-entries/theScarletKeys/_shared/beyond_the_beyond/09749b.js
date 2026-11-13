// 09749b 拟像旷野（Weald of Effigies）／残骸之城（City of Remnants）· 地点 · beyond_the_beyond
// 正面：强制 - 在你揭示拟像旷野后：查看你牌库顶的卡牌。如果不是弱点，将其放在一边作为空洞。
//   [fast] 如果拟像旷野没有线索：交换 2 张相邻地点的隐匿迷你卡位置，或交换阴影中 2 个地点的位置。
//   (团队每场游戏仅限一次。)
// 背面：隐匿 1。强制 - 揭露此地点：中间选择一张非弱点手牌作为空洞；右边将一个支援作为空洞。
// 读点与近似同 09749a；牌库顶用 api.takeDeckCard，手牌/支援空洞走 api.tsk.hollow.hollow + moveCard(setAside)。
import { isWeaknessCode } from '../../../_shared.js'

const CODE = '09749b'

function hollowHandCard(state, seat, api) {
  const inv = state.investigators?.[seat]
  const codes = (inv?.hand || []).filter(code => !isWeaknessCode(code))
  if (!codes.length) return false
  const picked = codes.length === 1 ? codes[0] : String(api.choice({
    kind: 'card', source: CODE, seat,
    prompt: '选择一张非弱点手牌，放在一边作为空洞。',
    options: [...new Set(codes)].map(code => ({ id: code, label: api.cardName?.(code) || code, cardCode: code })),
  }))
  if (!codes.includes(picked)) return false
  api.tsk.hollow.hollow({ code: picked, source: 'hand', scope: 'investigator', seat })
  api.moveCard({ code: picked, from: 'hand', to: 'setAside', ownerSeat: seat })
  api.info?.('「残骸之城（C）」：一张手牌成为空洞。')
  return true
}

function hollowAsset(state, seat, api) {
  const assets = state.investigators?.[seat]?.assets || []
  if (!assets.length) return false
  const picked = assets.length === 1 ? assets[0].id : String(api.choice({
    kind: 'asset', source: CODE, seat,
    prompt: '选择一个你控制的支援，放在一边作为空洞。',
    options: assets.map(card => ({ id: card.id, label: api.cardName?.(card.code) || card.code })),
  }))
  const card = assets.find(item => item.id === picked)
  if (!card) return false
  api.tsk.hollow.hollow({ code: card.code, source: 'asset', scope: 'investigator', seat })
  api.moveCard({ id: card.id, from: 'play', to: 'setAside', ownerSeat: seat })
  api.info?.('「残骸之城（C）」：支援「' + (api.cardName?.(card.code) || card.code) + '」成为空洞。')
  return true
}

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: { otherworld: true, shadowLocation: true, concealed: 1, wealdOfEffigies: true },
  abilities: [{
    kind: 'forced',
    trigger: 'locationRevealed',
    label: '揭示拟像旷野后：牌库顶非弱点卡放一边作为空洞',
    criteria: ({ source, context }) => Boolean(source) && String(context?.location) === String(source.id)
      && Number.isSafeInteger(context?.seat),
    resolve: ({ state, context, api }) => {
      const inv = state.investigators?.[context.seat]
      const deck = inv?.deck || []
      const top = deck[deck.length - 1]
      if (!top || isWeaknessCode(top)) return
      if (!api.tsk.hollow.isHollowed(top)) {
        api.tsk.hollow.hollow({ code: top, source: 'deck', scope: 'investigator', seat: context.seat })
      }
      api.takeDeckCard(context.seat, top)
      api.info?.('「拟像旷野」：牌库顶一张非弱点卡成为空洞。')
    },
  }, {
    kind: 'free',
    actionKind: 'activate',
    label: '[fast] 此地无线索时：交换 2 张隐匿迷你卡或 2 个阴影地点的位置（团队每场游戏一次）',
    criteria: ({ source }) => Boolean(source) && Number(source.clues || 0) === 0,
    resolve: ({ state, inv, api }) => {
      if (api.scenarioFlag?.('wealdSwapUsed') === true) return false
      const cards = state?.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []
      if (cards.length < 2) return false
      const picked = String(api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '选择要交换位置的两张隐匿迷你卡（或阴影中的两个地点）。',
        options: cards.map(card => ({ id: card.id, label: '隐匿迷你卡（' + card.locationId + '）' })),
      }))
      if (!cards.some(card => card.id === picked)) return false
      api.tsk.concealed.reshuffle()
      api.setScenarioFlag?.('wealdSwapUsed', true)
      api.info?.('「拟像旷野」：重排了场上隐匿迷你卡的位置。')
      return true
    },
  }, {
    kind: 'forced',
    trigger: 'tskExposed',
    label: '揭露此地点：中间空洞一张手牌，右边空洞一个支援',
    criteria: ({ source, context }) => Boolean(source) && context?.decoy !== true
      && String(context?.code ?? context?.kind) === String(source.code),
    resolve: ({ state, context, api }) => {
      const seat = context?.seat
      if (!Number.isSafeInteger(seat)) return
      if (context.position === 'middle') hollowHandCard(state, seat, api)
      else if (context.position === 'right') hollowAsset(state, seat, api)
    },
  }],
  note: 'approximation: 交换位置用重排近似；空洞按卡号唯一；支援空洞用 moveCard(setAside) 离场。',
}
