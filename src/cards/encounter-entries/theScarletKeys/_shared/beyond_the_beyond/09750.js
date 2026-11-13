// 09750 疯狂峭壁（Cliffs of Insanity）／残骸之城（City of Remnants）· 地点 · beyond_the_beyond
// 正面：强制 - 在你揭示疯狂峭壁后：将其相邻的每张隐匿迷你卡牌尽可能平均地移动到
//   非疯狂峭壁地点相邻的空位中。
// 背面：隐匿 1。强制 - 揭露此地点：左边受到 1 点伤害；中间空洞一张非弱点手牌；右边受到 1 点恐惧。
// 读点：locationRevealed 窗口 + api.tsk.concealed（reshuffle）；tskExposed 结算背面；
//   空洞走 api.tsk.hollow.hollow + api.moveCard(to:'setAside')。
// 近似：「尽可能平均地移到相邻空位」没有重定位原语 → 用同一批迷你卡的重排近似（不增删）。
import { isWeaknessCode } from '../../../_shared.js'

const CODE = '09750'

const miniCards = state => state?.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []

function hollowHandCard(state, seat, api) {
  const codes = (state.investigators?.[seat]?.hand || []).filter(code => !isWeaknessCode(code))
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

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: { otherworld: true, shadowLocation: true, concealed: 1, cliffsOfInsanity: true },
  abilities: [{
    kind: 'forced',
    trigger: 'locationRevealed',
    label: '揭示疯狂峭壁后：把相邻的隐匿迷你卡尽可能平均地移到非同名地点相邻的空位',
    criteria: ({ source, context }) => Boolean(source) && String(context?.location) === String(source.id),
    resolve: ({ state, api }) => {
      const cards = miniCards(state).filter(card => !card.flipped)
      if (cards.length < 2) {
        api.info?.('「疯狂峭壁」：场上没有需要重新排列的隐匿迷你卡。')
        return
      }
      api.tsk.concealed.reshuffle()
      api.info?.('「疯狂峭壁」：重排了 ' + cards.length + ' 张隐匿迷你卡的位置（近似「平均移到相邻空位」）。')
    },
  }, {
    kind: 'forced',
    trigger: 'tskExposed',
    label: '揭露此地点：左边受到 1 点伤害，中间空洞一张手牌，右边受到 1 点恐惧',
    criteria: ({ source, context }) => Boolean(source) && context?.decoy !== true
      && String(context?.code ?? context?.kind) === String(source.code),
    resolve: ({ state, context, api }) => {
      const seat = context?.seat
      if (!Number.isSafeInteger(seat)) return
      if (context.position === 'left') {
        api.damage(seat, 1)
        api.info?.('「残骸之城（C）」：阴影左边揭露，受到 1 点伤害。')
      } else if (context.position === 'middle') {
        hollowHandCard(state, seat, api)
      } else if (context.position === 'right') {
        api.horror(seat, 1)
        api.info?.('「残骸之城（C）」：阴影右边揭露，受到 1 点恐惧。')
      }
    },
  }],
  note: 'approximation: 正面「平均移到相邻空位」用同一批迷你卡的重排近似；空洞按卡号唯一。',
}
