// 黑曜石峡谷（obsidianCanyons · 11639）· 混乱标记（占位重建）。
export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const STORM_INTENSITY_KEY = 'stormIntensity'
export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])
export const OPEN_SKY_CODE = 'xsky'
const flagsOf = state => (state.scenarioFlags ||= {})
export function stormIntensity(state) {
  const value = Number(flagsOf(state)[STORM_INTENSITY_KEY])
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 1
}
export function setStormIntensity(state, value) {
  const next = Math.max(0, Math.trunc(Number(value) || 0))
  flagsOf(state)[STORM_INTENSITY_KEY] = next
  return next
}
export function increaseStormIntensity(state, amount = 1) {
  return setStormIntensity(state, stormIntensity(state) + Math.max(0, Math.trunc(Number(amount) || 0)))
}
export function decreaseStormIntensity(state, amount = 1) {
  return setStormIntensity(state, stormIntensity(state) - Math.max(0, Math.trunc(Number(amount) || 0)))
}
export function skullValue(state) {
  return stormIntensity(state) + (isHardSide(state) ? 2 : 0)
}
export const isOpenSkyId = (state, id) => {
  if (String(id || '').startsWith('openSky')) return true
  const location = (state?.locations || []).find(item => item.id === id)
  return Boolean(location && (location.openSky === true || String(location.code || '') === OPEN_SKY_CODE))
}
export function adjacentOpenSkies(state, inv) {
  const here = (state?.locations || []).find(location => location.id === inv?.location)
  if (!here) return []
  return [...(here.connections || [])].filter(id => isOpenSkyId(state, id))
}
export function adjacentOpenSkyCount(state, inv) {
  return adjacentOpenSkies(state, inv).length
}
export function tabletValue(state, inv) {
  return adjacentOpenSkyCount(state, inv) * (isHardSide(state) ? 2 : 1)
}
export function enemiesAt(state, locationId) {
  return (state?.enemies || []).filter(enemy => !enemy.defeated && enemy.location === locationId)
}
export const OBSIDIAN_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为当前风暴强度。', delta: 0, dynamic: 'storm' }),
    cultist: Object.freeze({ text: '-4。如果你检定失败，在最近的敌人上放置 1 个毁灭标记。', delta: -4, rider: 'doomOnNearestEnemyOnFail' }),
    tablet: Object.freeze({ text: '-1。你所在地点每有一处相邻的开阔天空，再 -1。', delta: 0, dynamic: 'adjacentOpenSky' }),
    elderthing: Object.freeze({ text: '-2。如果你所在地点有敌人，再揭示一个标记。', delta: -2, rider: 'revealAnotherIfEnemy' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为当前风暴强度。', delta: 0, dynamic: 'storm' }),
    cultist: Object.freeze({ text: '-4。如果你检定失败，在最近的敌人上放置 1 个毁灭标记。', delta: -4, rider: 'doomOnNearestEnemyOnFail' }),
    tablet: Object.freeze({ text: '-1。你所在地点每有一处相邻的开阔天空，再 -1。', delta: 0, dynamic: 'adjacentOpenSky' }),
    elderthing: Object.freeze({ text: '-2。如果你所在地点有敌人，再揭示一个标记。', delta: -2, rider: 'revealAnotherIfEnemy' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为当前风暴强度 + 2。', delta: 0, dynamic: 'storm' }),
    cultist: Object.freeze({ text: '-6。在最近的敌人上放置 1 个毁灭标记。', delta: -6, rider: 'doomOnNearestEnemyOnDraw' }),
    tablet: Object.freeze({ text: '-2。你所在地点每有一处相邻的开阔天空，再 -2。', delta: 0, dynamic: 'adjacentOpenSky' }),
    elderthing: Object.freeze({ text: '-4。如果你所在地点有敌人，再揭示一个标记。', delta: -4, rider: 'revealAnotherIfEnemy' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为当前风暴强度 + 2。', delta: 0, dynamic: 'storm' }),
    cultist: Object.freeze({ text: '-6。在最近的敌人上放置 1 个毁灭标记。', delta: -6, rider: 'doomOnNearestEnemyOnDraw' }),
    tablet: Object.freeze({ text: '-2。你所在地点每有一处相邻的开阔天空，再 -2。', delta: 0, dynamic: 'adjacentOpenSky' }),
    elderthing: Object.freeze({ text: '-4。如果你所在地点有敌人，再揭示一个标记。', delta: -4, rider: 'revealAnotherIfEnemy' }),
  }),
})
export function obsidianCanyonChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (String(token)) {
    case 'skull':
      return { delta: -skullValue(state), onDraw: [], onFail: [] }
    case 'cultist':
      return hard
        ? { delta: -6, onDraw: [{ type: 'placeDoomOnNearestEnemy', amount: 1 }], onFail: [] }
        : { delta: -4, onDraw: [], onFail: [{ type: 'placeDoomOnNearestEnemy', amount: 1 }] }
    case 'tablet':
      return { delta: -tabletValue(state, inv), onDraw: [], onFail: [] }
    case 'elderthing': {
      const hasEnemy = inv?.location ? enemiesAt(state, inv.location).length > 0 : false
      return {
        delta: hard ? -4 : -2,
        onDraw: hasEnemy ? [{ type: 'scenarioToken', token: 'elderthing', mode: 'revealAnother' }] : [],
        onFail: [],
      }
    }
    default:
      return null
  }
}
export function obsidianCanyonChaosTokenValue(state, tokenFace, inv = null) {
  return obsidianCanyonChaosToken(state, inv, tokenFace)?.delta ?? null
}
export function obsidianCanyonTokenText(state, face) {
  return OBSIDIAN_TOKEN_MEANINGS[isHardSide(state) ? 'hard' : 'standard'][face]?.text || ''
}
export const stormSummary = state => ({
  stormIntensity: stormIntensity(state),
  skull: skullValue(state),
  isHardSide: isHardSide(state),
})
