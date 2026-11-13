// 谜雨（riddlesAndRain · 提示卡 09501）· 混乱标记四档含义。
//
// 来源：参考指南 `locales/{en,zh}/theScarletKeys/scenarios/riddlesAndRain.json#tokens`
// 与印刷提示卡 09501 正/反面卡文（cards-data 的 text / backText 与之一致）：
//   简单/普通：[skull] -1（线索 ≥2 时 -3）；[tablet] -1（你所在地点有隐匿迷你卡时再揭示一个标记）；
//             [elder_thing] -3（失败：花费 1 线索，或在阴影中的敌人上放 1 毁灭）。
//   困难/专家：[skull] -2（线索 ≥2 时 -4）；[tablet] -2；[elder_thing] -4（失败同简单/普通）。
// 其余标记沿用战役混乱袋基础值（shared.js#CHAOS_BAGS，没有 cultist）；本文件只声明本章覆盖项。
//
// 读点：
//   · 数值 → 章节 behavior.resolveChaosToken（treachery-tokens.js#resolveSpecialToken 优先读行为）；
//   · 失败后果 → 章节 behavior.afterTest（同一份 pure spec，测试直接断言）；
//   · tokenMeanings（definition.scenario）→ AI 概率预估（combat-odds.js）与卡面展示。

export const RIDDLES_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    // [skull] 依赖「你当前线索数」（≥2 时改为 -3），静态表无法表达 → 由 behavior 结算；
    // 这里保留说明文本，AI 概率预估按「未知符号」处理（与 EotE 的写法一致）。
    skull: '简单/普通：-1；如果你有至少 2 个线索，改为 -3',
    tablet: { delta: -1, drawAnotherIfConcealed: true, note: '如果你所在地点有隐匿迷你卡牌，再揭示一个混乱标记' },
    elderThing: { delta: -3, onFail: { kind: 'clueOrDoomOnShadowEnemy', amount: 1 } },
  }),
  standard: Object.freeze({
    skull: '简单/普通：-1；如果你有至少 2 个线索，改为 -3',
    tablet: { delta: -1, drawAnotherIfConcealed: true, note: '如果你所在地点有隐匿迷你卡牌，再揭示一个混乱标记' },
    elderThing: { delta: -3, onFail: { kind: 'clueOrDoomOnShadowEnemy', amount: 1 } },
  }),
  hard: Object.freeze({
    skull: '困难/专家：-2；如果你有至少 2 个线索，改为 -4',
    tablet: { delta: -2, drawAnotherIfConcealed: true, note: '如果你所在地点有隐匿迷你卡牌，再揭示一个混乱标记' },
    elderThing: { delta: -4, onFail: { kind: 'clueOrDoomOnShadowEnemy', amount: 1 } },
  }),
  expert: Object.freeze({
    skull: '困难/专家：-2；如果你有至少 2 个线索，改为 -4',
    tablet: { delta: -2, drawAnotherIfConcealed: true, note: '如果你所在地点有隐匿迷你卡牌，再揭示一个混乱标记' },
    elderThing: { delta: -4, onFail: { kind: 'clueOrDoomOnShadowEnemy', amount: 1 } },
  }),
})

// 印刷卡 09501 的两面文本（definition 的 storyFaces 直接用 cards-data 的 text/backText，这里只做核对口径）。
export const TOKEN_FACES = Object.freeze({ front: 'easyStandard', back: 'hardExpert' })

const hardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))

/**
 * 标记修正值（纯读；返回 null 表示交回引擎默认值）。
 *   · [skull]：线索 ≥2 时困难/专家 -4、简单/普通 -3；否则 -2 / -1。
 *   · [tablet]：困难/专家 -2，简单/普通 -1。附带「有隐匿迷你卡则再揭示一个标记」由返回对象的
 *     drawAnother 表达（引擎在 resolveSpecialToken 里读取）。
 *   · [elder_thing]：困难/专家 -4，简单/普通 -3。
 * `concealedHere` 由调用方（behavior）传入「你所在地点是否有隐匿迷你卡」，纯数据函数保持可测。
 */
export function riddlesChaosTokenOutcome(state, inv, token, { concealedHere = false } = {}) {
  const hard = hardSide(state)
  if (token === 'skull') {
    const clues = Number(inv?.clues) || 0
    const withClues = clues >= 2
    return { delta: hard ? (withClues ? -4 : -2) : (withClues ? -3 : -1), drawAnother: false, onDraw: [], onFail: [] }
  }
  if (token === 'tablet') {
    return { delta: hard ? -2 : -1, drawAnother: concealedHere && true, onDraw: [], onFail: [] }
  }
  if (token === 'elderthing' || token === 'elderThing') {
    return { delta: hard ? -4 : -3, drawAnother: false, onDraw: [], onFail: [] }
  }
  return null
}

/**
 * 检定失败时 [elder_thing] 的后果（纯数据；由 behavior.afterTest 用 api 执行）：
 * 「你必须花费 1 个线索，或在阴影中的一个敌人上放置 1 个毁灭标记」——二选一，由玩家决定。
 * 没有线索、也没有阴影中的敌人时返回 null（无从结算，不制造软锁）。
 */
export function riddlesElderThingFailureSpec(state, inv, tokenFace, failedBy) {
  if (!(Number(failedBy) > 0)) return null
  if (!['elderthing', 'elderThing'].includes(String(tokenFace))) return null
  const clues = Number(inv?.clues) || 0
  void state
  return { token: 'elderthing', kind: 'clueOrDoomOnShadowEnemy', amount: 1, affordable: clues > 0 }
}
