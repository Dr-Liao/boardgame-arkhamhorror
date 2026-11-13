// 09747c 凌乱道路（Rambling Route）／残骸之城（City of Remnants）· 地点 · beyond_the_beyond
// 正面：攻击或躲避在凌乱道路的每张隐匿迷你卡牌的难度 +2。
//   [action] 花费 X 资源：查看一张隐匿迷你卡牌的已揭示面。(团队每场游戏仅限一次。)
// 背面：隐匿 1。强制 - 在你揭露此地点时：若它在阴影中间，选择手中一张非弱点卡放在一边作为空洞；
//   若在右边，将一个你控制的支援放在一边作为空洞。
// 读点与近似同 09747a；空洞走 api.tsk.hollow.hollow + api.moveCard(to:'setAside')（scenario 的
//   moveCard 会走 leaveAsset，支援正常离场）。
// 正面「攻击/躲避本地点隐匿迷你卡难度 +2」= locationRule.concealedFightEvadeBonus: 2
//   （与 09577 同键名）；引擎还缺「攻击/躲避隐匿迷你卡」动作 + per-location 难度读点，暂不生效。
import { isWeaknessCode } from '../../../_shared.js'

const CODE = '09747c'

const miniCards = state => state?.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []

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
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '[action] 花费 X 资源：查看一张隐匿迷你卡牌的已揭示面（团队每场游戏一次）',
    resolve: ({ state, inv, api }) => {
      if (api.scenarioFlag?.('ramblingRouteLookUsed') === true) return false
      const cards = miniCards(state).filter(card => !card.flipped)
      if (!cards.length) return false
      const options = cards.map(card => ({ id: card.id, label: '隐匿迷你卡（' + card.locationId + '）' }))
      const picked = cards.length === 1 ? options[0].id : String(api.choice({
        kind: 'effect', source: CODE, seat: inv.seat, prompt: '选择要查看已揭示面的隐匿迷你卡牌。', options,
      }))
      const card = cards.find(item => item.id === picked)
      if (!card) return false
      const paths = api.mechanics.map.paths(inv.location, card.locationId)
      const distance = Array.isArray(paths) && paths.length ? Math.max(1, paths[0].length - 1) : 1
      if (Number(inv.resources) < distance) return false
      api.spendResources(inv.seat, distance)
      api.setScenarioFlag?.('tskLookedMiniCard:' + card.id, true)
      api.setScenarioFlag?.('ramblingRouteLookUsed', true)
      api.info?.('「凌乱道路」：花费 ' + distance + ' 资源查看了一张隐匿迷你卡牌的已揭示面。')
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
  note: 'approximation: 空洞按卡号唯一（同名第二张只放一边不重复登记）；支援空洞用 moveCard(setAside) 离场；'
    + '与 09747a 相同的 X/私人查看近似。正面「每张隐匿迷你卡攻防难度 +2」声明为 '
    + 'locationRule.concealedFightEvadeBonus:2（与 09577 同键名），但引擎还没有「攻击/躲避隐匿迷你卡」'
    + '动作与 per-location 难度读点，暂不生效。',
}
