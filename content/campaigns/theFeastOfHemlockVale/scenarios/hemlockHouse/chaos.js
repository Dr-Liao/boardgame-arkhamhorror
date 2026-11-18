// 汉洛克庄园（hemlockHouse · 提示卡 10523）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/HemlockHouse.hs#HasChaosTokenValue +
//       Helpers.hs#getFloorNumber + cards-data 10523 正/背面印刷文本
//       （frontend/src/locales/en/theFeastOfHemlockVale/hemlockHouse.json#tokens 同一份）。
//   [skull]：简单/普通 -X，X 为你当前所在楼层（最少 1）；困难/专家 X 为楼层两倍（最少 2）。
//   [cultist]：简单/普通 -1，若你所在地点是敌人则横置它（检定前即结算）；
//              困难/专家 -2，若你检定成功且你所在地点是敌人，横置它。
//   [tablet]：简单/普通 -3，失败时治愈最近的敌人-地点 1 点伤害；
//             困难/专家 -4，失败时治愈 1[per_investigator] 点。
//   [elder_thing]：简单/普通 -4，失败且当前为议程 2a/3a 时，检定结算后把本标记移出混乱袋、
//                  放进掠食袋；困难/专家 -5（不再要求失败）。
//
// 引擎契约：`behavior.resolveChaosToken` 返回 `{ delta, onDraw, onFail }`；`onDraw`/`onFail` 的
// `{type:'scenarioToken', token}` 由 skill-effects.js#applyTokenFx 回派到 `behavior.applyTokenEffect`。
// 楼层取「地点实例上的 floor 字段」（behavior 在网格放置/滑动时写入），缺失时回退网格坐标，
// 再缺失按 0 层（地窖）处理；地窖固定 0 层（Helpers.hs「1 层为 Y=0，地窖 Y<0 为 0 层」）。

const FLOOR_MIN = Object.freeze({ easy: 1, standard: 1, hard: 2, expert: 2 })

export const HEMLOCK_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({
      text: '-X. X is your current floor number (to a minimum of 1).',
      textZh: '-X。X 为你当前所在的楼层数（至少为 1）。',
      delta: null, dynamic: 'floor', rider: null,
    }),
    cultist: Object.freeze({
      text: '-1. If your location is an enemy, exhaust it.',
      textZh: '-1。若你所在地点是敌人，横置它。',
      delta: -1, rider: 'cultistAlways',
    }),
    tablet: Object.freeze({
      text: '-3. If you fail, heal 1 damage from the nearest enemy-location.',
      textZh: '-3。若你检定失败，治愈最近的敌人-地点 1 点伤害。',
      delta: -3, rider: 'tabletFail',
    }),
    elderthing: Object.freeze({
      text: '-4. If you fail, and it is agenda 2a or 3a, after this test resolves, remove this token '
        + 'from the chaos bag and add it to the predation bag.',
      textZh: '-4。若你检定失败，且当前为议程 2a 或 3a，则本次检定结算后把本标记移出混乱袋，'
        + '并放入掠食袋。',
      delta: -4, rider: 'elderthingFail',
    }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({
      text: '-X. X is your current floor number (to a minimum of 1).',
      textZh: '-X。X 为你当前所在的楼层数（至少为 1）。',
      delta: null, dynamic: 'floor', rider: null,
    }),
    cultist: Object.freeze({
      text: '-1. If your location is an enemy, exhaust it.',
      textZh: '-1。若你所在地点是敌人，横置它。',
      delta: -1, rider: 'cultistAlways',
    }),
    tablet: Object.freeze({
      text: '-3. If you fail, heal 1 damage from the nearest enemy-location.',
      textZh: '-3。若你检定失败，治愈最近的敌人-地点 1 点伤害。',
      delta: -3, rider: 'tabletFail',
    }),
    elderthing: Object.freeze({
      text: '-4. If you fail, and it is agenda 2a or 3a, after this test resolves, remove this token '
        + 'from the chaos bag and add it to the predation bag.',
      textZh: '-4。若你检定失败，且当前为议程 2a 或 3a，则本次检定结算后把本标记移出混乱袋，'
        + '并放入掠食袋。',
      delta: -4, rider: 'elderthingFail',
    }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({
      text: '-X. X is twice your current floor number (to a minimum of 2).',
      textZh: '-X。X 为你当前楼层数的两倍（至少为 2）。',
      delta: null, dynamic: 'floorTwice', rider: null,
    }),
    cultist: Object.freeze({
      text: '-2. If you succeed and your location is an enemy, exhaust it.',
      textZh: '-2。若你检定成功且你所在地点是敌人，横置它。',
      delta: -2, rider: 'cultistSuccess',
    }),
    tablet: Object.freeze({
      text: '-4. If you fail, heal 1 [per_investigator] damage from the nearest enemy-location.',
      textZh: '-4。若你检定失败，治愈最近的敌人-地点 1[per_investigator] 点伤害。',
      delta: -4, rider: 'tabletFailPerPlayer',
    }),
    elderthing: Object.freeze({
      text: '-5. If it is agenda 2a or 3a, after this test resolves, remove this token from the chaos '
        + 'bag and add it to the predation bag.',
      textZh: '-5。若当前为议程 2a 或 3a，则本次检定结算后把本标记移出混乱袋，并放入掠食袋。',
      delta: -5, rider: 'elderthingAlways',
    }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({
      text: '-X. X is twice your current floor number (to a minimum of 2).',
      textZh: '-X。X 为你当前楼层数的两倍（至少为 2）。',
      delta: null, dynamic: 'floorTwice', rider: null,
    }),
    cultist: Object.freeze({
      text: '-2. If you succeed and your location is an enemy, exhaust it.',
      textZh: '-2。若你检定成功且你所在地点是敌人，横置它。',
      delta: -2, rider: 'cultistSuccess',
    }),
    tablet: Object.freeze({
      text: '-4. If you fail, heal 1 [per_investigator] damage from the nearest enemy-location.',
      textZh: '-4。若你检定失败，治愈最近的敌人-地点 1[per_investigator] 点伤害。',
      delta: -4, rider: 'tabletFailPerPlayer',
    }),
    elderthing: Object.freeze({
      text: '-5. If it is agenda 2a or 3a, after this test resolves, remove this token from the chaos '
        + 'bag and add it to the predation bag.',
      textZh: '-5。若当前为议程 2a 或 3a，则本次检定结算后把本标记移出混乱袋，并放入掠食袋。',
      delta: -5, rider: 'elderthingAlways',
    }),
  }),
})

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1

/** 地点/敌人-地点所在楼层：`location.floor` 优先（behavior 写入），否则读网格坐标，地窖 0 层。 */
export function floorOf(state, locationId) {
  if (!locationId) return 0
  const location = (state?.locations || []).find(item => item.id === locationId)
  const cached = Number(location?.floor)
  if (Number.isFinite(cached) && cached >= 0) return cached
  const cell = state?.scenarioFlags?.mechanics?.grid?.[locationId]
  if (cell && Number.isFinite(cell.y)) return cell.y >= 0 ? cell.y + 1 : 0
  const declared = Number(state?.scenario?.floorOf?.[locationId])
  return Number.isFinite(declared) && declared >= 0 ? declared : 0
}

/** 调查员当前楼层（[skull] 用）。 */
export const currentFloor = (state, inv) => floorOf(state, inv?.location)

/** [skull] 的 X：简单/普通按楼层（最少 1），困难/专家按两倍（最少 2）。 */
export function skullValue(state, inv) {
  const hard = isHardSide(state)
  const floor = currentFloor(state, inv)
  return hard ? Math.max(2, floor * 2) : Math.max(1, floor)
}

/** [tablet] 失败时的治愈量：困难/专家 1[per_investigator]，否则 1 点。 */
export const tabletHealAmount = state => (isHardSide(state) ? investigatorCount(state) : 1)

/**
 * 逐标记取值：返回引擎 `resolveChaosToken` 契约的 `{ delta, onDraw, onFail }`；
 * 未登记的标记交回引擎默认表（null）。
 */
export function hemlockHouseChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  const meanings = HEMLOCK_TOKEN_MEANINGS[hard ? 'hard' : 'easy']
  switch (token) {
    case 'skull': {
      const meaning = meanings.skull
      return { delta: -skullValue(state, inv), dynamic: meaning.dynamic, onDraw: [], onFail: [] }
    }
    case 'cultist':
      return hard
        ? { delta: -2, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'success' }], onFail: [] }
        : { delta: -1, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'always' }], onFail: [] }
    case 'tablet':
      return hard
        ? { delta: -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'fail' }] }
        : { delta: -3, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'fail' }] }
    case 'elderthing':
      return hard
        ? { delta: -5, onDraw: [{ type: 'scenarioToken', token: 'elderthing', mode: 'always' }], onFail: [] }
        : { delta: -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'fail' }] }
    default:
      return null
  }
}

/** 兼容读点：返回签名修正值（负数）。 */
export function hemlockHouseChaosTokenValue(state, tokenFace, inv) {
  return hemlockHouseChaosToken(state, inv, tokenFace)?.delta ?? null
}

export const HEMLOCK_FLOOR_MINIMUM = FLOOR_MIN
