// 10009 亚历山德拉·佐兹（Alessandra Zorzi）· 游荡者（Rogue）· 漂泊者/社会名流
// 《铁杉谷盛宴》第九循环 · 7/7 · 意志 3 / 智力 4 / 战力 2 / 敏捷 4
//
// 卡面：
//   在你回合期间，你可以进行额外一次行动，该行动只能用于谈判。
//   [elder_sign] 效果：+2。如果你检定成功，选择你所在地点或已揭示的连接地点的一个非[[精英]]敌人。
//   自动躲避该敌人。
//
// 一条行为的读点（卡面 → 引擎）：
//   · 只能用于谈判的额外行动 → `investigator.restrictedAction = { kind: 'parley' }`：
//       turn.js#turnBeginningWindow 每回合调用 restrictedActionRule + grantRestrictedAction 授予额度；
//       'parley' 已在 restricted-actions.js#RESTRICTED_ACTION_FIELDS 登记（字段 parleyOnlyActions）；
//       扣费用读点是 table-decisions.js#restrictedKindOfMove（kind === 'parley' 且有额度 → 'parley'）
//       → dispatch.js 的 consumeRestrictedAction。普通行动不能花这份额度（同一读点返回 null）。
//   · 旧印 +2 → `investigator.elderSign.bonus = 2`（AI 预估读点 combat-odds.js#elderSignDelta）
//       + `elderSign.resolve` 返回 `{ delta: 2, onSuccess }`（唯一读点 turn-flow.js#elderSignEffect）。
//   · 「检定成功后自动躲避」→ 旧印描述子的 `onSuccess`（效果 DSL）：tests.js 在成败判定之后
//       `resolveEffect(... elderOnSuccess ...)`，因此这一段不能写在 resolve 里（那时还没掷骰）。
//       引擎的 `autoEvadeNonElite` 原语（card-ops.js#autoEvadeNonElite）只枚举**同地点**敌人，
//       与本卡的「你所在地点或已揭示的连接地点」不符；这里按卡面自行枚举候选，再用既有效果
//       原语 `evade`（`auto: true` → makeRuntime 的 autoEvade → enemies.js#autoEvadeEnemy，
//       只横置 + 脱离交战、不要求交战关系）逐目标结算。目标通过 `enemyId` 传入（effects.js
//       的 evade 分支走 card-ops.js#enemyForTarget 的 `id:` 通道），因此连接地点的敌人同样可用。
//       多个候选时用 `chooseOne` 让玩家选择（选择发生在检定结算后、仍是有效事务）。
//
// 缺口（已列给主进程）：`autoEvadeNonElite` 不接受「地点范围」参数（同地点 / 连接地点 / 任意地点），
// 因此连接地点的自动躲避只能由卡面自己枚举候选；如果后续出现第三张同类卡，应把「按地点范围的
// 自动躲避」并入效果原语。
const CODE = '10009'
const ELDER_SIGN_ID = `${CODE}-eldersign`

// 「你所在地点或已揭示的连接地点」：候选只收非精英、仍在场的敌人。
const nonEliteTargets = (state, inv) => {
  const here = (state.locations || []).find(location => location.id === inv.location)
  const revealed = (here?.connections || []).filter(id =>
    (state.locations || []).find(location => location.id === id)?.revealed === true)
  const spots = new Set([inv.location, ...revealed])
  return (state.enemies || []).filter(enemy => !enemy.elite && !enemy.defeated
    && !enemy.removedFromGame && spots.has(enemy.location))
}

const autoEvade = enemyId => ({ type: 'evade', enemyId, auto: true })

export default {
  code: CODE,
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 2 },
    // 回合开始的受限额外行动（见文件头的读点）。
    restrictedAction: { kind: 'parley' },
  },
  elderSign: {
    id: ELDER_SIGN_ID,
    label: '亚历山德拉旧印：+2；若检定成功，自动躲避你所在地点或已揭示连接地点的一个非精英敌人',
    resolve: ({ state, inv }) => {
      const targets = nonEliteTargets(state, inv)
      if (!targets.length) return { delta: 2 }
      if (targets.length === 1) return { delta: 2, onSuccess: autoEvade(targets[0].id) }
      return {
        delta: 2,
        onSuccess: {
          type: 'chooseOne',
          source: ELDER_SIGN_ID,
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name, effect: autoEvade(enemy.id) })),
        },
      }
    },
  },
  abilities: [],
  modifiers: [],
}
