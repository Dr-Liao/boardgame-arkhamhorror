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
//   · 「马什 + 蓝钥匙 + 尽腥尽力 + 灯塔地下室」与 07232b 是同一句印刷块，共用
//     _shared.js#bringMarshAndLighthouseBasement；本卡只声明「横置生成」。
//   · 「直接推进到 2a（不结算 1b）」走 api.scenario.advanceAgendaTo(index)（act-agenda.js：
//     不调用 runAgendaReveal、不清场上的毁灭）。

import { bringMarshAndLighthouseBasement, originalOf } from '../../_shared.js'

const NEXT_AGENDA = '07233' // agenda 2a：不变如海

// P7 读点：api.scenario.advanceAgendaTo(index) —— 跳过当前密谋背面、直接推进到目标议程正面。
// onReveal 收到 scenarioRuntime（原语在顶层），描述子 resolve 收到 abilityApi（原语在 api.scenario 下），
// 因此两种 api 面都探测。
function advanceAgendaDirectly(state, api, code) {
  const index = (state.agendas || []).findIndex(agenda => String(originalOf(agenda)) === code)
  if (index < 0) return false
  const runtime = api.scenario || api
  return runtime.advanceAgendaTo(index) === true
}

export default {
  code: '07236', scope: 'act', implemented: true,
  actRule: {
    onReveal(state, act, api) {
      bringMarshAndLighthouseBasement(state, api, { exhausted: true })
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
