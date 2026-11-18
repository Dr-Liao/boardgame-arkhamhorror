// 10011 萨马科纳（Zamacona）· 中立（Neutral）敌人 · 独特 · 类人/罪犯 · 亚历山德拉·佐兹专属弱点
//
// 卡面：
//   逃逸。
//   生成 - 如可能，最近的无人地点。
//   亚历山德拉·佐兹不能与萨马科纳谈判。
//   强制 - 亚历山德拉·佐兹每轮第一次谈判时：在萨马科纳身上放置 1 个毁灭标记。
//
// 一条行为的读点（卡面 → 引擎）：
//   · 玩家牌库里的敌人型弱点 → `scope: 'enemy'` + resolveWeakness 的 `def.type === 'enemy'` 分支
//     （weakness.js 直接 spawnEnemy，无需 weakness 描述子；与 06025/09010 同形）。
//     数值/特性走 cards-data，bearerSeat 由 spawnEnemy 的 isWeaknessCode 分支写成抽到它的座位。
//   · 逃逸 → `enemyRule.elusive: true`：注册期校验（ability.js）、攻击后结算读点
//     enemy-keyword-movement.js#resolveElusiveAfterAttack（敌人阶段/攻击后的逃逸移动 + 横置）。
//   · 生成 - 最近的无人地点 → `enemySpawn` 窗口的强制能力：弱点生成时引擎先 spawnEnemy、
//     再开 enemySpawn 窗口、最后才交战（enemies.js#enterExistingEnemy），因此在这里把敌人移到
//     最近的无人地点（BFS 用 api.scenario.locationDistance，-1 = 不可达），移动后不再与该调查员交战。
//     「无人」= 没有未被击败/撤退的调查员（与 encounter.js 的 spawnAnyEmpty 同一口径）。
//   · 不能与萨马科纳谈判 → `modifiers: [{ target: 'cannot:parley' }]`：唯一读点
//     modifiers.js#entityRuleActive → parley.js#parleyForbidden（合法行动枚举 + 执行前校验共用）。
//   · 强制 - 每轮第一次谈判放 1 毁灭 → `actionResolvedAtLocation` 窗口（dispatch.js 在每次结算完的
//     行动后开窗）+ 条目级 `trackActionHistory` 记录的行动种类（action-history.js；
//     state.investigators[seat].actionHistory.entries 最后一项带 'parley' 即「刚刚谈判」）+
//     `limit: { scope: 'perRound', owner: 'instance' }`（limits.js 的每轮一次账本）。
//     毁灭写入走 api.placeDoomOnCard（act-agenda.js#placeDoomOnCard 唯一写点）。
//
// 缺口（已列给主进程）：
//   1. 引擎没有「谈判结算后」的窗口：`actionResolvedAtLocation` 的 context 不带行动种类，
//      `actionTaken`（engine.js 的 P6 原语，context 带 actionKind/actionKinds）只在
//      performImmediateAction 等直接调用导出 executeAction 的路径上开窗，普通 applyMove 不经过它。
//      本卡因此用 trackActionHistory 的行动种类记录补这个读点；它依赖「抽到本卡的调查员的
//      战役牌组记录里仍有 10011」——真实战役里签名弱点常驻 record.deck，但若某个存档把
//      10011 从 record.deck 里移除，则记录不再产生、本强制不触发。
//      需要的原语：`parleyResolved` 窗口（或 actionResolvedAtLocation 的 context.actionKind）。
//   2. 「不能与萨马科纳谈判」的读点是**按实体**判定的（parley.js#parleyForbidden(state, inv, entity)），
//      因此哄骗（10010）挂在萨马科纳身上的「附属卡谈判」不会被拦（entity 是附属实例而不是敌人）。
//      需要按「所附属敌人」判定的谈判禁用读点。
//   3. 玩家卡附属（10010）在敌人离场时不会被清理（见 10010.js 的文件头缺口 1）。
const CODE = '10011'

const activeInvestigators = state => (state.investigators || [])
  .filter(inv => !inv.defeated && !inv.resigned)

const emptyLocations = state => (state.locations || [])
  .filter(location => !location.dreamGate
    && !activeInvestigators(state).some(inv => inv.location === location.id))

// 最近一次结算的行动是否就是一次谈判（action-history.js 的记录；没有记录或记录不是本回合时为 false）。
const justParleyed = (state, inv) => {
  const history = inv?.actionHistory
  if (!history || history.turn !== state.turnSerial) return false
  const last = history.entries?.at(-1) || []
  return last.includes('parley')
}

export default {
  code: CODE,
  scope: 'enemy',
  // 让引擎为「持有本卡的调查员」记录行动种类（读点 action-history.js#tracksHistory）。
  trackActionHistory: true,
  enemyRule: { elusive: true },
  modifiers: [{ target: 'cannot:parley' }],
  abilities: [
    {
      kind: 'forced',
      trigger: 'enemySpawn',
      silent: true,
      label: '生成 - 如可能，最近的无人地点',
      criteria: [({ source, context }) => String(source?.originalCode || source?.code) === CODE
        && context?.enemy != null && context.enemy.id === source?.id],
      resolve: ({ state, source, api, seat }) => {
        const enemy = (state.enemies || []).find(item => item.id === source?.id)
        if (!enemy) return
        const pool = emptyLocations(state)
        if (!pool.length) {
          api.info('「萨马科纳」：场上没有无人地点，按普通规则生成。')
          return
        }
        const scored = pool.map(location => {
          const steps = api.scenario.locationDistance(enemy.location, [location.id])
          return { id: location.id, steps: steps < 0 ? Infinity : steps }
        }).filter(row => Number.isFinite(row.steps))
        if (!scored.length) return
        const nearest = Math.min(...scored.map(row => row.steps))
        const ties = scored.filter(row => row.steps === nearest).map(row => row.id)
        const destination = ties.length === 1 ? ties[0] : api.choice({
          kind: 'location', source: CODE, seat: Number.isInteger(seat) ? seat : (state.currentSeat ?? 0),
          prompt: '萨马科纳：选择最近的无人地点（并列）。',
          options: ties.map(id => ({ id, label: api.scenario.locationName(id) })),
        })
        if (!ties.includes(destination) || destination === enemy.location) return
        api.moveEnemy(enemy, destination)
        api.info(`👹 「${enemy.name}」生成于最近的无人地点「${api.scenario.locationName(destination)}」。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'actionResolvedAtLocation',
      silent: true,
      limit: { scope: 'perRound', owner: 'instance' },
      label: '强制 - 亚历山德拉每轮第一次谈判时：在萨马科纳身上放置 1 个毁灭标记',
      criteria: [({ state, inv, source, context }) => {
        if (String(source?.originalCode || source?.code) !== CODE) return false
        if (!state.enemies.includes(source)) return false
        if (!inv || inv.code !== '10009' || context?.seat !== inv.seat) return false
        return justParleyed(state, inv)
      }],
      resolve: ({ source, api }) => {
        api.placeDoomOnCard(source, 1)
        api.info(`🧿 「${source.name}」：亚历山德拉本轮第一次谈判，在其身上放置 1 个毁灭标记（当前 ${source.doom || 0}）。`)
      },
    },
  ],
}
