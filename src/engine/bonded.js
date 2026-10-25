// 绑定（Bonded）原语 —— 第 2 步 P2.8。
//
// 印刷规则：带「绑定」的主卡（例如圣化之镜 05313）带 3 份**场外**绑定副本（05314 舒缓旋律）；
// 主卡入场时检索这些副本——1 张加入手牌、其余洗回牌库；主卡离场时把副本收回场外集合。
// 绑定副本不在 30 张牌库里，也不参与构筑计数。
//
// 数据来源（cards-data.js，只读）：
//   主卡：{ bondedCards: [{ code, count }], ... }
//   副本：{ bondedTo: '<主卡英文名>', bondedCount: 3, ... }
//
// 状态形状（纯 JSON，随存档往返）：
//   state.bondedSets = {
//     '<主卡号>': { seat, cards: [副本卡号, 副本卡号, 副本卡号], retrieved: false }
//   }
// 只保存**场外**剩下的副本；检索出去的副本由持有者的手牌/牌库持有，离场时按号收回。
//
// 随机只在「洗回牌库」一处：由引擎的 randomValue 通过注入的 shuffle 提供，本模块不造随机数。
// 引擎不认卡号：主卡/副本关系全部来自卡面数据字段。

export function bondedCardList(card) {
  if (!Array.isArray(card?.bondedCards)) return []
  return card.bondedCards
    .filter(entry => entry && typeof entry.code === 'string')
    .map(entry => ({ code: entry.code, count: Math.max(1, Math.floor(Number(entry.count) || 1)) }))
}

export function isBondedCopy(card) {
  return Boolean(card?.bondedTo) || Number(card?.bondedCount) > 0
}

// 找一份副本属于哪张主卡：同名卡可能有 ReturnTo 版本（54002 也叫 Hallowed Mirror），
// 因此先按「谁真的列出了这份副本」过滤，再优先同号段（前两位相同），最后取代码最接近的一张。
export function findBondedMain(allCards, copyCode) {
  const copy = allCards?.[copyCode]
  if (!copy || !isBondedCopy(copy)) return null
  const entries = Object.entries(allCards)
    .filter(([, card]) => bondedCardList(card).some(entry => entry.code === copyCode))
  if (!entries.length) return null
  const prefix = String(copyCode).slice(0, 2)
  const sameCycle = entries.filter(([code]) => String(code).slice(0, 2) === prefix)
  const pool = sameCycle.length ? sameCycle : entries
  const numeric = code => Number(String(code).replace(/[a-z]$/i, ''))
  pool.sort(([a], [b]) => Math.abs(numeric(a) - numeric(copyCode)) - Math.abs(numeric(b) - numeric(copyCode)))
  return pool[0][0]
}

export function createBonded(deps) {
  const { ALL_CARDS, cardName, info, shuffle } = deps

  function groupOf(code) {
    const card = ALL_CARDS?.[code]
    if (!card) return null
    const bonded = bondedCardList(card)
    if (bonded.length) return { main: code, copies: bonded }
    const main = findBondedMain(ALL_CARDS, code)
    if (!main) return null
    return { main, copies: bondedCardList(ALL_CARDS[main]), copyOf: main }
  }

  // 场外集合：进入剧本时按卡面数量建一次；旧存档没有这个键时惰性创建。
  function setFor(state, inv, mainCode) {
    const card = ALL_CARDS?.[mainCode]
    const copies = bondedCardList(card)
    if (!copies.length) return null
    state.bondedSets ||= {}
    const existing = state.bondedSets[mainCode]
    if (existing) return existing
    const cards = []
    for (const entry of copies) for (let i = 0; i < entry.count; i++) cards.push(entry.code)
    const created = { seat: inv?.seat ?? null, cards, retrieved: false }
    state.bondedSets[mainCode] = created
    return created
  }

  // 主卡入场：把场外副本全部取出，1 张入手，其余洗回持有者牌库。
  function retrieve(state, inv, mainCode, options = {}) {
    const { handCount = 1 } = options
    if (!inv) return []
    const set = setFor(state, inv, mainCode)
    if (!set) return []
    if (!set.cards.length) {
      info?.(state, options.events, `「${cardName(mainCode)}」的绑定副本已在场外集合，没有可取出的牌。`)
      return []
    }
    set.seat = inv.seat
    set.retrieved = true
    const pool = [...set.cards]
    set.cards = []
    const toHand = pool.splice(0, Math.min(Math.max(0, handCount), pool.length))
    inv.hand.push(...toHand)
    if (pool.length) {
      // 其余副本洗回牌库（随机只走注入的 shuffle）。
      const rest = [...pool]
      const shuffleFn = options.shuffle || shuffle
      inv.deck = shuffleFn ? shuffleFn([...inv.deck, ...rest]) : [...inv.deck, ...rest]
    }
    info?.(state, options.events, `🎴 「${cardName(mainCode)}」入场：${toHand.length} 张绑定卡加入手牌，${pool.length} 张洗回牌库。`)
    return [...toHand, ...pool]
  }

  // 主卡离场：把副本从持有者的手牌/牌库/弃牌堆/场上/威胁区收回场外集合。
  function returnToSet(state, inv, mainCode, options = {}) {
    if (!inv) return []
    const set = setFor(state, inv, mainCode)
    if (!set) return []
    const copyCodes = new Set(set.cards.concat(bondedCardList(ALL_CARDS?.[mainCode]).flatMap(entry => [entry.code])))
    // 2026-10-25 第四轮修复 05313/05316：绑定副本可能被移到任意调查员的区域（手牌/牌库/
    // 弃牌堆/场外下方/场上/威胁区），收回场外集合时要遍历所有调查员的全部区域。
    const collected = []
    // 列表元素可能是卡号字符串，也可能是带 code 的实例对象（放在地点/场上等）。
    const codeOf = entry => typeof entry === 'string' ? entry : entry?.code
    const take = list => {
      if (!Array.isArray(list)) return
      for (let i = list.length - 1; i >= 0; i--) {
        const code = codeOf(list[i])
        if (!copyCodes.has(code)) continue
        collected.push(code)
        list.splice(i, 1)
      }
    }
    for (const owner of state.investigators || [inv]) {
      take(owner.hand)
      take(owner.deck)
      take(owner.discard)
      if (Array.isArray(owner.beneath)) take(owner.beneath)
      for (const asset of owner.assets.slice()) {
        if (!copyCodes.has(asset.code)) continue
        collected.push(asset.code)
        owner.assets.splice(owner.assets.indexOf(asset), 1)
      }
      for (const threat of owner.threat.slice()) {
        if (!copyCodes.has(threat.code)) continue
        collected.push(threat.code)
        owner.threat.splice(owner.threat.indexOf(threat), 1)
      }
    }
    // 2026-10-25 第四轮修复 05313/05316（交叉复核）：卡面要求「找到所有副本（即使在场外）」，
    // 地点下方/移出游戏/放逐区同样要扫；05175b 阁楼会把非弱点牌放到 location.beneath。
    for (const location of state.locations || []) {
      if (Array.isArray(location.beneath)) take(location.beneath)
    }
    take(state.removedFromGame)
    take(state.exiled)
    set.cards.push(...collected)
    if (!collected.length) set.retrieved = false
    if (collected.length) info?.(state, options.events, `🎴 「${cardName(mainCode)}」离场：${collected.length} 张绑定卡收回场外集合。`)
    return collected
  }

  // 公开读数：场外集合张数（副本身份与数量是桌面公开信息）。
  function projection(state) {
    const sets = state.bondedSets
    if (!sets) return {}
    return Object.fromEntries(Object.entries(sets).map(([main, set]) => [main, {
      seat: set.seat ?? null,
      cards: [...set.cards],
      retrieved: set.retrieved === true,
    }]))
  }

  // 章节结束/重开：把每个绑定集合散落在所有调查员区域里的副本人手一批收回场外集合。
  // 只处理已经建过的集合（没打过绑定卡的关卡不会新增状态键，replay 指纹不变）。
  function returnAll(state, options = {}) {
    if (!state.bondedSets) return 0
    let total = 0
    for (const main of Object.keys(state.bondedSets)) {
      for (const inv of state.investigators) total += returnToSet(state, inv, main, { events: options.events }).length
    }
    return total
  }

  return { groupOf, retrieve, returnToSet, returnAll, projection, setFor }
}

// 公开读数：场外集合内容（副本身份与数量是桌面公开信息）。纯函数：观察投影直接引用。
export function bondedSetProjection(state) {
  const sets = state?.bondedSets
  if (!sets) return {}
  return Object.fromEntries(Object.entries(sets).map(([main, set]) => [main, {
    seat: set.seat ?? null,
    cards: [...set.cards],
    retrieved: set.retrieved === true,
  }]))
}
