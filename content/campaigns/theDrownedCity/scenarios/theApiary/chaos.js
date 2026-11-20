// 养育场（theApiary · 11553）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheDrownedCity/TheApiary.hs#HasChaosTokenValue +
//       ResolveChaosToken / FailedSkillTest 段 + frontend/src/locales/en/theDrownedCity/
//       theApiary.json#tokens（提示卡背面印刷文本）。
//
// 四档（提示卡正面 = 简单/普通，背面 = 困难/专家）：
//   [skull]       简单/普通：-X，X = 场上敌人与支援上的毁灭标记总数的一半（向下取整，最多 4）；
//                 困难/专家：-X，X = 同样的毁灭标记总数（最多 8）。
//   [cultist]     简单/普通：-1；困难/专家：-3。如果你所在地点有[[异教徒]]敌人，再揭示一个标记。
//   [tablet]      简单/普通：-3，失败时在你所在地点一个无毁灭标记的敌人上放 1 毁灭；
//                 困难/专家：-5，失败时在你所在地点一个敌人上放 1 毁灭（尽可能选无毁灭的）。
//   [elder_thing] 简单/普通：-4；困难/专家：-6。失败时受到 1 点伤害或 1 点恐惧。
//
// 引擎契约：`behavior.resolveChaosToken` 返回 `{ delta, onDraw, onFail }`；
// `onDraw`/`onFail` 的 `{ type: 'scenarioToken', token }` 由 skill-effects.js 回派到
// `behavior.applyTokenEffect`（与《寂静荒野》同一口径）。
export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))

const codeOf = value => String(value?.originalCode || value?.code || '')
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())

/** 场上敌人与支援（含剧情资产、调查员资产）上的毁灭标记总数。 */
export function doomInPlay(state) {
  let doom = 0
  for (const enemy of state?.enemies || []) doom += Number(enemy?.doom) || 0
  for (const asset of state?.storyAssets || []) doom += Number(asset?.doom) || 0
  for (const inv of state?.investigators || []) {
    for (const asset of inv?.assets || []) doom += Number(asset?.doom) || 0
    for (const card of inv?.threat || []) doom += Number(card?.doom) || 0
  }
  return doom
}

/** [skull] 的 X：简单/普通折半向下取整（最多 4）；困难/专家取全量（最多 8）。 */
export function skullValue(state) {
  const total = doomInPlay(state)
  return isHardSide(state) ? Math.min(8, total) : Math.min(4, Math.floor(total / 2))
}

/** 调查员所在地点是否有[[异教徒]]敌人（[cultist]「再揭示一个标记」读点）。 */
export function cultistEnemyAtLocation(state, inv) {
  return (state?.enemies || []).some(enemy => enemy.location === inv?.location
    && hasTrait(enemy, 'Cultist') && !enemy.defeated)
}

/** 调查员所在地点的敌人（[tablet] 读点）。 */
export function enemiesAtLocation(state, inv) {
  return (state?.enemies || []).filter(enemy => enemy.location === inv?.location && !enemy.defeated)
}

export const APIARY_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为场上敌人与支援上毁灭标记总数的一半（向下取整，最多 4）。', delta: 0, rider: 'doomHalf' }),
    cultist: Object.freeze({ text: '-1。如果你所在地点有[[异教徒]]敌人，再揭示一个标记。', delta: -1, rider: 'revealAnotherIfCultist' }),
    tablet: Object.freeze({ text: '-3。如果你检定失败，在你所在地点一个无毁灭标记的敌人上放 1 个毁灭标记。', delta: -3, rider: 'doomOnEnemyNoDoom' }),
    elderthing: Object.freeze({ text: '-4。如果你检定失败，受到 1 点伤害或 1 点恐惧。', delta: -4, rider: 'damageOrHorrorOnFail' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为场上敌人与支援上毁灭标记总数的一半（向下取整，最多 4）。', delta: 0, rider: 'doomHalf' }),
    cultist: Object.freeze({ text: '-1。如果你所在地点有[[异教徒]]敌人，再揭示一个标记。', delta: -1, rider: 'revealAnotherIfCultist' }),
    tablet: Object.freeze({ text: '-3。如果你检定失败，在你所在地点一个无毁灭标记的敌人上放 1 个毁灭标记。', delta: -3, rider: 'doomOnEnemyNoDoom' }),
    elderthing: Object.freeze({ text: '-4。如果你检定失败，受到 1 点伤害或 1 点恐惧。', delta: -4, rider: 'damageOrHorrorOnFail' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为场上敌人与支援上毁灭标记的总数（最多 8）。', delta: 0, rider: 'doomFull' }),
    cultist: Object.freeze({ text: '-3。如果你所在地点有[[异教徒]]敌人，再揭示一个标记。', delta: -3, rider: 'revealAnotherIfCultist' }),
    tablet: Object.freeze({ text: '-5。如果你检定失败，在你所在地点一个敌人上放 1 个毁灭标记（尽可能选无毁灭标记的）。', delta: -5, rider: 'doomOnEnemy' }),
    elderthing: Object.freeze({ text: '-6。如果你检定失败，受到 1 点伤害或 1 点恐惧。', delta: -6, rider: 'damageOrHorrorOnFail' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为场上敌人与支援上毁灭标记的总数（最多 8）。', delta: 0, rider: 'doomFull' }),
    cultist: Object.freeze({ text: '-3。如果你所在地点有[[异教徒]]敌人，再揭示一个标记。', delta: -3, rider: 'revealAnotherIfCultist' }),
    tablet: Object.freeze({ text: '-5。如果你检定失败，在你所在地点一个敌人上放 1 个毁灭标记（尽可能选无毁灭标记的）。', delta: -5, rider: 'doomOnEnemy' }),
    elderthing: Object.freeze({ text: '-6。如果你检定失败，受到 1 点伤害或 1 点恐惧。', delta: -6, rider: 'damageOrHorrorOnFail' }),
  }),
})

/** 逐标记取值：返回引擎 resolveChaosToken 契约的 `{ delta, onDraw, onFail }`。 */
export function apiaryChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (String(token)) {
    case 'skull':
      return { delta: -skullValue(state), onDraw: [], onFail: [] }
    case 'cultist':
      return {
        delta: hard ? -3 : -1,
        onDraw: cultistEnemyAtLocation(state, inv)
          ? [{ type: 'scenarioToken', token: 'cultist', mode: 'revealAnother' }] : [],
        onFail: [],
      }
    case 'tablet':
      return {
        delta: hard ? -5 : -3, onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'tablet', mode: hard ? 'doomOnEnemy' : 'doomOnEnemyNoDoom' }],
      }
    case 'elderthing':
      return {
        delta: hard ? -6 : -4, onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'damageOrHorrorOnFail' }],
      }
    default:
      return null
  }
}

/** 兼容旧测试/展示读点：返回签名修正值（负数）。 */
export function apiaryChaosTokenValue(state, tokenFace) {
  return apiaryChaosToken(state, null, tokenFace)?.delta ?? null
}

/** 提示卡文本（AI / 指南展示读点；按难度取对应面）。 */
export function apiaryTokenText(state, face) {
  return APIARY_TOKEN_MEANINGS[isHardSide(state) ? 'hard' : 'standard'][face]?.text || ''
}

export { codeOf, hasTrait }
