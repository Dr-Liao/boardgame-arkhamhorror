// 07238 深海信徒（Worshippers of the Deep）· 场景 3 · 雾中之光 第六章
//
// 印刷要点：
//   · 强制 - 在调查阶段结束时：每位在完全淹没地点的调查员必须选择受到 3 点伤害，
//     或移动到其正下方的地点。
//   · 目标 - 如果所有未被击败的调查员都撤退，推进场景。
//   · 背面（推进时）：若至少 1 位调查员是从月之室撤退的 →（→R1）；若所有撤退者都是从
//     猎鹰岬门房撤退的 →（→R2）。
//
// 引擎读点：
//   · 条目 abilities 的 forced + trigger 'investigationPhaseEnds'：windows.js 注册、
//     turn.js#runBetweenInvestigationPhases 开窗；ability-rules.js#nonPlayerAbilitySources 会把
//     **当前幕实体**纳入来源（按实体实例去重），因此只在 07238 为当前幕时结算。
//     完全淹没 = api.water.effectiveLevel(seat) === 2（flood.js FLOOD_LEVELS.full；描述子 api 是 abilityApi，
//     原语在顶层）；
//     「正下方的地点」= api.map.position + api.map.locations({row,column})，移动走 api.scenario.moveInvestigator。
//   · actRule.objective(state)：act-agenda.js#checkAct 在每次行动结算后读（TIC behavior 没有
//     checkObjectives，因此走 actRule.objective 函数分支），满足即 api.advanceAct。
//   · actRule.allResigned(state, act, api)：content entry-rules.js 的 allResigned 数据驱动分派
//     （doResign → scenarioBehavior.allResigned → 本钩子）；最后一名调查员撤退时先推进本幕，
//     由 onReveal 结束剧本，避免引擎 checkOutcome 抢先落到 noResolution（R3/R4）。
//   · onReveal → api.finish('resolution1'|'resolution2')，与 content resolutions.js 的
//     aLightInTheFog 分支一致；R1/R2 判定读 scenarioFlags.resignedInMoonRoom（07249 写入）。
const objectiveMet = state => state.investigators.some(inv => !inv.defeated)
  && state.investigators.every(inv => inv.defeated || inv.resigned)

export default {
  code: '07238', scope: 'act', implemented: true,
  actRule: {
    objective(state, act, api) {
      return objectiveMet(state)
    },
    allResigned(state, act, api) {
      if (!objectiveMet(state)) return false
      api.advanceAct()
      return true
    },
    onReveal(state, act, api) {
      const resignedInMoonRoom = state.scenarioFlags?.resignedInMoonRoom || []
      api.finish(resignedInMoonRoom.length ? 'resolution1' : 'resolution2')
    },
  },
  abilities: [{
    kind: 'forced', trigger: 'investigationPhaseEnds',
    limit: { scope: 'perWindow', owner: 'instance' },
    label: '调查阶段结束：完全淹没地点的调查员受到3点伤害，或移动到其正下方地点',
    resolve: ({ state, api }) => {
      for (const current of [...state.investigators]) {
        if (current.defeated || current.resigned) continue
        if (api.water.effectiveLevel(current.seat) !== 2) continue
        const position = api.map.position(current.location)
        const below = position && Number.isFinite(position.y)
          ? api.map.locations({ row: position.y - 1, column: position.x })[0] || null
          : null
        const options = [{ id: 'damage', label: '受到 3 点伤害' }]
        if (below) options.push({ id: 'move', label: `移动到正下方的「${below.name || below.id}」` })
        const choice = options.length === 1 ? 'damage' : api.choice({
          kind: 'effect', source: '07238', seat: current.seat,
          prompt: '完全淹没的地点：受到 3 点伤害，或移动到其正下方的地点。', options,
        })
        if (choice === 'move') {
          api.scenario.moveInvestigator(current.seat, below.id)
          const moved = state.investigators[current.seat]
          if (moved && !moved.defeated && !moved.resigned && moved.location === below.id) continue
          api.info?.(`「${below.name || below.id}」无法进入，改为受到 3 点伤害。`)
        }
        api.damage(current.seat, 3)
      }
    },
  }],
}
