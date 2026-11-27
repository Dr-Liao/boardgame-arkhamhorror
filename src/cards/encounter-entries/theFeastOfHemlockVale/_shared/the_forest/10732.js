// 10732 毒花（Poisonblossom）· 敌人 · 共享遭遇组 the_forest（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_forest（theThingInTheDepths 的遭遇牌库把本组整组洗入）。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Retaliate.
//   (Day [day]) Poisonblossom gets +1 health and +1 damage value for each overgrowth on it.
//   (Night [night]) Poisonblossom gets +1 fight and +1 damage value for each overgrowth on it.
//   Forced - At the end of the round: Place 1 resource on Poisonblossom, as overgrowth.
//
// 读点（声明即接线）：
//   · 「反击」：各章 definition 的 encounterDefinitions（content/campaigns/theFeastOfHemlockVale/card-data.js）
//     从英文正文解析关键词，条目不再重复声明。
//   · 「一轮结束时放置 1 个疯长」= 条目的 forced 描述子，trigger 'roundEnds'
//     （读点：src/engine/phases.js#upkeepPhase 的 openAbilityWindow('roundEnds')；非玩家实体的窗口
//     来源枚举见 src/engine/ability-rules.js#nonPlayerAbilitySources）。
//   · 疯长计数 = 引擎的通用资源标记载体 api.scenario.addMarker（scenario-runtime.js；与 05239/05241/05242
//     同一份 `markers` 载体，不新造状态字段）；展示登记在
//     web/table-components.js#LABEL_MARKER_DISPLAY 的 overgrowth 条目（展示契约用例覆盖），
//     因此这里不再重复声明只描述机制、没有读点的 flags。
//   · 按每个疯长成长 = api.scenario.addEnemyStatModifier（读点：src/engine/enemies.js#runtimeEnemyStat
//     的 fight / health 分支；每轮末正好新增 1 个疯长，因此每轮 +1 与「每个疯长 +1」等价）。
//   · 昼夜 = src/engine/matcher.js#duringPeriod（读点 src/engine/scenario-calendar.js#scenarioPeriod）；
//     章节没有声明 mechanics.calendar 时回落到战役日志的 records.time（战役层 flow/interludes 同步写入，
//     与 theThingInTheDepths 等章 behavior 读的同一份记录）。
import { duringPeriod } from '../../../../../engine/matcher.js'
import { markerLabelsOf } from '../../../_shared.js'

const CODE = '10732'
const NAME = '毒花'
const MARKER = 'overgrowth'

// 当前昼夜：日历原语优先，其次战役日志（'day' / 'Night' 两种写法都认）。
function periodOf(state, source, inv) {
  const ctx = { state, source, inv, context: {} }
  if (duringPeriod('day')(ctx)) return 'day'
  if (duringPeriod('night')(ctx)) return 'night'
  const raw = state?.campaign?.records?.time ?? state?.campaign?.records?.timeOfDay
  const word = String(raw || '').toLowerCase()
  if (word.includes('night')) return 'night'
  if (word.includes('day')) return 'day'
  return null
}

// 一轮结束时：放置 1 个疯长（资源），并按当前昼夜给对应数值 +1（每个疯长 +1）。
function growOvergrowth(state, source, inv, api) {
  api.scenario.addMarker(source, MARKER)
  const period = periodOf(state, source, inv)
  if (period === 'night') {
    api.scenario.addEnemyStatModifier(source, { fight: 1 })
    api.info?.(`🌸 「${NAME}」轮末放置 1 个疯长（黑夜：攻击值 +1）。`)
    return
  }
  if (period === 'day') {
    api.scenario.addEnemyStatModifier(source, { health: 1 })
    api.info?.(`🌸 「${NAME}」轮末放置 1 个疯长（白日：生命值 +1）。`)
    return
  }
  api.info?.(`🌸 「${NAME}」轮末放置 1 个疯长（当前昼夜未知：本次不加数值）。`)
}

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    attackDamageBonus: (state, enemy) => periodOf(state, enemy)
      ? markerLabelsOf(enemy).filter(marker => marker === MARKER).length : 0,
  },
  flags: {
    encounterGroup: 'the_forest',
    quantity: 2,
    traits: ['Creature', 'Flora', 'Mutated'],
    keywords: ['retaliate'],
    printedFight: 2,
    printedEvade: 1,
    printedHealth: 3,
    printedDamage: 0,
    printedHorror: 1,
    printedVictory: 0,
  },
  abilities: [{
    kind: 'forced',
    trigger: 'roundEnds',
    silent: true,
    label: '一轮结束时：在毒花上放置 1 个资源，作为疯长（按昼夜成长）',
    resolve: ({ state, source, inv, api }) => growOvergrowth(state, source, inv, api),
  }],
  note: '轮末疯长提高对应昼夜数值。发起攻击时，伤害值按身上当前疯长数计算。',
}
