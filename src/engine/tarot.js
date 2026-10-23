// 塔罗牌组（Tarot Deck）原语 —— 第 2 步 P2.4。
//
// 万象无终的塔罗是**剧本级牌组**，不是 05 卡号：22 张大阿卡纳（0 愚者 … 21 世界）在
// 序章与《巫异时刻》里被抽出、选择、结算正逆位，抽走的牌在本次冒险内不再出现。
// 因此这里不建卡牌条目、不复用玩家塔罗槽位资产（那是 P2.9 的另一件事）。
//
// 状态形状（纯 JSON，随存档往返）：
//   state.scenarioDecks.tarot = {
//     deck: [0..21 的洗牌顺序],                       // 牌库；顺序是隐藏信息
//     drawn: [{ arcana, orientation, source? }],      // 已抽出/已结算的牌，保留正逆位
//     discarded: [arcana],                            // 被弃置/放回场外的牌（可选）
//   }
//
// 约定：
//   · 随机只有两个入口：`shuffle`（建堆）与 `random`（正逆位）；都由引擎的 randomValue 注入，
//     本模块自己不造随机数，所以可以确定性单测；
//   · 抽牌从牌库顶（数组末尾）取，抽走的牌进入 drawn；牌库空了不自动洗回（剧本决定怎么处理，
//     例如「洗回牌组」是显式的 shuffleInto）；
//   · 22 张唯一：建堆时校验 id 互不重复且都在 0–21。

export const TAROT_ORIENTATIONS = Object.freeze(['upright', 'reverse'])

// 22 张大阿卡纳的规范表（id 与西方传统编号一致：0 愚者 … 21 世界）。
export const MAJOR_ARCANA = Object.freeze([
  { id: 0, name: '愚者', nameEn: 'The Fool' },
  { id: 1, name: '魔术师', nameEn: 'The Magician' },
  { id: 2, name: '女祭司', nameEn: 'The High Priestess' },
  { id: 3, name: '女皇', nameEn: 'The Empress' },
  { id: 4, name: '皇帝', nameEn: 'The Emperor' },
  { id: 5, name: '教皇', nameEn: 'The Hierophant' },
  { id: 6, name: '恋人', nameEn: 'The Lovers' },
  { id: 7, name: '战车', nameEn: 'The Chariot' },
  { id: 8, name: '力量', nameEn: 'Strength' },
  { id: 9, name: '隐士', nameEn: 'The Hermit' },
  { id: 10, name: '命运之轮', nameEn: 'Wheel of Fortune' },
  { id: 11, name: '正义', nameEn: 'Justice' },
  { id: 12, name: '倒吊人', nameEn: 'The Hanged Man' },
  { id: 13, name: '死神', nameEn: 'Death' },
  { id: 14, name: '节制', nameEn: 'Temperance' },
  { id: 15, name: '恶魔', nameEn: 'The Devil' },
  { id: 16, name: '高塔', nameEn: 'The Tower' },
  { id: 17, name: '星星', nameEn: 'The Star' },
  { id: 18, name: '月亮', nameEn: 'The Moon' },
  { id: 19, name: '太阳', nameEn: 'The Sun' },
  { id: 20, name: '审判', nameEn: 'Judgement' },
  { id: 21, name: '世界', nameEn: 'The World' },
])

export function arcanaById(raw) {
  const id = Number(raw)
  return MAJOR_ARCANA.find(arcana => arcana.id === id) || null
}

export function normalizeOrientation(raw = 'upright') {
  const value = String(raw)
  if (!TAROT_ORIENTATIONS.includes(value)) {
    throw new Error(`塔罗正逆位无效：${JSON.stringify(raw)}（可用：${TAROT_ORIENTATIONS.join('、')}）`)
  }
  return value
}

// 建堆前校验：必须是 0–21 的整数且互不重复（22 张唯一）。
export function validateTarotCards(cards) {
  if (!Array.isArray(cards)) throw new Error('塔罗牌组需要 arcana 数组')
  const seen = new Set()
  for (const raw of cards) {
    const id = Number(raw)
    if (!Number.isInteger(id) || !arcanaById(id)) throw new Error(`未知的大阿卡纳：${JSON.stringify(raw)}`)
    if (seen.has(id)) throw new Error(`塔罗牌重复：${id}`)
    seen.add(id)
  }
  return [...seen]
}

function tarotPile(state, create = false) {
  if (!state.scenarioDecks) {
    if (!create) return null
    state.scenarioDecks = {}
  }
  if (!state.scenarioDecks.tarot) {
    if (!create) return null
    state.scenarioDecks.tarot = { deck: [], drawn: [], discarded: [] }
  }
  const pile = state.scenarioDecks.tarot
  pile.deck ||= []
  pile.drawn ||= []
  pile.discarded ||= []
  return pile
}

// 建堆：默认 22 张大阿卡纳；也可以传入既有牌（例如重开时保留已抽走的部分，需要显式做差集）。
export function buildTarotDeck(state, { cards = MAJOR_ARCANA.map(arcana => arcana.id), shuffle } = {}) {
  if (typeof shuffle !== 'function') throw new Error('建塔罗牌组需要注入 shuffle（引擎随机源）')
  const ids = validateTarotCards(cards)
  if (ids.length !== 22) throw new Error(`塔罗牌组必须是 22 张（收到 ${ids.length} 张）`)
  const pile = tarotPile(state, true)
  pile.deck = shuffle([...ids])
  pile.drawn = []
  pile.discarded = []
  return pile
}

// 正逆位：显式给方向就用它；'random' 用注入的 random() 决定。
export function tarotOrientation(orientation = 'upright', random = Math.random) {
  if (orientation === 'random') return random() < 0.5 ? 'reverse' : 'upright'
  return normalizeOrientation(orientation)
}

// 抽牌：从牌库顶抽 count 张，记进 drawn 并返回带正逆位的条目。
// 牌库不足时返回实际抽到的张数（可能为空），绝不自动洗回。
export function drawTarot(state, { count = 1, orientation = 'upright', random = Math.random, source = null } = {}) {
  const pile = tarotPile(state, true)
  const result = []
  for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
    const arcana = pile.deck.pop()
    if (arcana == null) break
    const entry = { arcana, orientation: tarotOrientation(orientation, random) }
    if (source) entry.source = source
    pile.drawn.push(entry)
    result.push(entry)
  }
  return result
}

// 抽取 N 选 1：全部抽出后询问；没被选中的放回牌库底（顺序保留），选中的留在 drawn 末尾。
// 返回选中的条目（牌库为空时返回 null）。`requestChoice(state, request)` 由引擎注入。
//
// 选择种类固定为 `pickTarot`（路线图 §6）：界面靠它认出「这是塔罗抽牌」，而不是去猜选项文案。
// 每个选项都带齐界面要显示的信息（编号、正逆位、中英文名），前端不再存 22 张大阿卡纳的表。
export function tarotChoiceOption(entry) {
  const arcana = arcanaById(entry.arcana)
  const orientation = entry.orientation === 'reverse' ? 'reverse' : 'upright'
  return {
    id: String(entry.arcana),
    label: `${arcana?.name || entry.arcana}${orientation === 'reverse' ? '（逆位）' : '（正位）'}`,
    arcana: Number(entry.arcana),
    orientation,
    nameZh: arcana?.name || null,
    nameEn: arcana?.nameEn || null,
  }
}

export function chooseTarot(state, { seat, count = 2, orientation = 'upright', random = Math.random,
  source = null, prompt = null, requestChoice } = {}) {
  if (typeof requestChoice !== 'function') throw new Error('选择塔罗需要注入 requestChoice')
  const candidates = drawTarot(state, { count, orientation, random, source })
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  const chosenId = String(requestChoice(state, {
    kind: 'pickTarot',
    source: { kind: 'tarot', mode: 'choose', count: candidates.length, ...(source ? { card: source } : {}) },
    seat,
    prompt: prompt || `选择一张要结算的塔罗牌（共 ${candidates.length} 张）。`,
    options: candidates.map(entry => tarotChoiceOption(entry)),
  }))
  const pile = tarotPile(state, true)
  const chosen = candidates.find(entry => String(entry.arcana) === chosenId) || candidates[0]
  // 没被选中的放回牌库底；选中的保留在 drawn 里。
  const rejected = candidates.filter(entry => entry !== chosen)
  pile.deck.unshift(...rejected.map(entry => entry.arcana))
  pile.drawn = pile.drawn.filter(entry => !rejected.includes(entry))
  return chosen
}

// 把已抽出的牌洗回牌库（显式的「洗回牌组」效果）。
export function shuffleTarotIntoDeck(state, { entries = null, shuffle } = {}) {
  if (typeof shuffle !== 'function') throw new Error('洗回塔罗牌需要注入 shuffle')
  const pile = tarotPile(state, true)
  const returning = entries ? entries.map(entry => (typeof entry === 'object' ? entry.arcana : entry)) : pile.drawn.map(entry => entry.arcana)
  const keeping = entries ? pile.drawn.filter(entry => !returning.includes(entry.arcana)) : []
  pile.deck = shuffle([...pile.deck, ...returning])
  pile.drawn = keeping
  return pile
}

// 弃置一张已抽出的牌（例如「放回场外」而不是洗回牌库）。
export function discardDrawnTarot(state, arcana) {
  const pile = tarotPile(state, true)
  const index = pile.drawn.findIndex(entry => entry.arcana === Number(arcana))
  if (index < 0) return false
  const [entry] = pile.drawn.splice(index, 1)
  pile.discarded.push(entry.arcana)
  return true
}

export function tarotRemaining(state) {
  const pile = tarotPile(state, false)
  return pile ? [...pile.deck] : []
}

// 公开投影：牌库存量 + 已抽出的牌（正逆位 + 名称）。牌库顺序不进入投影。
export function tarotInfo(state) {
  const pile = tarotPile(state, false)
  if (!pile) return null
  return {
    deck: pile.deck.length,
    drawn: pile.drawn.map(entry => {
      const arcana = arcanaById(entry.arcana)
      return {
        arcana: entry.arcana, orientation: entry.orientation,
        nameZh: arcana?.name || null, nameEn: arcana?.nameEn || null,
      }
    }),
    discarded: [...pile.discarded],
  }
}

export function resetTarotDeck(state) {
  if (state.scenarioDecks) delete state.scenarioDecks.tarot
  return null
}
