// 西墙（theWesternWall · 11517）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheDrownedCity/TheWesternWall.hs#HasChaosTokenValue +
//       ResolveChaosToken / FailedSkillTestWithToken 段 +
//       frontend/src/locales/en/theDrownedCity/theWesternWall.json#tokens +
//       本地卡表 ALL_CARDS['11517'].text/backText。
//
// 四档（提示卡 11517 正面 = 简单/普通，背面 = 困难/专家）：
//   [skull]       简单/普通：-X，X = 你所在地点的层级；
//                 困难/专家：-X，X = 层级 + 2。
//   [cultist]     简单/普通：-3；如果你失败且你所在地点完全淹没，受到 1 点伤害；
//                 困难/专家：-5；如果你所在地点完全淹没，受到 1 点伤害（抽到时立即）。
//   [tablet]      简单/普通：-3；如果你失败，提高你所在地点的淹没等级；
//                 困难/专家：-5；尽可能提高你所在地点的淹没等级（抽到时立即）。
//   [elder_thing] 简单/普通：-3（完全淹没 -5）；
//                 困难/专家：-5；如果你所在地点完全淹没，改为自动失败。
export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])
export const FLOOD_LEVELS = Object.freeze({ unflooded: 0, partial: 1, full: 2 })

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
export const codeOf = value => String(value?.originalCode || value?.code || '')
export const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase().replace(/\s+/g, '') === String(trait).toLowerCase().replace(/\s+/g, ''))

const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null

/** 地点层级：优先读 location.level，缺省按网格行号 abs(row)+1。 */
export function locationLevel(state, invOrLocation) {
  const location = invOrLocation && typeof invOrLocation === 'object' && (invOrLocation.level != null || invOrLocation.id)
    ? invOrLocation
    : locationOf(state, invOrLocation?.location ?? invOrLocation)
  if (!location) return 0
  if (Number.isSafeInteger(location.level)) return location.level
  const grid = state?.mechanics?.grid?.[location.id] || state?.grid?.[location.id]
  if (grid && Number.isFinite(grid.y)) return Math.abs(grid.y) + 1
  const data = state?.mechanicState?.grid?.[location.id]
  if (data && Number.isFinite(data.y)) return Math.abs(data.y) + 1
  return 1
}

/** 淹没等级读取（0/1/2）：优先引擎 P7 原语 mechanicState.flood，其次 location.floodLevel。 */
export function floodLevelOf(state, locationId) {
  const stores = [state?.mechanicState, state?.mechanics, state?.scenarioFlags?.mechanics]
  for (const store of stores) {
    if (store?.flood && Number.isSafeInteger(store.flood[locationId])) return store.flood[locationId]
  }
  const location = locationOf(state, locationId)
  return Number(location?.floodLevel) || 0
}

export const isFullyFlooded = (state, locationId) => floodLevelOf(state, locationId) >= 2
export const isFlooded = (state, locationId) => floodLevelOf(state, locationId) >= 1

export const THE_WESTERN_WALL_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为你所在地点的层级。', delta: 0 }),
    cultist: Object.freeze({ text: '-3。如果你失败且你所在地点完全淹没，受到 1 点伤害。', delta: -3, onFail: 'floodedDamage' }),
    tablet: Object.freeze({ text: '-3。如果你失败，提高你所在地点的淹没等级。', delta: -3, onFail: 'increaseFloodLevel' }),
    elderthing: Object.freeze({ text: '-3（如果你所在地点完全淹没，改为 -5）。', delta: -3, fullyFloodedDelta: -5 }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为你所在地点的层级。', delta: 0 }),
    cultist: Object.freeze({ text: '-3。如果你失败且你所在地点完全淹没，受到 1 点伤害。', delta: -3, onFail: 'floodedDamage' }),
    tablet: Object.freeze({ text: '-3。如果你失败，提高你所在地点的淹没等级。', delta: -3, onFail: 'increaseFloodLevel' }),
    elderthing: Object.freeze({ text: '-3（如果你所在地点完全淹没，改为 -5）。', delta: -3, fullyFloodedDelta: -5 }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 比你所在地点的层级多 2。', delta: 0 }),
    cultist: Object.freeze({ text: '-5。如果你所在地点完全淹没，受到 1 点伤害。', delta: -5, onDraw: 'floodedDamage' }),
    tablet: Object.freeze({ text: '-5。尽可能提高你所在地点的淹没等级。', delta: -5, onDraw: 'increaseFloodLevel' }),
    elderthing: Object.freeze({ text: '-5（如果你所在地点完全淹没，改为自动失败）。', delta: -5, autoFailWhenFullyFlooded: true }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X 比你所在地点的层级多 2。', delta: 0 }),
    cultist: Object.freeze({ text: '-5。如果你所在地点完全淹没，受到 1 点伤害。', delta: -5, onDraw: 'floodedDamage' }),
    tablet: Object.freeze({ text: '-5。尽可能提高你所在地点的淹没等级。', delta: -5, onDraw: 'increaseFloodLevel' }),
    elderthing: Object.freeze({ text: '-5（如果你所在地点完全淹没，改为自动失败）。', delta: -5, autoFailWhenFullyFlooded: true }),
  }),
})

export const tierOf = state => (isHardSide(state) ? 'hard' : 'standard')

/** 单标记修正值。 */
export function theWesternWallTokenValue(state, inv, token) {
  const hard = isHardSide(state)
  const level = locationLevel(state, inv)
  const fullyFlooded = isFullyFlooded(state, inv?.location)
  switch (String(token)) {
    case 'skull':
      return -(level + (hard ? 2 : 0))
    case 'cultist':
      return hard ? -5 : -3
    case 'tablet':
      return hard ? -5 : -3
    case 'elderthing':
      if (hard) return -5
      return fullyFlooded ? -5 : -3
    default:
      return null
  }
}

/** 引擎 resolveChaosToken 契约的 `{ delta, onDraw, onFail }`。 */
export function theWesternWallChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  const level = locationLevel(state, inv)
  const fullyFlooded = isFullyFlooded(state, inv?.location)
  const effect = mode => [{ type: 'scenarioToken', token: String(token), mode }]
  switch (String(token)) {
    case 'skull':
      return { delta: -(level + (hard ? 2 : 0)), onDraw: [], onFail: [] }
    case 'cultist':
      return hard
        ? { delta: -5, onDraw: effect('floodedDamage'), onFail: [] }
        : { delta: -3, onDraw: [], onFail: effect('floodedDamage') }
    case 'tablet':
      return hard
        ? { delta: -5, onDraw: effect('increaseFloodLevel'), onFail: [] }
        : { delta: -3, onDraw: [], onFail: effect('increaseFloodLevel') }
    case 'elderthing':
      return {
        delta: hard ? -5 : (fullyFlooded ? -5 : -3),
        onDraw: [],
        onFail: [],
        autoFail: hard && fullyFlooded,
      }
    default:
      return null
  }
}

/** 兼容旧测试/展示读点：返回签名修正值（负数）。 */
export function theWesternWallTokenValueFor(state, tokenFace) {
  return theWesternWallTokenValue(state, { location: null }, tokenFace)
}

export function theWesternWallTokenText(state, face) {
  return THE_WESTERN_WALL_TOKEN_MEANINGS[tierOf(state)][face]?.text || ''
}

export function tokenMeanings() {
  return THE_WESTERN_WALL_TOKEN_MEANINGS
}

/** 困难/专家 [elder_thing] + 完全淹没 = 自动失败。 */
export function testAutoFail(state, inv, context = {}) {
  if (!isHardSide(state)) return false
  const drawn = (context.drawn || context.tokens || []).map(String)
  if (!drawn.includes('elderthing')) return false
  return isFullyFlooded(state, inv?.location)
}

export { investigatorCount }
