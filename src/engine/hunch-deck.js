// 直觉牌库（调查员专属第二牌库）—— 第 5 步 M1 调查员批次（P6）。
//
// 印刷场景：乔·戴蒙德的「你的牌库必须包括至少 11 张[[洞察]]事件（包括悬案）；每场冒险的
// 冒险设置期间，你必须从牌库中选择 11 张[[洞察]]事件（其中必须包括悬案），将其混洗为一个
// 单独的『直觉牌库』」；「强制 - 在调查阶段开始时：揭示你直觉牌库顶 1 张卡牌。直到本阶段
// 结束，你可以以 -2 费用打出该卡牌，如同它是你的手牌。如果当本阶段结束时该卡牌未被打出，
// 将其洗回你的直觉牌库」。
//
// 为什么不是「第三套遭遇牌库」那种通用原语：直觉牌库只有一位调查员使用，卡池也是他自己的
// 牌库（不是遭遇牌），因此不进 alt-decks 的通用通道；规则仍集中在引擎这一处读点，卡文件里
// 只声明 `investigator.hunchDeck = { size, trait, requiredCodes }`。
//
// 状态形状（纯 JSON，随存档往返）：
//   inv.hunchDeck      string[]   直觉牌库（顺序是隐藏信息，只投影张数）
//   inv.hunchRevealed  string|null 本阶段已揭示、还没洗回的那张（已进手牌）
//
// 结算点（全部在本文件，引擎只调用这五个函数）：
//   prepareHunchDeck   —— 冒险设置：从牌库抽出 11 张洞察事件
//   revealHunchCard    —— 调查阶段开始：揭示牌库顶，放进手牌（因此「如同手牌」不需要第二条打出通道）
//   returnHunchCard    —— 调查阶段结束：仍未打出则洗回
//   hunchPlayDiscount  —— 打出费用 -2（读点在 playCost）
//   moveInsightToHunchBottom —— 旧印：把弃牌堆的一张洞察事件放到直觉牌库底

import { investigatorRule } from '../cards/card-rules.js'

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
// 注册期校验：`investigator.hunchDeck` 写错时在装配内容时失败，而不是开局静默不生效。
export function normalizeHunchDeckRule(raw, origin = 'investigator.hunchDeck') {
  if (raw == null) return null
  if (!isPlainObject(raw)) throw new Error(`${origin}: 必须是对象`)
  const unknown = Object.keys(raw).filter(key => !['size', 'trait', 'requiredCodes', 'discount'].includes(key))
  if (unknown.length) throw new Error(`${origin}: 未知字段 ${unknown.join('、')}`)
  const size = raw.size
  if (!Number.isSafeInteger(size) || size < 1) throw new Error(`${origin}: size 必须是正整数`)
  if (typeof raw.trait !== 'string' || !raw.trait) throw new Error(`${origin}: trait 必须是非空字符串`)
  const requiredCodes = raw.requiredCodes == null ? [] : raw.requiredCodes
  if (!Array.isArray(requiredCodes) || requiredCodes.some(code => typeof code !== 'string' || !code)) {
    throw new Error(`${origin}: requiredCodes 必须是卡号数组`)
  }
  if (requiredCodes.length > size) throw new Error(`${origin}: requiredCodes 不能多于 size`)
  const discount = raw.discount == null ? 2 : raw.discount
  if (!Number.isSafeInteger(discount) || discount < 0) throw new Error(`${origin}: discount 必须是非负整数`)
  return Object.freeze({
    size,
    trait: raw.trait,
    requiredCodes: Object.freeze([...requiredCodes]),
    discount,
  })
}

const hasTrait = (card, trait) => (card?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())

const isInsightEvent = (cardDef, code, trait) => {
  const card = cardDef(code)
  return card?.type === 'event' && hasTrait(card, trait)
}

// 公开投影（纯函数，内容层投影与观察投影共用）：牌库张数与已揭示的那张，顺序永不外泄。
export function projectHunch(state) {
  const out = []
  for (const inv of state?.investigators || []) {
    if (!Array.isArray(inv.hunchDeck) && !inv.hunchRevealed) continue
    out.push({
      seat: inv.seat,
      deck: (inv.hunchDeck || []).length,
      revealed: inv.hunchRevealed || null,
    })
  }
  return out
}

export function createHunchDeck(deps) {
  const {
    cardDef,
    cardName,
    info,
    newCardInstance,
    randomValue,
    registeredEntry,
    requestChoice,
    shuffle,
  } = deps

  // 读点：这张调查员有没有直觉牌库（返回规范化后的规则或 null）。
  // 规范化结果按卡号缓存：`playCost` 这类热路径每次打牌都会问一次。
  const ruleCache = new Map()
  function hunchRuleOf(code) {
    if (!code) return null
    if (ruleCache.has(code)) return ruleCache.get(code)
    const rule = normalizeHunchDeckRule(investigatorRule(code)?.hunchDeck || null)
    ruleCache.set(code, rule)
    return rule
  }

  function isHunchInvestigator(state, inv) {
    if (!inv) return false
    return Boolean(hunchRuleOf(inv.code))
  }

  // 冒险设置：从牌库里挑出 11 张洞察事件放进直觉牌库。
  // 规则要求「必须包括悬案」——签名弱点一定在牌库里，所以先放必选，再按顺序补足。
  function prepareHunchDeck(state, inv, events = []) {
    const rule = hunchRuleOf(inv.code)
    if (!rule) return null
    const candidates = (inv.deck || []).filter(code => isInsightEvent(cardDef, code, rule.trait))
    const pool = [...candidates]
    const chosen = []
    for (const code of rule.requiredCodes) {
      const index = pool.indexOf(code)
      if (index < 0) continue
      chosen.push(code)
      pool.splice(index, 1)
    }
    // 数量足够时逐一询问（AI 座位同样走 requestChoice 的默认答案），否则按牌库顺序补齐。
    let guard = 0
    while (chosen.length < rule.size && pool.length && guard++ < rule.size + 4) {
      if (pool.length + chosen.length <= rule.size) {
        for (const code of pool.splice(0)) chosen.push(code)
        break
      }
      const answer = requestChoice(state, {
        kind: 'hunchDeck',
        source: { kind: 'hunchDeck', code: inv.code, remaining: rule.size - chosen.length },
        seat: inv.seat,
        prompt: `选择放进直觉牌库的[[洞察]]事件（还需 ${rule.size - chosen.length} 张）。`,
        options: pool.map(code => ({ id: code, cardCode: code, label: cardName(code) })),
      })
      const picked = pool.includes(answer) ? answer : pool[0]
      pool.splice(pool.indexOf(picked), 1)
      chosen.push(picked)
    }
    for (const code of chosen) {
      const index = inv.deck.indexOf(code)
      if (index >= 0) inv.deck.splice(index, 1)
    }
    inv.hunchDeck = shuffle([...chosen], () => randomValue(state))
    inv.hunchRevealed = null
    if (chosen.length < rule.size) {
      info(state, events, `⚠️ ${inv.name} 的牌组只有 ${chosen.length} 张[[洞察]]事件，不足直觉牌库需要的 ${rule.size} 张。`)
    }
    info(state, events, `🔮 ${inv.name} 把 ${inv.hunchDeck.length} 张[[洞察]]事件混洗成直觉牌库。`)
    return inv.hunchDeck
  }

  // 调查阶段开始：揭示牌库顶一张。揭示牌**不进手牌**，只记在 inv.hunchRevealed；
  // 打出示意由 legalMoves 的 fromHunch 通道提供（如同在手牌中、-2 费用）。
  function revealHunchCard(state, inv, events = []) {
    const rule = hunchRuleOf(inv.code)
    if (!rule || state.storyInvestigators) return null
    if (!Array.isArray(inv.hunchDeck) || !inv.hunchDeck.length) return null
    // 上一张还没洗回（阶段被重复）时先按规则洗回，避免两张同时被揭示。
    if (inv.hunchRevealed) returnHunchCard(state, inv, events)
    const code = inv.hunchDeck.pop()
    inv.hunchRevealed = code
    info(state, events, `🔮 ${inv.name} 揭示直觉牌库顶的「${cardName(code)}」：本阶段可以少付 ${rule.discount} 资源打出它。`)
    return code
  }

  // 调查阶段结束：仍未打出的那张洗回直觉牌库。
  function returnHunchCard(state, inv, events = []) {
    if (!inv || !inv.hunchRevealed) return null
    const code = inv.hunchRevealed
    inv.hunchRevealed = null
    const index = (inv.hand || []).indexOf(code)
    if (index >= 0) inv.hand.splice(index, 1)
    // 05010「悬案」：本应洗入直觉牌库时改为进入威胁区域（条目级 avoidHunchShuffle）。
    if (registeredEntry(code)?.avoidHunchShuffle) {
      inv.threat ||= []
      inv.threat.push(newCardInstance(state, code, {}))
      info(state, events, `「${cardName(code)}」改为进入 ${inv.name} 的威胁区域（不洗回直觉牌库）。`)
      return code
    }
    inv.hunchDeck ||= []
    inv.hunchDeck.push(code)
    inv.hunchDeck = shuffle(inv.hunchDeck, () => randomValue(state))
    info(state, events, `🔮 ${inv.name} 把「${cardName(code)}」洗回直觉牌库。`)
    return code
  }

  // 打出费用 -2：读点在 playCost（只有本阶段揭示的那一张）。
  function hunchPlayDiscount(state, inv, code) {
    if (!inv || !inv.hunchRevealed || inv.hunchRevealed !== code) return 0
    return hunchRuleOf(inv.code)?.discount || 0
  }

  // 旧印：把弃牌堆的一张[[洞察]]事件放到直觉牌库底。
  function insightInDiscard(inv) {
    const rule = hunchRuleOf(inv.code)
    if (!rule) return []
    return (inv.discard || []).filter(code => isInsightEvent(cardDef, code, rule.trait))
  }

  function moveInsightToHunchBottom(state, inv, code, events = []) {
    if (!hunchRuleOf(inv.code)) return null
    const index = (inv.discard || []).indexOf(code)
    if (index < 0) return null
    inv.discard.splice(index, 1)
    inv.hunchDeck ||= []
    inv.hunchDeck.push(code)
    info(state, events, `🔮 ${inv.name} 把弃牌堆里的「${cardName(code)}」放到直觉牌库底。`)
    return code
  }

  // 离开剧本/换人时清掉直觉牌库，避免带进下一关或下一局。
  function clearHunchDeck(inv) {
    if (!inv) return
    delete inv.hunchDeck
    delete inv.hunchRevealed
  }

  // 公开投影：牌库张数与已揭示的那张（顺序永不外泄）。
  function hunchProjection(state) {
    return projectHunch(state)
  }

  return {
    hunchRuleOf,
    isHunchInvestigator,
    prepareHunchDeck,
    revealHunchCard,
    returnHunchCard,
    hunchPlayDiscount,
    insightInDiscard,
    moveInsightToHunchBottom,
    clearHunchDeck,
    hunchProjection,
  }
}
