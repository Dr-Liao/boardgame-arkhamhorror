// 07236 灯塔（The Lighthouse）· 场景 1 · 雾中之光 第六章
//
// 印刷要点：
//   · 正面：目标 - 在密谋推进前共同花费所需数量的线索（参考实现 groupClueCost PerPlayer 3）。
//   · 背面（推进时）：生成放在一边的奥赛罗思·马什敌人到灯塔看门人小屋（横置），
//     把放在一边的蓝色钥匙放在其上；把每张放在一边的「尽腥尽力」洗入遭遇牌库；
//     把放在一边的灯塔地下室放到灯塔梯井正下方；直接推进密谋到 2a（不结算 1b）。
//
// 引擎读点：
//   · actRule.onReveal ← content entry-rules.actReveal（advanceAct 时调用；缺失会 throw）。
//   · 正面线索目标：content chapter-data 的 acts 没有 objective 数据，引擎原生「团队线索目标」
//     （state.acts[].objective）不存在；本卡用现有原语以条目 free 能力表达——
//     parleyMovesFor → doEntityAbility → executeDescriptor → payAbilityCost 的 groupClues 费用
//     （07128 团队线索能力同链路），scope 为幕实体、range:'anywhere' 才能被枚举。
//     后续转正方案见 artifacts/.../primitive-requests/p7-a2-act-clue-objective-data.json。
//   · api.takeFromSetAside('07253') + api.spawn(code, loc, { exhausted: true })（enemies.js spawnEnemy 支持 exhausted）。
//   · api.mechanics.keys.transfer('blue','setAside',`enemy:<id>`,{reveal:true})。
//   · api.shuffleIntoEncounterDeck 把放在一边的 07259 洗回遭遇牌库。
//   · api.mechanics.map.position/place 把灯塔地下室（07244，未揭示面名为 Lighthouse Basement）
//     放在灯塔梯井（07240）正下方，即同一列 row-1。
//   · 「直接推进到 2a（不结算 1b）」需要引擎原语 api.scenario.advanceAgendaTo（本批未落，
//     见 primitive-requests/p7-a2-skip-agenda-advance.json）：未接线时只登记信息、绝不调用
//     advanceAgenda（否则会错误结算未实现的 07232b 并 throw）。
import { originalOf } from '../../_shared.js'

const MARSH = '07253'
const COTTAGE = '07243'
const STAIRWELL = '07240'
const BASEMENT = '07244'
const WORTH_HIS_SALT = '07259'
const NEXT_AGENDA = '07233' // agenda 2a：不变如海

function locationByCode(state, code) {
  return state.locations.find(location => String(originalOf(location)) === code) || null
}

function definitionByCode(state, code) {
  return Object.values(state.scenario.locations || {})
    .find(definition => String(definition.originalCode || definition.code) === code) || null
}

// 把放在一边的地点放到 anchor 正下方（同一列、下一行）；没有 anchor 时用主线图示坐标。
function placeBelow(state, api, code, anchor, fallbackPosition) {
  const existing = locationByCode(state, code)
  if (existing) return existing
  const definition = definitionByCode(state, code)
  if (!definition) return null
  let position = fallbackPosition
  if (anchor) {
    const at = api.mechanics.map.position(anchor.id)
    if (at && Number.isFinite(at.x) && Number.isFinite(at.y)) position = { x: at.x, y: at.y - 1 }
  }
  api.mechanics.map.place(definition.id, position.x, position.y)
  return locationByCode(state, code)
}

// 缺口 P1：没有「跳过当前密谋背面、直接推进到下一张密谋正面」的原语。
// 兼容两种 api 面：onReveal 收到 scenarioRuntime（原语在顶层），描述子 resolve 收到 abilityApi
//（原语在 api.scenario 下）。
function advanceAgendaDirectly(state, api, code) {
  const index = (state.agendas || []).findIndex(agenda => String(originalOf(agenda)) === code)
  if (index < 0) return false
  const runtime = api.scenario || api
  if (typeof runtime.advanceAgendaTo === 'function') {
    runtime.advanceAgendaTo(index)
    return true
  }
  api.info?.(`⚠️ 「直接推进到议程 ${code} 正面（不结算当前密谋背面）」需要引擎原语 api.scenario.advanceAgendaTo；`
    + '已登记 primitive-requests，本次保持议程不动。')
  return false
}

export default {
  code: '07236', scope: 'act', implemented: true,
  actRule: {
    onReveal(state, act, api) {
      const cottage = locationByCode(state, COTTAGE)
      if (cottage) {
        api.takeFromSetAside(MARSH)
        const marsh = api.spawn(MARSH, cottage.id, { exhausted: true })
        if (marsh) api.mechanics.keys.transfer('blue', 'setAside', `enemy:${marsh.id}`, { reveal: true })
      } else {
        api.info?.('⚠️ 灯塔看门人小屋不在场，奥赛罗思·马什仍放在一边。')
      }
      const worthHisSalt = []
      while (api.takeFromSetAside(WORTH_HIS_SALT)) worthHisSalt.push(WORTH_HIS_SALT)
      if (worthHisSalt.length) api.shuffleIntoEncounterDeck(worthHisSalt, { shuffle: false })
      const stairwell = locationByCode(state, STAIRWELL)
      placeBelow(state, api, BASEMENT, stairwell, { x: 2, y: -1 })
      advanceAgendaDirectly(state, api, NEXT_AGENDA)
    },
  },
  abilities: [{
    // 印刷目标「在密谋推进前花费所需线索」：现有原语下的可玩实现（见文件头注释）。
    kind: 'free', actionKind: 'activate', range: 'anywhere', groupClueScope: 'anywhere',
    label: '目标：共同花费所需线索推进场景（每位调查员 3 个）',
    cost: { groupClues: ({ state }) => 3 * state.numInvestigators },
    resolve: ({ api }) => api.scenario.advanceAct(),
  }],
}
