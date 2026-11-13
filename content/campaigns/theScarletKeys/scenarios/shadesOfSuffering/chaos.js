// 苦痛之影（Shades of Suffering · 09660）· 混乱标记取值与后果。
//
// 参考：09660 卡面两档 + 参考实现 `Scenario/Scenarios/TheScarletKeys/ShadesOfSuffering.hs#getChaosTokenValue`
// 与 `ResolveChaosToken` / `FailedSkillTest` 分支；locale `scenarios/shadesOfSuffering.json#tokens`。
//   [skull]      简单/普通：-X，X = ⌈影穑充能数 / 2⌉（上限 6）；困难/专家：-X，X = 充能数
//   [cultist]    简单/普通：-4，检定失败且低于难度至少 2 点时在影穑上放 1 充能；
//                困难/专家：-5，揭示时立即放 1 充能
//   [tablet]     简单/普通：-1，如果你所在地点有[[灵怪]]敌人，额外揭示 1 个混乱标记；
//                困难/专家：-3，如果你所在地点有[[灵怪]]敌人，本次检定自动失败
//   [elderthing] 简单/普通：-4；困难/专家：-6。你可以先在影穑上放 1 充能，把本标记的修正值改为
//                0（简单/普通）或 -3（困难/专家）
//
// 口径：
//   · 数值与「额外揭示 / 自动失败」由 behavior.resolveChaosToken 调本文件的
//     shadesOfSufferingChaosToken 给出（X 依赖充能数，静态 tokenMeanings 表达不了）；
//   · 「失败且低于难度至少 2 点」的充能由 behavior.afterTest 调 shadesOfSufferingAfterTest 取 rider；
//   · [elderthing] 的「可以付 1 充能改修正」在取值时询问（值是相对难度的即时结果，不能延后到 afterTest）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

// 影穑充能记在场景旗标 `scenarioFlags.shadeReaperCharges`（唯一键名；definition 再导出给 behavior 用，
// 卡条目在自己的文件里用同名常量经 `api.scenarioFlag/setScenarioFlag` 读写）。
export const CHARGE_FLAG = 'shadeReaperCharges'
export const GEIST_TRAIT = 'Geist'
export const MAX_SKULL_CHARGES = 6

const standardTable = Object.freeze({
  skull: { text: '-X。X为影穑上充能数的一半，向上取整(X不能大于6)。', delta: 0, dynamic: 'chargesHalf' },
  cultist: { text: '-4。如果你检定失败且低于难度至少2点，在影穑上放置1充能。', delta: -4, rider: 'chargeOnFailedByTwo' },
  tablet: { text: '-1。如果你所在地点有[[灵怪]]敌人，揭示额外一个混乱标记。', delta: -1, rider: 'geistExtraToken' },
  elderthing: { text: '-4。你可以在影穑上放置1充能，以将本标记的修正值改为视作0。', delta: -4, rider: 'payChargeForZero' },
})
const hardTable = Object.freeze({
  skull: { text: '-X。X为影穑上充能数。', delta: 0, dynamic: 'charges' },
  cultist: { text: '-5。在影穑上放置1充能。', delta: -5, rider: 'chargeOnReveal' },
  tablet: { text: '-3。如果你所在地点有[[灵怪]]敌人，你自动失败。', delta: -3, rider: 'geistAutoFail' },
  elderthing: { text: '-6。你可以在影穑上放置1充能，以将本标记的修正值改为-3。', delta: -6, rider: 'payChargeForMinusThree' },
})

export const SHADES_OF_SUFFERING_TOKEN_MEANINGS = Object.freeze({
  easy: standardTable, standard: standardTable, hard: hardTable, expert: hardTable,
})

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const meaningsFor = state => (isHardSide(state) ? hardTable : standardTable)

/** 影穑上的充能数（`scenarioFlags.shadeReaperCharges`；缺失按 0）。 */
export function shadeReaperCharges(state) {
  const value = Number(state?.scenarioFlags?.[CHARGE_FLAG])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/** [skull] 的 X：简单/普通 ⌈充能/2⌉（上限 6）；困难/专家 充能数。 */
export function skullModifier(state) {
  const charges = shadeReaperCharges(state)
  if (isHardSide(state)) return charges
  return Math.min(MAX_SKULL_CHARGES, Math.ceil(charges / 2))
}

/** 某调查员所在地点是否有[[灵怪]]敌人（含隐匿迷你卡代表的灵怪真身以外的在场敌人）。 */
export function geistAt(state, inv) {
  return (state?.enemies || []).some(enemy => !enemy.defeated && enemy.location === inv?.location
    && (enemy.traits || []).some(trait => String(trait).toLowerCase() === GEIST_TRAIT.toLowerCase()))
}

const hasCharge = (state, inv, api) => {
  void inv
  void api
  return shadeReaperCharges(state) >= 0
}

/**
 * 逐标记取值：`{ delta, drawAnother?, autoFail?, rider? }`；未声明的标记交回引擎默认表（null）。
 * 传 api 时 [elderthing] 会询问「是否放 1 充能把修正改成 0 / -3」。
 */
export function shadesOfSufferingChaosToken(state, inv, token, api = null) {
  const table = meaningsFor(state)
  const entry = table[token]
  if (!entry) return null
  if (token === 'skull') {
    const x = skullModifier(state)
    return { delta: x > 0 ? -x : 0 }
  }
  if (token === 'cultist') {
    // 困难/专家的充能在揭示时立即放置（参考实现 ResolveChaosToken Cultist）。
    if (isHardSide(state) && typeof api?.setScenarioFlag === 'function') {
      api.setScenarioFlag(CHARGE_FLAG, shadeReaperCharges(state) + 1)
      api.info?.('🎭 [cultist]：在影穑上放置 1 充能。')
    }
    return { delta: entry.delta, rider: entry.rider }
  }
  if (token === 'tablet') {
    const here = geistAt(state, inv)
    if (!here) return { delta: entry.delta }
    if (isHardSide(state)) return { delta: entry.delta, autoFail: true, rider: 'geistAutoFail' }
    return { delta: entry.delta, drawAnother: true, rider: 'geistExtraToken' }
  }
  // elderthing：可以付 1 充能改修正值。
  const targetDelta = isHardSide(state) ? -3 : 0
  let pay = false
  if (hasCharge(state, inv, api) && (typeof api?.choose === 'function' || typeof api?.choice === 'function')) {
    const request = {
      kind: 'token', source: 'shadesElderThing', seat: inv?.seat ?? 0,
      prompt: `[elderthing]：在影穑上放置 1 充能，把本标记的修正值改为 ${targetDelta}？`,
      options: [
        { id: 'pay', label: `放置 1 充能（修正改为 ${targetDelta}）` },
        { id: 'skip', label: `不放置（修正 ${entry.delta}）` },
      ],
    }
    const answer = (typeof api.choose === 'function' ? api.choose(request) : api.choice(request))
    pay = answer === 'pay'
  }
  if (pay && typeof api?.setScenarioFlag === 'function') {
    api.setScenarioFlag(CHARGE_FLAG, shadeReaperCharges(state) + 1)
    api.info?.(`🎭 [elderthing]：放置 1 充能，修正值改为 ${targetDelta}。`)
    return { delta: targetDelta, rider: 'paidCharge' }
  }
  return { delta: entry.delta, rider: entry.rider }
}

/** 本次检定实际计入的标记（去掉被取消的）。 */
function resolvedTokens(result) {
  const cancelled = new Set(result?.cancelledTokens || [])
  return (result?.drawn || []).filter(token => !cancelled.has(token))
}

/**
 * 检定结束后的标记连带效果（behavior.afterTest 读；只返回 rider 名称）。
 * `failedBy` 取自结果（难度 - 技能值）；简单/普通的 cultist 失败且低于难度至少 2 点才触发。
 */
export function shadesOfSufferingAfterTest(state, inv, result) {
  if (!inv || !result) return []
  const failedBy = Number.isFinite(result.failedBy) ? Number(result.failedBy)
    : Math.max(0, Number(result.difficulty || 0) - Number(result.value || 0))
  if (result.success !== false) return []
  const riders = []
  for (const token of resolvedTokens(result)) {
    if (token === 'cultist' && !isHardSide(state) && failedBy >= 2) riders.push('cultistCharge')
  }
  return [...new Set(riders)]
}

export const cardNameOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)
