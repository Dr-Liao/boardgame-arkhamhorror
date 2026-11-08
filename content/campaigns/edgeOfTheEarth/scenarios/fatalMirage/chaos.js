// 致命幻景（fatalMirage · 08549）· 混乱标记。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/FatalMirage.hs#HasChaosTokenValue。
//   [skull]：简单/普通 = -X，X = 胜利区中剧情卡牌数量；
//            困难/专家 = -(X + 当前密谋编号)（= 数量 + 当前密谋编号，取负值修正）。
//   [cultist]：-2；[tablet]：简单/普通 -3、困难/专家 -4；[elder_thing]：-4 / -5。
//   「如果你检定失败」的追加后果（cultist/tablet/elderthing）在 behavior.afterTest 结算。
//
// 引擎契约：`behavior.resolveChaosToken` 返回 `{ delta, ... }`（或数字），
// 读点 src/engine/treachery-tokens.js#resolveSpecialToken；`scenario.tokenMeanings`
// 同源供 AI / 战斗概率 / 前端展示读取（delta 只对静态标记有效，skull 动态值由 behavior 计算）。
export const FATAL_MIRAGE_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X为胜利区中剧情卡牌的数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-2。如果你检定失败，将你的1个线索放到你所在地点。', delta: -2, rider: 'clueOnLocation' }),
    tablet: Object.freeze({ text: '-3。如果你检定失败，你必须移动到记忆囚笼，或者将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库，不要查看内容。', delta: -3, rider: 'prisonOrTekeli' }),
    elderthing: Object.freeze({ text: '-4。如果你检定失败，在场上一个[[幻灵]]敌人上放置1个毁灭标记。', delta: -4, rider: 'doomOnEidolon' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X为胜利区中剧情卡牌的数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-2。如果你检定失败，将你的1个线索放到你所在地点。', delta: -2, rider: 'clueOnLocation' }),
    tablet: Object.freeze({ text: '-3。如果你检定失败，你必须移动到记忆囚笼，或者将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库，不要查看内容。', delta: -3, rider: 'prisonOrTekeli' }),
    elderthing: Object.freeze({ text: '-4。如果你检定失败，在场上一个[[幻灵]]敌人上放置1个毁灭标记。', delta: -4, rider: 'doomOnEidolon' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X为当前密谋编号加上胜利区中剧情卡牌的数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-2。如果你检定失败，或成功但没有超过难度至少2点，将你的1个线索放到你所在地点。', delta: -2, rider: 'clueOnLocationUnlessSucceedBy2' }),
    tablet: Object.freeze({ text: '-4。如果你检定失败，你必须移动到记忆囚笼，或者将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库。(如果你检定失败且低于难度至少2点，改为两项都执行)。', delta: -4, rider: 'prisonOrTekeliBothIfFailBy2' }),
    elderthing: Object.freeze({ text: '-5。如果你检定失败，在场上一个[[幻灵]]敌人上放置1个毁灭标记。', delta: -5, rider: 'doomOnEidolon' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X为当前密谋编号加上胜利区中剧情卡牌的数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-2。如果你检定失败，或成功但没有超过难度至少2点，将你的1个线索放到你所在地点。', delta: -2, rider: 'clueOnLocationUnlessSucceedBy2' }),
    tablet: Object.freeze({ text: '-4。如果你检定失败，你必须移动到记忆囚笼，或者将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库。(如果你检定失败且低于难度至少2点，改为两项都执行)。', delta: -4, rider: 'prisonOrTekeliBothIfFailBy2' }),
    elderthing: Object.freeze({ text: '-5。如果你检定失败，在场上一个[[幻灵]]敌人上放置1个毁灭标记。', delta: -5, rider: 'doomOnEidolon' }),
  }),
})

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))

// 胜利区中的剧情卡（story）：物理卡以卡号字符串/对象两种形态出现；只把 b 面剧情卡计入 X。
export function storyVictoryCount(state) {
  const display = state.victoryDisplay || []
  return display.filter(entry => {
    const code = typeof entry === 'string' ? entry : entry?.code
    return /^\d{5}b$/.test(String(code || ''))
  }).length
}

// 当前密谋编号：优先读当前议程的阶段号（1a/2a/3a），回退到本章重入版本。
export function currentAgendaNumber(state) {
  const stage = String(state?.agendas?.[state?.agendaIndex ?? 0]?.stage || '')
  const match = /^(\d+)/.exec(stage)
  if (match) return Number(match[1])
  return Math.min(3, Math.max(1, Number(state?.scenarioFlags?.fatalMirageVersion) || 1))
}

// 逐标记取值：返回引擎 resolveChaosToken 契约的 `{ delta, rider? }`；未知标记交回默认表（null）。
// skull 的 X 是动态值（剧情卡数量 / + 当前密谋编号），为负修正（卡面 -X）。
export function fatalMirageChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (token) {
    case 'skull': {
      const x = storyVictoryCount(state) + (hard ? currentAgendaNumber(state) : 0)
      return { delta: -x, rider: null }
    }
    case 'cultist': return { delta: -2, rider: hard ? 'clueOnLocationUnlessSucceedBy2' : 'clueOnLocation' }
    case 'tablet': return { delta: hard ? -4 : -3, rider: hard ? 'prisonOrTekeliBothIfFailBy2' : 'prisonOrTekeli' }
    case 'elderthing': return { delta: hard ? -5 : -4, rider: 'doomOnEidolon' }
    default: return null
  }
}

// 兼容旧测试/展示读点：返回签名修正值（负数）。
export function fatalMirageChaosTokenValue(state, tokenFace, inv) {
  return fatalMirageChaosToken(state, inv, tokenFace)?.delta ?? null
}
