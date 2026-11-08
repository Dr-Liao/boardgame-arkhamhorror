// 七循环《地球边缘》（EotE）P4 浏览器验收的**测试专用**状态种子与 HARNESS 卡。
//
// 只被 tools/run-eote-interactions-browser.mjs 在验收进程内 import；不进生产组合根、不注册到
// content/、不新增 HTTP 夹具端点。HARNESS 卡的每个 action 调用一个 `api.interactions` 事务
// （P4-A 引擎交互层），让浏览器能走真实 HTTP/引擎路径点击真实选择面板。
//
// 状态种子只通过 P2 通用原语写入（initializePartners / initializeSeals / initializeDisciplines /
// initializeSupplies / initializeTekeliDeck / revealDeckTop / grantCrossSeat），因此
// `validateEoteState()` 能通过；卡号/名称只来自卡表数据，夹具不写死规则。
import { fixture, asset } from './core-fixture.mjs'
import { legalMoves, scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { validateEoteState } from '../src/engine/eote-primitives.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

export const HARNESS_CODE = 'testEoteInteractions'
export const HOST = 'eote-fixture-host'
export const LOCATION = 'hallway'
export const PARTNER_CODES = Object.freeze(['08714', '08715', '08716', '08717', '08718', '08719', '08720', '08721', '08722'])
export const DISCIPLINE_SETS = Object.freeze([
  Object.freeze({ unbrokenCode: '08011a', brokenCode: '08011b', burdenCode: '08015' }),
  Object.freeze({ unbrokenCode: '08012a', brokenCode: '08012b', burdenCode: '08015' }),
  Object.freeze({ unbrokenCode: '08013a', brokenCode: '08013b', burdenCode: '08015' }),
  Object.freeze({ unbrokenCode: '08014a', brokenCode: '08014b', burdenCode: '08015' }),
])
export const SUPPLY_CODES = Object.freeze(['08614', '08615', '08616', '08617', '08618', '08619', '08620'])
export const TEKELI_FACES = Object.freeze(['08723', '08724', '08725', '08726', '08727', '08728', '08729'])
// 跨座位代打：队友手中的 [[Item]] 道具（非「快速」，避免每次行动结束都弹玩家窗口）；
// 牌库顶：一张非快速支援，同理避免「快速打出牌库顶」窗口遮住交互验收。
export const CROSS_SEAT_CODE = '01020'
export const DECK_TOP_CODE = '01031'
// 寒霜检定用确定顺序说明：先两枚 frost，再按袋序揭示其余标准标记。
export const FROST_FORCED_DRAWS = Object.freeze(['frost', 'frost'])

const cardNameOf = code => ALL_CARDS[code]?.name || code
const cardNameZhOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
const PARTNER_ROSTER = Object.freeze(PARTNER_CODES.map(code =>
  Object.freeze({ code, label: cardNameZhOf(code), name: cardNameOf(code) })))
const SUPPLY_ITEMS = Object.freeze(SUPPLY_CODES.map(code => Object.freeze({ code, label: cardNameZhOf(code) })))
const DISCIPLINE_FACE_CODES = Object.freeze(DISCIPLINE_SETS.map(set => set.unbrokenCode))

// HARNESS 卡的可读卡面（牌桌按卡号/名称显示）。只用于 fixture 状态。
function seedHarnessCard(state) {
  const card = ALL_CARDS[HARNESS_CODE]
  if (!card) {
    state.cards[HARNESS_CODE] = {
      code: HARNESS_CODE, name: '地球边缘交互验收', nameZh: '地球边缘交互验收',
      type: 'asset', klass: 'neutral', slots: [], text: 'P4 交互验收夹具',
    }
  }
}
// EotE 卡号不在基础剧情的 state.cards 里时补一份显示名，避免摘要/选择把卡号当名字显示。
function seedCardNames(state, codes) {
  for (const code of codes) {
    if (state.cards[code]) continue
    const card = ALL_CARDS[code]
    if (!card) continue
    state.cards[code] = { code, name: card.name, nameZh: card.nameZh || card.name, type: card.type }
  }
}

if (!registeredEntry(HARNESS_CODE)) registerCardAbilities([{
  code: HARNESS_CODE,
  name: '地球边缘交互验收',
  uses: undefined,
  abilities: [
    { kind: 'action', label: '寒霜加入', cost: { action: true }, resolve: ({ inv, api }) => api.interactions.frost.add(inv.seat, 1) },
    { kind: 'action', label: '寒霜支付', cost: { action: true },
      resolve: ({ inv, source, api }) => api.interactions.frost.pay(inv.seat, 1, { optional: true, source: source.id }) },
    // 真实技能检定：状态种子把 debugNextTokens 固定为两枚 frost，引擎会连揭两枚并按自动失败结算。
    { kind: 'action', label: '寒霜连续揭示', cost: { action: true },
      resolve: ({ inv, source, api }) => api.test(inv.seat, 'willpower', 0, { source: { id: source.id, code: HARNESS_CODE, label: '寒霜连续揭示' } }) },
    { kind: 'action', label: '伙伴选派', cost: { action: true },
      resolve: ({ inv, source, api }) => api.interactions.partners.setup(inv.seat, { roster: PARTNER_ROSTER, count: 2, optional: true, source: source.id }) },
    { kind: 'action', label: '封印取回', cost: { action: true },
      resolve: ({ inv, source, api }) => api.interactions.seals.recover(inv.seat, { source: source.id }) },
    { kind: 'action', label: '封印激活', cost: { action: true },
      resolve: ({ inv, source, api }) => api.interactions.seals.activate(inv.seat, { source: source.id }) },
    { kind: 'action', label: '封印放置', cost: { action: true },
      resolve: ({ inv, source, api }) => api.interactions.seals.place(inv.seat, { source: source.id }) },
    // interactions.keys 是既有 TIC 钥匙选择函数，EotE 城市钥匙走 namespaced 的 interactions.eote。
    { kind: 'action', label: '城市钥匙取得', cost: { action: true },
      resolve: ({ inv, source, api }) => api.interactions.eote.keys.take(inv.seat, { source: source.id }) },
    { kind: 'action', label: '城市钥匙放置', cost: { action: true },
      resolve: ({ inv, source, api }) => api.interactions.eote.keys.place(inv.seat, { keyId: 'eote-fixture-key', source: source.id }) },
    { kind: 'action', label: '忒咳哩-哩洗入', cost: { action: true },
      resolve: ({ inv, source, api }) => api.interactions.tekeli.shuffle(inv.seat, { count: 1, destination: null, source: source.id }) },
    { kind: 'action', label: '牌库顶揭示', cost: { action: true }, resolve: ({ inv, api }) => api.interactions.deckTop.reveal(inv.seat, { public: true }) },
    { kind: 'action', label: '牌库顶打出', cost: { action: true }, resolve: ({ inv, api }) => api.interactions.deckTop.play(inv.seat, { discount: 1, cost: 0 }) },
    { kind: 'action', label: '跨座位授权', cost: { action: true },
      resolve: ({ inv, api }) => api.interactions.crossSeat.grant(inv.seat, { fromSeat: 1, codes: [CROSS_SEAT_CODE] }) },
    { kind: 'action', label: '跨座位选择', cost: { action: true },
      resolve: ({ inv, source, api }) => api.interactions.crossSeat.choose(inv.seat, { source: source.id }) },
    { kind: 'action', label: '物资指派', cost: { action: true },
      resolve: ({ inv, source, api }) => api.interactions.supply.assign(inv.seat, { source: source.id }) },
    { kind: 'action', label: '物资掉落', cost: { action: true },
      resolve: ({ inv, source, api }) => api.interactions.supply.drop(inv.seat, { source: source.id }) },
    { kind: 'action', label: '演武选择', cost: { action: true },
      resolve: ({ inv, api }) => api.interactions.discipline.select(inv.seat, { sets: DISCIPLINE_FACE_CODES, count: 2, random: () => 0.6 }) },
    { kind: 'action', label: '演武翻面', cost: { action: true }, resolve: ({ inv, api }) => api.interactions.discipline.flip(inv.seat, { code: '08011a' }) },
  ],
}])

export function eoteInteractionFixture() {
  // 2 个调查员：座位 0 是浏览器控制者，座位 1 提供「同地点队友」手牌与接收者。
  const s = fixture('01001', 2)
  s.humanSeats = [0, 1]
  s.currentSeat = 0
  s.turnSeat = 0
  s.investigators[1].location = s.investigators[0].location
  scenarioRuntime(s, []).place(LOCATION)
  for (const loc of s.locations) loc.revealed = true
  s.locations[0].clues = 0
  const from = s.investigators[0].location
  const destination = s.locations.find(loc => loc.id !== from)?.id || from

  // HARNESS 资产放在座位 0 的支援区（牌桌用 data-interaction="asset:<id>" 渲染）。
  const host = asset(s, HARNESS_CODE, { id: HOST, name: '地球边缘交互验收', slots: [] })
  seedHarnessCard(s)
  seedCardNames(s, [...PARTNER_CODES, ...SUPPLY_CODES, ...TEKELI_FACES, ...DISCIPLINE_SETS.flatMap(set =>
    [set.unbrokenCode, set.brokenCode, set.burdenCode]), CROSS_SEAT_CODE, DECK_TOP_CODE])
  if (host.name) s.cards[HARNESS_CODE].name = host.name
  s.storyAssets ||= []

  // 混乱袋：2 枚 frost 实体 + 常规符号；debugNextTokens 固定寒霜检定的揭示顺序（可复现）。
  s.chaosBag = ['0', 'frost', 'frost', 'skull', 'cultist', 'tablet', 'autofail', 'eldersign']
  s.debugNextTokens = [...FROST_FORCED_DRAWS]

  const api = createMechanicsApi(s)
  // 战役级：伙伴名册（9 位）、五枚封印、演武、7 项物资。
  api.eoteCampaign.partners.initialize({ partners: PARTNER_CODES.map(code => ({ code, damage: 0, horror: 0 })) })
  api.eoteCampaign.seals.initialize({ kinds: ['A', 'B', 'C', 'D', 'E'] })
  // A：取回并由座位 0 激活（放置交互的候选）；B：留在地点上的休眠封印（取回交互的候选）。
  api.eoteCampaign.seals.placeDormant('A', destination)
  api.eoteCampaign.seals.recover('A', { seat: 0 })
  api.eoteCampaign.seals.activate('A')
  api.eoteCampaign.seals.placeDormant('B', destination)
  api.eoteCampaign.supplies.initialize({ items: SUPPLY_ITEMS })
  for (const code of SUPPLY_CODES) api.eoteCampaign.supplies.assign(code, 0)
  api.disciplines.initialize({ sets: DISCIPLINE_SETS })
  // 场景级：忒咳哩-哩弱点牌库（7 面 × 印刷份数 = 16 张）、牌库顶揭示、跨座位授权。
  api.tekeli.initialize({ cards: TEKELI_FACES })
  s.investigators[0].deck.push(DECK_TOP_CODE)
  api.deckTop.reveal(0, { discount: 1 })
  s.investigators[0].hand = ['01088']
  s.investigators[1].hand = [CROSS_SEAT_CODE]
  api.crossSeat.grant(0, { fromSeat: 1, codes: [CROSS_SEAT_CODE] })

  s.legalMoves = legalMoves(s, 0)
  validateEoteState(s)
  return s
}
