// 09747c 凌乱道路（Rambling Route）／残骸之城（City of Remnants）· 地点 · beyond_the_beyond
// 正面查看能力由同一共享描述子处理；攻防难度由 concealedFightEvadeBonus 声明。
import { ramblingRouteLook } from './_shared.js'
import { isWeaknessCode } from '../../../_shared.js'

const CODE = '09747c'

function hollowHandCard(state, seat, api) {
  const inv = state.investigators?.[seat]
  const options = (inv?.hand || []).filter(code => !isWeaknessCode(code))
  if (!options.length) return false
  const picked = options.length === 1 ? options[0] : String(api.choice({
    kind: 'card', source: CODE, seat,
    prompt: '选择一张非弱点手牌，放在一边作为空洞。',
    options: [...new Set(options)].map(code => ({ id: code, label: api.cardName?.(code) || code, cardCode: code })),
  }))
  if (!options.includes(picked)) return false
  api.tsk.hollow.hollow({ code: picked, source: 'hand', scope: 'investigator', seat })
  api.moveCard({ code: picked, from: 'hand', to: 'setAside', ownerSeat: seat })
  api.info?.('「残骸之城（C）」：一张手牌成为空洞。')
  return true
}

function hollowAsset(state, seat, api) {
  const inv = state.investigators?.[seat]
  const assets = inv?.assets || []
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
  flags: { otherworld: true, shadowLocation: true, concealed: 1, ramblingRoute: true },
  locationRule: { concealedFightEvadeBonus: 2 },
  abilities: [ramblingRouteLook(CODE), {
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
}
