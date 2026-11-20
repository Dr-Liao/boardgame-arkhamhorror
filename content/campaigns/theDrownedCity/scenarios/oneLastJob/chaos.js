// 金盆洗手（oneLastJob · 11501）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheDrownedCity/OneLastJob.hs#HasChaosTokenValue +
//       frontend/src/locales/en/theDrownedCity/oneLastJob.json#tokens +
//       本地卡表 ALL_CARDS['11501'].text/backText（简单/普通 = 正面，困难/专家 = 背面）。
//
// 四档（提示卡 11501 正面 = 简单/普通，背面 = 困难/专家）：
//   [skull]       简单/普通：-X，X = 场上[[罪犯]]敌人数量（最多 4）；
//                 困难/专家：-X，X = 场上[[罪犯]]敌人数量 + 1。
//   [tablet]      简单/普通：-2；若你所在地点有[[罪犯]]敌人则 -4；
//                 困难/专家：-3；若你所在地点有[[罪犯]]敌人则 -5。
//   [elder_thing] 简单/普通：-3；失败时弃遭遇牌库顶 3 张，选择其中 1 名[[罪犯]]敌人与抽取者交战生成；
//                 困难/专家：-4；失败时弃顶 6 张，选择 1 名[[罪犯]]敌人生成并与你交战，且立刻攻击。
//   [cultist]     本战役混乱袋没有该标记（Campaigns/TheDrownedCity/ChaosBag.hs），提示卡未列出。
//
// 引擎契约：`behavior.resolveChaosToken` 返回 `{ delta, onDraw, onFail }`；onFail 的
// `{type:'scenarioToken'}` 由 skill-effects.js 回派到 `behavior.applyTokenEffect`。
export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])
export const CRIMINAL_TRAIT = 'Criminal'

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
export const codeOf = value => String(value?.originalCode || value?.code || '')
export const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase().replace(/\s+/g, '') === String(trait).toLowerCase().replace(/\s+/g, ''))

/** 场上（未击败）的[[罪犯]]敌人。 */
export function criminalsInPlay(state) {
  return (state?.enemies || []).filter(enemy => !enemy.defeated && hasTrait(enemy, CRIMINAL_TRAIT))
}

/** [skull] 的 X：简单/普通最多 4，困难/专家为数量 +1。 */
export function skullValue(state) {
  const count = criminalsInPlay(state).length
  return isHardSide(state) ? count + 1 : Math.min(4, count)
}

const negate = value => (value === 0 ? 0 : -value)

/** 调查员所在地点是否有[[罪犯]]敌人。 */
export function criminalAtInvestigator(state, inv) {
  const locationId = inv?.location
  if (!locationId) return null
  return criminalsInPlay(state).find(enemy => enemy.location === locationId) || null
}

export const ONE_LAST_JOB_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为场上[[罪犯]]敌人的数量（最多 4）。', delta: 0 }),
    cultist: Object.freeze({ text: '本剧本混乱袋没有 [cultist] 标记。', delta: null }),
    tablet: Object.freeze({ text: '-2（如果你所在地点有[[罪犯]]敌人，改为 -4）。', delta: -2, conditionalDelta: -4 }),
    elderthing: Object.freeze({ text: '-3。如果你失败，弃掉遭遇牌库顶的 3 张卡牌。选择以此效果弃掉的 1 名[[罪犯]]敌人，将其生成并与你交战。', delta: -3, discard: 3 }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为场上[[罪犯]]敌人的数量（最多 4）。', delta: 0 }),
    cultist: Object.freeze({ text: '本剧本混乱袋没有 [cultist] 标记。', delta: null }),
    tablet: Object.freeze({ text: '-2（如果你所在地点有[[罪犯]]敌人，改为 -4）。', delta: -2, conditionalDelta: -4 }),
    elderthing: Object.freeze({ text: '-3。如果你失败，弃掉遭遇牌库顶的 3 张卡牌。选择以此效果弃掉的 1 名[[罪犯]]敌人，将其生成并与你交战。', delta: -3, discard: 3 }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 比场上[[罪犯]]敌人的数量多 1。', delta: 0 }),
    cultist: Object.freeze({ text: '本剧本混乱袋没有 [cultist] 标记。', delta: null }),
    tablet: Object.freeze({ text: '-3（如果你所在地点有[[罪犯]]敌人，改为 -5）。', delta: -3, conditionalDelta: -5 }),
    elderthing: Object.freeze({ text: '-4。如果你失败，弃掉遭遇牌库顶的 6 张卡牌。选择以此效果弃掉的 1 名[[罪犯]]敌人，将其生成并与你交战。该敌人立刻攻击。', delta: -4, discard: 6 }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X 比场上[[罪犯]]敌人的数量多 1。', delta: 0 }),
    cultist: Object.freeze({ text: '本剧本混乱袋没有 [cultist] 标记。', delta: null }),
    tablet: Object.freeze({ text: '-3（如果你所在地点有[[罪犯]]敌人，改为 -5）。', delta: -3, conditionalDelta: -5 }),
    elderthing: Object.freeze({ text: '-4。如果你失败，弃掉遭遇牌库顶的 6 张卡牌。选择以此效果弃掉的 1 名[[罪犯]]敌人，将其生成并与你交战。该敌人立刻攻击。', delta: -4, discard: 6 }),
  }),
})

export const TOKEN_TIER = Object.freeze({ easy: 'easy', standard: 'standard', hard: 'hard', expert: 'expert' })
export const tierOf = state => (isHardSide(state) ? 'hard' : 'standard')

/** 单标记修正值；[cultist] 不在袋中返回 null（交回引擎默认表）。 */
export function oneLastJobTokenValue(state, inv, token) {
  const hard = isHardSide(state)
  switch (String(token)) {
    case 'skull':
      return negate(skullValue(state))
    case 'tablet':
      return criminalAtInvestigator(state, inv) ? (hard ? -5 : -4) : (hard ? -3 : -2)
    case 'elderthing':
      return hard ? -4 : -3
    case 'cultist':
      return null
    default:
      return null
  }
}

/** 引擎 resolveChaosToken 契约的 `{ delta, onDraw, onFail }`。 */
export function oneLastJobChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (String(token)) {
    case 'skull':
      return { delta: negate(skullValue(state)), onDraw: [], onFail: [] }
    case 'tablet':
      return { delta: criminalAtInvestigator(state, inv) ? (hard ? -5 : -4) : (hard ? -3 : -2), onDraw: [], onFail: [] }
    case 'elderthing':
      return {
        delta: hard ? -4 : -3,
        onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'discardSpawnCriminal', count: hard ? 6 : 3, immediateAttack: hard }],
      }
    case 'cultist':
      return null
    default:
      return null
  }
}

/** 兼容旧测试/展示读点：返回签名修正值（负数）。 */
export function oneLastJobTokenText(state, face) {
  return ONE_LAST_JOB_TOKEN_MEANINGS[tierOf(state)][face]?.text || ''
}

export function tokenMeanings() {
  return ONE_LAST_JOB_TOKEN_MEANINGS
}

export { investigatorCount }
