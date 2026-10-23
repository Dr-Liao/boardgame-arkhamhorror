// 诡镇奇谈：卡牌版 · 关卡声明（Phase 3 · D3：剧本声明化）
//
// 关卡行为此前只有一种写法：`content/campaigns/<campaign>/scenarios/<id>/behavior.js`
// 里的命令式钩子（全库 23 个文件、121 个钩子、1.3 万行）。D3 把「布置 / 遭遇 / 推进 /
// 结局」这四类**结构**抽成数据，行为退化为少数真正的脚本钩子：
//
//   import { declareScenario } from '../../../scenario-declaration.js'
//   export const behavior = declareScenario({
//     id: 'theDevourerBelow',
//     setup: {
//       startLocation: 'mainPath',
//       locations: { pool: 'woodsPool', count: 4 },
//       enemies: [{ code: 'acolyte', count: 'investigators-1', at: ['southside'] }],
//       deck: { addAgentSet: true },
//       revealed: false,
//     },
//     data: { interruptRitualActIndex: 2, sacrificeLita: true },
//     hooks: { actions(state, inv) { … }, resolution(state, key, events, api) { … } },
//   })
//
// 声明支持的字段（未知字段在构建时抛错，不静默忽略）：
//   setup.startLocation  string | { record, then, else }           → startLocation
//   setup.locations      string[]                                   → setupLocations
//                        | { all, except, variants, unlessRecord }   （见 buildSetupLocations）
//                        | { pool, count, first }                    （从关卡池随机取，前后可定序）
//   setup.enemies        [{ code, count, at, exhausted }]            → setupEnemies
//   setup.deck           { removeSpawnedEnemies, addAgentSet }       → modifyDeck
//   setup.startRevealed  boolean                                    → locationsStartRevealed
//   setup.storyInvestigators { codes, crossOutUnused?, setupCards? }  → storyInvestigators（无牌组故事调查员，P2.6）
//   data                 其余「关卡常量」原样挂到 behavior 上（roundEndActIndex / houseFateChoice…）
//   hooks                真正的脚本钩子（actions / describe / resolution / actReveal…）
//
// 返回的对象与旧 behavior.js 完全同形：引擎按同名钩子调用，注册表只校验 behavior.id。
// 因此迁移一个关卡不需要改引擎，测试里 `{ ...behavior }` 的展开也照旧成立。

const SETUP_KEYS = new Set(['startLocation', 'locations', 'enemies', 'deck', 'startRevealed', 'storyInvestigators'])
const DECLARATION_KEYS = new Set(['id', 'setup', 'data', 'hooks'])
const RESERVED_HOOKS = new Set(['id', 'startLocation', 'setupLocations', 'setupEnemies', 'modifyDeck', 'locationsStartRevealed'])

function assertKeys(object, allowed, origin) {
  for (const key of Object.keys(object || {})) {
    if (!allowed.has(key)) throw new Error(`${origin}: 未知字段 ${key}（可选：${[...allowed].join(' / ')}）`)
  }
}

// 起始地点：常量，或「按战役记录二选一」。
function buildStartLocation(spec, origin) {
  if (spec == null) return {}
  if (typeof spec === 'string') return { startLocation: () => spec }
  if (typeof spec === 'function') return { startLocation: spec }
  if (typeof spec === 'object' && spec.record && spec.then && spec.else) {
    return {
      startLocation: state => (state.campaign?.records?.[spec.record] ? spec.then : spec.else),
    }
  }
  throw new Error(`${origin}.startLocation: 必须是地点 id、{ record, then, else } 或函数`)
}

// 布置哪些地点：
//   ['study']                          固定清单
//   { all: true, except: [...] }       关卡定义里的全部地点（可排除）
//   exceptIf: { record, ids }          「记录为真时才排除」的地点
//   { variants: true }                 先把 locationVariants 逐地点随机选定（午夜假面）
//   { pool: 'woodsPool', count: 4 }    从关卡池随机取 N 个（首位固定可写 first）
function buildSetupLocations(spec, origin) {
  if (spec == null) return {}
  if (Array.isArray(spec)) return { setupLocations: () => [...spec] }
  if (typeof spec !== 'object') throw new Error(`${origin}.locations: 必须是数组或对象`)
  assertKeys(spec, new Set(['all', 'except', 'exceptIf', 'variants', 'pool', 'count', 'first']), `${origin}.locations`)
  return {
    setupLocations(state, events, api) {
      if (spec.variants) {
        // 引擎在建局时初始化 state.locationVariants；声明式钩子也要能在最小夹具里跑。
        state.locationVariants ||= {}
        for (const [id, variants] of Object.entries(state.scenario.locationVariants || {})) {
          if (!variants.length) continue
          state.locationVariants[id] = variants[Math.floor(api.randomValue(state) * variants.length)]
          api.info(state, events, `🎲 「${id}」随机变体：${state.locationVariants[id].name}。`)
        }
      }
      if (spec.pool) {
        const pool = state.scenario[spec.pool] || []
        const count = Number(spec.count ?? pool.length)
        const picked = api.shuffle(pool, () => api.randomValue(state)).slice(0, count)
        return spec.first ? [spec.first, ...picked] : picked
      }
      const except = new Set(spec.except || [])
      if (spec.exceptIf && state.campaign?.records?.[spec.exceptIf.record]) {
        for (const id of spec.exceptIf.ids || []) except.add(id)
      }
      const ids = Object.keys(state.scenario.locations)
      return ids.filter(id => !except.has(id))
    },
  }
}

// 布置敌人：数量可以是数字、'investigators' 或 'investigators-1'；地点按顺序取用。
function buildSetupEnemies(spec, origin) {
  if (spec == null) return {}
  if (!Array.isArray(spec)) throw new Error(`${origin}.enemies: 必须是数组`)
  return {
    setupEnemies(state, events, api) {
      for (const entry of spec) {
        if (!entry?.code) throw new Error(`${origin}.enemies: 每一项都需要 code`)
        const count = entry.count === 'investigators' ? state.numInvestigators
          : entry.count === 'investigators-1' ? state.numInvestigators - 1
            : Number(entry.count ?? 1)
        const spots = entry.at || []
        for (let index = 0; index < count && index < spots.length; index++) {
          const enemy = api.spawnEnemy(state, entry.code, spots[index], entry.engage ?? null)
          if (!enemy) continue
          if (entry.exhausted) enemy.exhausted = true
          api.info(state, events, `👹 「${enemy.name}」生成于「${api.locName(state, spots[index])}」。`)
        }
      }
    },
  }
}

// 遭遇牌库的结构性修改：移除开局已生成的敌人、随机加入一组「使者组」。
function buildModifyDeck(spec, origin) {
  if (spec == null) return {}
  assertKeys(spec, new Set(['removeSpawnedEnemies', 'addAgentSet', 'addSurvivingPriest']), `${origin}.deck`)
  return {
    modifyDeck(state, deck, events, api) {
      let next = deck
      if (spec.removeSpawnedEnemies) {
        for (const enemy of state.enemies) {
          if (!api.removeCardByCode(next, enemy.code)) throw new Error(`开局敌人不在遭遇牌组中：${enemy.code}`)
        }
      }
      if (spec.addAgentSet) {
        const keys = Object.keys(state.scenario.agentSets || {})
        if (keys.length) {
          const key = keys[Math.floor(api.randomValue(state) * keys.length)]
          api.info(state, events, `🎲 随机使者组：${key}。`)
          next = next.concat(state.scenario.agentSets[key])
        }
      }
      if (spec.addSurvivingPriest && state.campaign.records.ghoulPriestAlive) {
        next = next.concat(['ghoulPriest'])
        api.info(state, events, '👹 食尸鬼祭司仍存活，被洗入遭遇牌库。')
      }
      return next
    },
  }
}

export function declareScenario(declaration) {
  if (!declaration || typeof declaration !== 'object') throw new Error('关卡声明必须是对象')
  assertKeys(declaration, DECLARATION_KEYS, '关卡声明')
  const { id, setup = {}, data = {}, hooks = {} } = declaration
  if (typeof id !== 'string' || !id) throw new Error('关卡声明缺少 id')
  assertKeys(setup, SETUP_KEYS, `${id}.setup`)
  for (const key of Object.keys(hooks)) {
    if (RESERVED_HOOKS.has(key)) throw new Error(`${id}: ${key} 由 setup 声明生成，不能在 hooks 里重复定义`)
  }
  const built = {
    id,
    ...data,
    ...buildStartLocation(setup.startLocation, `${id}.setup`),
    ...buildSetupLocations(setup.locations, `${id}.setup`),
    ...buildSetupEnemies(setup.enemies, `${id}.setup`),
    ...buildModifyDeck(setup.deck, `${id}.setup`),
    ...(setup.startRevealed === undefined ? {} : { locationsStartRevealed: setup.startRevealed }),
    // 第 2 步 P2.6：无牌组故事调查员的选择配置（形状由 story-investigators.js 校验）。
    ...(setup.storyInvestigators === undefined ? {} : { storyInvestigators: setup.storyInvestigators }),
    ...hooks,
  }
  return Object.freeze(built)
}

// 声明覆盖率（审计用）：一个 behavior 对象里哪些钩子来自声明、哪些还是脚本。
export function declarationReport(behavior) {
  const declared = ['startLocation', 'setupLocations', 'setupEnemies', 'modifyDeck', 'locationsStartRevealed']
  const functions = Object.keys(behavior).filter(key => typeof behavior[key] === 'function' && !declared.includes(key))
  return {
    id: behavior.id || null,
    declared: declared.filter(key => behavior[key] !== undefined),
    hooks: functions.sort(),
  }
}
