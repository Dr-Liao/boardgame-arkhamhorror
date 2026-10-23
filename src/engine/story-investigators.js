// 序章无牌组故事调查员原语 —— 第 2 步 P2.6。
//
// 印刷场景：序章的 4 位故事调查员（05046–05049）「每位玩家选择 1 位；人数少于 4 时把没被选的划掉」。
// 他们没有牌组、没有弃牌堆，不能抽牌/与牌组互动，只用固定的属性与一张专属设置卡行动；
// 他们不进入选人列表、不参与构筑与升级，也不登记为战役调查员（冒险结束就换回原来的调查员）。
//
// 状态形状（纯 JSON，随存档往返）：
//   state.storyInvestigators = {
//     config: { codes: string[], crossOutUnused: boolean, setupCards: { [code]: string[] } },
//     chosen: [{ seat, code, name }],
//     crossedOut: [code],
//     originals: [{ seat, code, name }],   // 换回原本调查员所需
//   }
//
// 本模块只做「选人 / 划掉 / 换人 / 换回 / 无牌组准备」这五件事：
//   · 选择通过注入的 requestChoice 完成（每个座位各选一次，被占用的 code 不可再选）；
//   · 无牌组由 `prepareStoryInvestigator` 落实（deck/hand/discard 清空 + `storyInvestigator: true`），
//     引擎的抽牌与起手、换牌读 `isStoryInvestigator` 直接跳过；
//   · 专属设置卡在进入剧本时直接入场，不占 30 张牌库。
// 一次性规则（例如某位调查员的特殊能力）仍写在章节里，不塞进本模块。

function fail(origin, message) {
  throw new Error(`故事调查员无效（${origin}）：${message}`)
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

// 注册期校验：剧本数据里的 storyInvestigators 写错时在装配内容时失败。
export function normalizeStoryInvestigatorConfig(raw, origin = 'scenario.storyInvestigators') {
  if (raw == null) return null
  if (!isPlainObject(raw)) fail(origin, '必须是对象')
  const unknown = Object.keys(raw).filter(key => !['codes', 'crossOutUnused', 'setupCards', 'prompt'].includes(key))
  if (unknown.length) fail(origin, `未知字段 ${unknown.join('、')}`)
  if (!Array.isArray(raw.codes) || !raw.codes.length) fail(origin, 'codes 必须是非空数组')
  const codes = []
  for (const code of raw.codes) {
    if (typeof code !== 'string' || !code) fail(origin, 'codes 必须是卡号字符串')
    if (codes.includes(code)) fail(origin, `codes 重复：${code}`)
    codes.push(code)
  }
  const setupCards = {}
  if (raw.setupCards != null) {
    if (!isPlainObject(raw.setupCards)) fail(origin, 'setupCards 必须是 { code: [cardCode] } 对象')
    for (const [code, list] of Object.entries(raw.setupCards)) {
      if (!codes.includes(code)) fail(origin, `setupCards 指向未声明调查员：${code}`)
      if (!Array.isArray(list) || !list.length) fail(origin, `setupCards[${code}] 必须是非空数组`)
      for (const card of list) {
        if (typeof card !== 'string' || !card) fail(origin, `setupCards[${code}] 必须是卡号字符串`)
      }
      setupCards[code] = [...list]
    }
  }
  return Object.freeze({
    codes: Object.freeze(codes),
    crossOutUnused: raw.crossOutUnused !== false,
    setupCards: Object.freeze(setupCards),
    ...(raw.prompt ? { prompt: String(raw.prompt) } : {}),
  })
}

// 读点：「这次剧本里，这个座位是不是无牌组故事调查员」。
export function isStoryInvestigator(state, inv) {
  if (!state?.storyInvestigators || !inv) return false
  return state.storyInvestigators.chosen.some(entry => entry.seat === inv.seat && entry.code === inv.code)
}

export function storyInvestigatorConfig(state) {
  return state.storyInvestigators?.config || null
}

// 某个座位当前的专属设置卡（进入剧本时直接入场）。
export function storyInvestigatorSetupCards(state, code) {
  return state.storyInvestigators?.config?.setupCards?.[code] || []
}

// 选人：每个座位各选一次，已选的 code 不可重复；人数少于 4 时其余 code 被划掉。
// `requestChoice(state, request)` 与 `cardName(code)` 由引擎注入；`cardInfo(code)` 可选，
// 用来把卡面身份（职业、属性、生命／理智）带进选项，界面就不必再查一遍卡表。
export function selectStoryInvestigators(state, rawConfig, { seats, requestChoice, cardName = code => code, cardInfo = () => null } = {}) {
  const config = normalizeStoryInvestigatorConfig(rawConfig, 'storyInvestigators')
  if (!config) throw new Error('没有故事调查员配置')
  const seatList = [...(seats || state.investigators.map(inv => inv.seat))].sort((a, b) => a - b)
  if (!seatList.length) throw new Error('没有座位可以分配故事调查员')
  if (seatList.length > config.codes.length) {
    throw new Error(`玩家数（${seatList.length}）多于故事调查员（${config.codes.length}）`)
  }
  if (typeof requestChoice !== 'function') throw new Error('选择故事调查员需要注入 requestChoice')

  const originals = seatList.map(seat => {
    const inv = state.investigators[seat]
    return { seat, code: inv.code, name: inv.name }
  })
  const chosen = []
  const remaining = [...config.codes]
  for (const seat of seatList) {
    const inv = state.investigators[seat]
    const answer = requestChoice(state, {
      kind: 'storyInvestigator',
      source: { kind: 'storyInvestigator', remaining: [...remaining], seatCount: seatList.length },
      seat,
      prompt: config.prompt || `${inv.name}：选择你本次冒险使用的故事调查员。`,
      options: remaining.map(code => {
        const info = cardInfo(code) || {}
        const name = cardName(code)
        return {
          id: code, label: name, name,
          klass: info.klass || null, classLabel: info.classLabel || null,
          subtitle: info.subtitle || null,
          stats: info.stats || null,
          health: info.health ?? null, sanity: info.sanity ?? null,
        }
      }),
    })
    const code = remaining.includes(String(answer)) ? String(answer) : remaining[0]
    remaining.splice(remaining.indexOf(code), 1)
    // 换人：只换身份字段；属性/牌组由进入剧本的 prepareStoryInvestigator 统一处理。
    inv.code = code
    inv.name = cardName(code)
    chosen.push({ seat, code, name: inv.name })
  }
  const crossedOut = config.crossOutUnused ? remaining : []
  state.storyInvestigators = { config, chosen, crossedOut, originals }
  return state.storyInvestigators
}

// 换回原本的调查员（下一章不再声明故事调查员时调用），并清掉状态键。
export function restoreStoryInvestigators(state) {
  const record = state.storyInvestigators
  if (!record) return null
  for (const original of record.originals || []) {
    const inv = state.investigators[original.seat]
    if (!inv) continue
    inv.code = original.code
    inv.name = original.name
    inv.storyInvestigator = false
    invokeCleanup(inv)
  }
  delete state.storyInvestigators
  return record
}

function invokeCleanup(inv) {
  // 无牌组标记不留在换回来的调查员身上。
  delete inv.noDeck
}

// 进入剧本：把一位故事调查员摆成「无牌组」状态。设置卡由调用方放进场（用引擎的实例工厂）。
export function prepareStoryInvestigator(inv, { setupCards = [] } = {}) {
  inv.storyInvestigator = true
  inv.noDeck = true
  inv.deck = []
  inv.hand = []
  inv.discard = []
  inv.hiddenCards = []
  inv.beneath = []
  return { setupCards: [...setupCards] }
}

// 公开投影：谁选了谁、哪些被划掉（都是桌面公开信息）。
export function storyInvestigatorProjection(state) {
  const record = state.storyInvestigators
  if (!record) return null
  return {
    chosen: record.chosen.map(entry => ({ seat: entry.seat, code: entry.code, name: entry.name })),
    crossedOut: [...record.crossedOut],
  }
}
