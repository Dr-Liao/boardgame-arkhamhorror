// TIC（《印斯茅斯暗潮》）P8 行为级 replay recipe 清单。
//
// 与 tools/replay-games.mjs#REPLAY_RECIPES 分开存放是刻意的：REPLAY_RECIPES 被
// tests/fixtures/replay/golden-replays.json 锁死（13 局 ids + hashes + steps 同时被
// tools/scan-tde-scope.mjs、artifacts/migration/tcu/scope.json、
// audit/tde-replay-completion-review.json、audit/baseline.json#goldenReplay 与
// tests/replay-golden*.test.mjs 交叉引用）。往里加 TIC 条目会要求重写其它战役的冻结证据，
// 因此 TIC 用独立清单 + 独立基线 tests/fixtures/replay/tic-p8-baseline.json，
// 由 tools/replay-tic-fixtures.mjs 采集，`node tools/replay-fixtures.mjs --compare`
// 与 `node tools/replay-tic-fixtures.mjs --check` 校验。
//
// driver `tic`（tools/replay-games.mjs#playTic）的语义：
//   · 先走真实大厅合法动作完成局外准备（含逐席位选人/自动构筑/确认）；
//   · 从第 1 章起逐章开局，未到 target 章时用调试结算原语立刻结束该章，再经
//     hubContinue/幕间窗口推进；到达 target 章后交给 generic 策略走 targetSteps 步；
//   · targetSteps 之后停在目标章里（若目标章提前结算则停在 scenarioResult/interlude）。
//
// 覆盖口径：8 章各一条（chapter ladder：第 N 条从第 1 章爬到第 N 章），
// 4 难度各一条（覆盖四种混乱袋），1 条失败路线（theVanishingOfElinaHarper 失败结局）。
export const TIC_CAMPAIGN_ID = 'theInnsmouthConspiracy'

// 章节顺序与 content/campaigns/theInnsmouthConspiracy/shared.js#chapters 一致。
export const TIC_CHAPTER_IDS = Object.freeze([
  'thePitOfDespair', 'theVanishingOfElinaHarper', 'inTooDeep', 'devilReef',
  'horrorInHighGear', 'aLightInTheFog', 'theLairOfDagon', 'intoTheMaelstrom',
])

const PLAYERS = 2
const SEAT_INVESTIGATORS = Object.freeze(['07001', '07002'])
// 两个真人席位都点名 TIC 调查员；0 号位是真人，1 号位为 AI（大厅自动准备的同一路径）。
const baseSettings = (difficulty = 'standard') => Object.freeze({
  campaignId: TIC_CAMPAIGN_ID, playerInvestigator: '07001',
  seatInvestigators: SEAT_INVESTIGATORS, difficulty,
})

// 章节阶梯：第 N 条从第 1 章爬到第 N 章，再在目标章里走 targetSteps 步。
// 目标章步数控制在 40（末章 50）：generic 场景策略是"会推进但不会保命"的粗糙策略，
// 40 步足以覆盖该章的地图/遭遇/剧本行动，又不会让基线在已死的队伍上空转。
const chapterRecipes = TIC_CHAPTER_IDS.map((scenarioId, index) => Object.freeze({
  id: `tic-${scenarioId}-hub`,
  note: `《印斯茅斯暗潮》P8 章节阶梯 #${index + 1}：局外准备 → 第 1..${index + 1} 章流程（前 ${index} 章调试结算以覆盖幕间/记录继承）→ 在「${scenarioId}」内走 ${index === 7 ? 50 : 40} 步`,
  driver: 'tic', seed: 'tic-p8-ladder', players: PLAYERS,
  target: scenarioId, targetSteps: index === 7 ? 50 : 40,
  // 上限只作安全阀（阶梯 + 目标章），实际步数见基线文件。
  steps: 110 + index * 16,
  settings: baseSettings(index === 1 || index === 4 ? 'easy' : 'standard'),
}))

// 4 难度：同一章节（第 1 章）四种混乱袋；seed 共用，便于横向比较同一条路径的检定差额。
const difficultyRecipes = ['easy', 'standard', 'hard', 'expert'].map(difficulty => Object.freeze({
  id: `tic-difficulty-${difficulty}-hub`,
  note: `《印斯茅斯暗潮》P8 难度覆盖（${difficulty}）：局外准备 →「thePitOfDespair」内走 35 步，覆盖该难度的混乱袋与符号标记结算`,
  driver: 'tic', seed: 'tic-p8-ladder', players: PLAYERS,
  target: 'thePitOfDespair', targetSteps: 35, steps: 110,
  settings: baseSettings(difficulty),
}))

// 失败路线：第 2 章先走 20 步，再用失败结局 resolution1（The Mission Failed）结算，
// 让 fixture 停在失败结算形态（scenarioResult），覆盖失败分支的记录/后续。
const failureRecipe = Object.freeze({
  id: 'tic-failure-theVanishingOfElinaHarper-hub',
  note: '《印斯茅斯暗潮》P8 失败路线：阶梯到第 2 章，走 20 步后用失败结局 resolution1（The Mission Failed）结算',
  driver: 'tic', seed: 'tic-p8-ladder', players: PLAYERS,
  target: 'theVanishingOfElinaHarper', targetSteps: 20, failureResolution: 'resolution1', steps: 130,
  settings: baseSettings('standard'),
})

export const TIC_REPLAY_RECIPES = Object.freeze([
  ...chapterRecipes, ...difficultyRecipes, failureRecipe,
])

// 采集/校验时用来核对「8 章各有一条 recipe」的覆盖表：章节 id → recipe id。
export const TIC_CHAPTER_RECIPE_IDS = Object.freeze(Object.fromEntries(
  TIC_CHAPTER_IDS.map((scenarioId, index) => [scenarioId, chapterRecipes[index].id])))

export const TIC_DIFFICULTIES = Object.freeze(['easy', 'standard', 'hard', 'expert'])
