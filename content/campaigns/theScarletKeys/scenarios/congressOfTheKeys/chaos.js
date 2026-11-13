// 钥匙议会（Congress of the Keys · 09694）· 混乱标记取值与后果。
//
// 参考：09694 卡面两档（Easy/Standard 正面、Hard/Expert 背面）+ locale `#tokens`。
//   [skull]      -X。X = 当前幕编号（困难/专家为幕编号 +1）
//   [cultist]    -5 / -7。你可以将你控制的一个[[稳定]]钥匙翻至[[动荡]]面，改为将修正值视为 -2 / -4
//   [tablet]     -2。如果这是对重整的[[域外]]敌人的攻击（困难/专家：你所在地点有重整的[[域外]]敌人），
//                改为自动失败
//   [elderthing] -3 / -4。取消投入本次检定的每张卡牌上的效果和图标，把它们放到一边，作为空洞
//
// 口径与其它章节一致：`resolveChaosToken` 只返回数值与引擎已消费的字段
// （`delta` / `autoFail` / `cancelCommitted`），需要章节层逐卡结算的部分用 `rider` 标记，
// 由 `behavior.afterTest` 统一执行（引擎在正常与自动失败两条路径各调一次，rider 必须幂等）。
//   · `autoFail` 由 src/engine/tests.js#resolveSpecialToken 的消费点直接生效；
//   · `cancelCommitted` 取消投入的**技能卡**图标（引擎读点），卡牌本身的空洞化在 afterTest 里做
//     （`hollowCommitted`）；引擎没有「取消每张投入卡效果」的原语，见 primitive-requests/09694.json。
import { chapterSection, flattenStory } from '../../story-access.js'

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const meaningsFor = state => (isHardSide(state) ? CONGRESS_TOKEN_MEANINGS.hard : CONGRESS_TOKEN_MEANINGS.standard)

/** 当前幕编号（印刷 X；缺失按 1，避免出现 0 或负修正）。 */
export function currentActNumber(state) {
  const act = state?.acts?.[Number(state?.actIndex) || 0]
  const stage = String(act?.stage || '1a')
  const value = Number.parseInt(stage, 10)
  if (Number.isFinite(value) && value > 0) return value
  const number = Number(act?.number)
  return Number.isFinite(number) && number > 0 ? number : 1
}

// 卡面文字取 story-text 的 `tokens` 段（生成物），缺失时用印刷摘要，不写第二份事实源。
const tokenText = (side, token) => flattenStory(chapterSection('congressOfTheKeys', `tokens.${side}.${token}`, '')) || ''

export const CONGRESS_TOKEN_MEANINGS = (() => {
  const easy = Object.freeze({
    skull: Object.freeze({ text: tokenText('easyStandard', 'skull') || '-X。X为当前场景编号。', delta: 0, dynamic: 'actNumber' }),
    cultist: Object.freeze({ text: tokenText('easyStandard', 'cultist') || '-5。可以翻稳定钥匙改视为-2。', delta: -5, rider: 'cultistKeyFlip', flipDelta: -2 }),
    tablet: Object.freeze({ text: tokenText('easyStandard', 'tablet') || '-2。对重整域外敌人的攻击自动失败。', delta: -2, rider: 'tabletOutsiderAutoFail', autoFailOnOutsiderAttack: true }),
    elderthing: Object.freeze({ text: tokenText('easyStandard', 'elderThing') || '-3。取消投入卡并把它们作为空洞。', delta: -3, rider: 'hollowCommitted', cancelCommitted: true }),
  })
  const hard = Object.freeze({
    skull: Object.freeze({ text: tokenText('hardExpert', 'skull') || '-X。X为当前场景编号+1。', delta: 0, dynamic: 'actNumberPlusOne' }),
    cultist: Object.freeze({ text: tokenText('hardExpert', 'cultist') || '-7。可以翻稳定钥匙改视为-4。', delta: -7, rider: 'cultistKeyFlip', flipDelta: -4 }),
    tablet: Object.freeze({ text: tokenText('hardExpert', 'tablet') || '-2。地点有重整域外敌人时自动失败。', delta: -2, rider: 'tabletOutsiderAutoFail', autoFailOnReadyOutsiderHere: true }),
    elderthing: Object.freeze({ text: tokenText('hardExpert', 'elderThing') || '-4。取消投入卡并把它们作为空洞。', delta: -4, rider: 'hollowCommitted', cancelCommitted: true }),
  })
  // 简单/普通共用正面表，困难/专家共用背面表（与卡面 2 档一致）。
  return Object.freeze({ easy, standard: easy, hard, expert: hard })
})()

/** 场上是否有重整的[[域外]]敌人（[tablet] 的自动失败条件）。 */
export function readyOutsiderHere(state, inv) {
  const here = inv?.location
  return (state?.enemies || []).some(enemy => !enemy.defeated && enemy.location === here
    && enemy.exhausted !== true
    && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'outsider'))
}
export function readyOutsiderAnywhere(state) {
  return (state?.enemies || []).some(enemy => !enemy.defeated && enemy.exhausted !== true
    && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'outsider'))
}

/**
 * 逐标记取值：`{ delta, autoFail?, cancelCommitted?, rider?, x? }`；未声明的标记返回 null（交回引擎默认表）。
 * `options.attackOutsider`：本次检定是不是「对重整[[域外]]敌人的攻击」（简单/普通的 [tablet] 条件）。
 */
export function congressChaosToken(state, inv, token, options = {}) {
  const hard = isHardSide(state)
  const table = hard ? CONGRESS_TOKEN_MEANINGS.hard : CONGRESS_TOKEN_MEANINGS.standard
  const entry = table[token]
  if (!entry) return null
  if (token === 'skull') {
    const x = currentActNumber(state) + (hard ? 1 : 0)
    return { delta: -x, rider: 'skullActNumber', x }
  }
  if (token === 'cultist') {
    return { delta: entry.delta, rider: 'cultistKeyFlip', flipDelta: entry.flipDelta, x: Math.abs(entry.delta) }
  }
  if (token === 'tablet') {
    const attackOutsider = options.attackOutsider === true
    const autoFail = hard ? readyOutsiderHere(state, inv) : attackOutsider
    return { delta: entry.delta, rider: 'tabletOutsiderAutoFail', ...(autoFail ? { autoFail: true } : {}) }
  }
  return { delta: entry.delta, rider: 'hollowCommitted', cancelCommitted: true }
}

/**
 * 检定后需要章节层结算的标记后果（behavior.afterTest 读；纯数据、幂等）。
 * 返回去重后的 rider 列表；`cultistKeyFlip` 的翻钥匙选择发生在取值阶段（behavior.resolveChaosToken），
 * 这里不再重复询问，只保留标记供日志/测试。
 */
export function congressAfterTest(state, inv, result, options = {}) {
  if (!inv || !result) return []
  const hard = isHardSide(state)
  const table = hard ? CONGRESS_TOKEN_MEANINGS.hard : CONGRESS_TOKEN_MEANINGS.standard
  const cancelled = new Set(result.cancelledTokens || result.cancelled || [])
  const tokens = [...new Set((result.drawn || []).filter(token => !cancelled.has(token)))]
  const riders = []
  for (const token of tokens) {
    const entry = table[token]
    if (!entry?.rider) continue
    if (entry.rider === 'hollowCommitted') riders.push('hollowCommitted')
    else if (entry.rider === 'tabletOutsiderAutoFail') riders.push('tabletOutsiderAutoFail')
    else if (entry.rider === 'cultistKeyFlip') riders.push('cultistKeyFlip')
  }
  void options
  return [...new Set(riders)]
}
