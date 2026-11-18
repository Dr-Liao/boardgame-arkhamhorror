// 山谷的命运（fateOfTheVale · 10651）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/FateOfTheVale.hs#HasChaosTokenValue +
//       frontend/src/locales/en/theFeastOfHemlockVale/fateOfTheVale.json#tokens +
//       Enemy/CardDefs/.../FateOfTheVale.hs（[[Colour]]/[[Emissary]] 特性）。
//   简单/普通
//     [skull]     : -X。X = 当前幕号 +1。
//     [cultist]   : -4。若你检定失败，随机弃 1 张手牌。
//     [tablet]    : -5。你可以将 1 个毁灭放在你的调查员卡上，视为该标记修正值为 0。
//     [elderthing]: -2。若这是对宇宙密使的攻击或躲避检定，再揭示一个标记。
//   困难/专家
//     [skull]     : -X。X = 场上[[星之彩]]（Colour）敌人数量。
//     [cultist]   : -6。随机弃 1 张手牌（无论检定结果）。
//     [tablet]    : -8。你可以将 1 个毁灭放在你的调查员卡上，视为该标记修正值为 -3。
//     [elderthing]: -5。若这是对宇宙密使的攻击或躲避检定，你自动失败。
//
// 引擎契约（treachery-tokens.js#resolveSpecialToken）：`behavior.resolveChaosToken` 返回
// `{ delta, drawAnother?, autoFail?, onDraw?, onFail? }`；`onDraw`/`onFail` 的
// `{type:'scenarioToken', token, mode}` 由 skill-effects.js#applyTokenFx 回派到
// `behavior.applyTokenEffect`。动态 skull 数值与「对密使」判定只能在这里算，因为引擎只在
// 揭示标记的当下把 state 交进来。
//
// 近似：
//   · [tablet] 的「放毁灭把修正改为 0/-3」需要玩家在标记揭示时选择；引擎没有「标记揭示时
//     改修正」的交互窗口，因此本标记按印刷数值结算，可选项由 behavior.applyTokenEffect 的
//     tablet 分支处理（放毁灭只作为代价提示，不追改本次修正）。见 simplified 披露。
//   · [elderthing] 简单/普通的「再揭示一个标记」用 `drawAnother`（引擎既有通道）。
//   · [elderthing] 困难/专家的「自动失败」用 `autoFail`（引擎 tests.js 读取）。

const EMISSARY_TRAIT = 'emissary'
const COLOUR_TRAIT = 'colour'

const tokenText = {
  easyStandard: {
    skull: '-X。X 为当前幕号 +1。',
    cultist: '-4。若你检定失败，随机弃掉 1 张手牌。',
    tablet: '-5。你可以将 1 个毁灭放在你的调查员卡上，视为该标记修正值为 0。',
    elderthing: '-2。若这是对宇宙密使的攻击或躲避检定，再揭示一个标记。',
  },
  hardExpert: {
    skull: '-X。X 为场上[[星之彩]]敌人数量。',
    cultist: '-6。随机弃掉 1 张手牌。',
    tablet: '-8。你可以将 1 个毁灭放在你的调查员卡上，视为该标记修正值为 -3。',
    elderthing: '-5。若这是对宇宙密使的攻击或躲避检定，你自动失败。',
  },
}

// AI / 前端展示用的同源表（scenario.tokenMeanings 从这里取）。
export const FATE_TOKEN_MEANINGS = Object.freeze(Object.fromEntries(['easy', 'standard', 'hard', 'expert']
  .map(difficulty => {
    const hard = difficulty === 'hard' || difficulty === 'expert'
    const table = hard ? tokenText.hardExpert : tokenText.easyStandard
    return [difficulty, Object.freeze({
      skull: Object.freeze({ text: table.skull, delta: 0, dynamic: 'act' }),
      cultist: Object.freeze({ text: table.cultist, delta: hard ? -6 : -4, rider: hard ? 'always' : 'fail' }),
      tablet: Object.freeze({ text: table.tablet, delta: hard ? -8 : -5, rider: hard ? 'hard' : 'easy' }),
      elderthing: Object.freeze({ text: table.elderthing, delta: hard ? -5 : -2, rider: 'againstEmissary' }),
    })]
  })))

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1

export const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())

/** 宇宙密使（双面 8 个面）：正面是 [[星之彩]]，背面是 [[破碎]]。 */
export const EMISSARY_CODES = Object.freeze([
  '10662a', '10662b', '10663a', '10663b', '10664a', '10664b', '10665a', '10665b',
])
export const EMISSARY_COLOUR_CODES = Object.freeze(['10662a', '10663a', '10664a', '10665a'])
export const EMISSARY_SHATTERED_CODES = Object.freeze(['10662b', '10663b', '10664b', '10665b'])

export const isEmissaryCode = code => EMISSARY_CODES.includes(String(code || ''))
export const isEmissary = enemy => isEmissaryCode(enemy?.originalCode || enemy?.code)
  || hasTrait(enemy, EMISSARY_TRAIT)
export const isColourEmissary = enemy => EMISSARY_COLOUR_CODES.includes(String(enemy?.originalCode || enemy?.code || ''))
  || (hasTrait(enemy, EMISSARY_TRAIT) && hasTrait(enemy, COLOUR_TRAIT))

/** 当前幕号（10655/10656 = 1/2，10657–10660 = 3）；牌库尚未建立时按 1 算。 */
export function currentActNumber(state) {
  const acts = Array.isArray(state?.acts) ? state.acts : []
  const index = Number.isInteger(state?.actIndex) ? state.actIndex : 0
  const act = acts[index]
  if (!act) return 1
  const parsed = /^(\d+)/.exec(String(act.stage || ''))
  if (parsed) return Number(parsed[1])
  const byCode = { 10655: 1, 10656: 2, 10657: 3, 10658: 3, 10659: 3, 10660: 3 }
  return byCode[String(act.originalCode || act.code)] ?? 1
}

/** 场上 [[星之彩]]（Colour）敌人数量。 */
export function colourEnemyCount(state) {
  return (state?.enemies || []).filter(enemy => hasTrait(enemy, COLOUR_TRAIT)).length
}

/** 本次检定是否「对宇宙密使的攻击或躲避」——state.skillTest 由引擎在检定帧里写入。 */
export function againstCosmicEmissary(state) {
  const frame = state?.skillTest
  if (!frame) return false
  const kind = String(frame.actionKind || '')
  if (!['fight', 'evade', 'fightEnemy', 'evadeEnemy'].includes(kind)) return false
  const targetId = frame.target?.id ?? frame.target?.enemyId ?? null
  const target = targetId != null
    ? (state?.enemies || []).find(enemy => String(enemy.id) === String(targetId))
    : null
  if (target) return isEmissary(target)
  // 帧里没有可解析的目标（旧存档/AI 预览）：只要场上有密使就按命中处理，避免漏掉负面效果。
  return (state?.enemies || []).some(isEmissary)
}

/** 逐标记取值：引擎 resolveChaosToken 契约的 `{ delta, drawAnother?, autoFail?, onDraw, onFail }`。 */
export function fateChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (String(token || '')) {
    case 'skull':
      return { delta: hard ? -colourEnemyCount(state) : -(currentActNumber(state) + 1), onDraw: [], onFail: [] }
    case 'cultist':
      return hard
        ? { delta: -6, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'always' }], onFail: [] }
        : { delta: -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'cultist', mode: 'fail' }] }
    case 'tablet':
      return hard
        ? { delta: -8, onDraw: [{ type: 'scenarioToken', token: 'tablet', mode: 'hard' }], onFail: [] }
        : { delta: -5, onDraw: [{ type: 'scenarioToken', token: 'tablet', mode: 'easy' }], onFail: [] }
    case 'elderthing': {
      if (!againstCosmicEmissary(state)) return { delta: hard ? -5 : -2, onDraw: [], onFail: [] }
      return hard
        ? { delta: -5, autoFail: true, onDraw: [], onFail: [] }
        : { delta: -2, drawAnother: true, onDraw: [], onFail: [] }
    }
    default:
      return null
  }
}

/** 兼容测试/展示读点：只要签名修正值。 */
export function fateChaosTokenValue(state, tokenFace, inv) {
  return fateChaosToken(state, inv, tokenFace)?.delta ?? null
}

/** 供 AI 估算：当前难度下本次检定若揭示该标记的净结果（含 autoFail）。 */
export function fateChaosTokenSummary(state, inv, token) {
  const fx = fateChaosToken(state, inv, token)
  if (!fx) return null
  return { ...fx, hard: isHardSide(state), investigators: investigatorCount(state) }
}
