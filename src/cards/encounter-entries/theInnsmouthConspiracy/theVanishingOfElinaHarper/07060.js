// 07060 寻找哈珀特工（The Search for Agent Harper）· 场景 1 · 艾莲娜·哈珀失踪案（TIC 第二章）
//
// 印刷（中文）：
//   [free]调查员共同花费X[per_investigator]个线索：谈判。揭示迹象牌堆顶的X张卡牌(最多为3)并抽取其中1张。
//   将其余卡牌和遭遇牌库顶的卡牌一起混洗入迹象牌堆。(团队每轮仅限一次。)
//   目标 - 当任意一轮结束时，你可以推进。(提示：你将在推进时发起指控。在你确信自己已经缩小了范围，
//   足够找到哈珀特工的绑架者和藏身处时推进。)
// 印刷（英文）：
//   [fast] The investigators spend X [per_investigator] clues, as a group: Parley. Reveal the top X cards
//   of the Leads deck (to a maximum of 3) and draw 1 of them. Shuffle the rest back into the Leads deck,
//   along with the top card of the encounter deck. (Group limit once per round.)
//   Objective - You may advance at the end of any round. (Hint: You will have to make an accusation when
//   you advance. Advance when you believe you have narrowed down Agent Harper's kidnapper and whereabouts.)
//
// 读点 / 内容接线（详细契约见 artifacts/migration/tic/p7/workers/w6/harper-report.md）：
//   · actRule.objective：函数恒 false —— 印刷是「可以推进」的可选目标，引擎不自动推进
//     （act-agenda.js#checkAct 的条目函数分支只读返回值；返回 false 即不推进）。
//   · actRule.roundEndCheck：轮末可选推进。内容层在 content/.../entry-rules.js 的
//     `roundEnded(state, api)` 里分派（引擎 phases.js 调 scenarioBehavior.roundEnded）：
//       registeredEntry(act?.originalCode || act?.code)?.actRule?.roundEndCheck?.(state, act, api)
//   · actRule.onReveal（背面「阅读冒险幕间：指控」）：调 api.scenario.resolveScenarioEvent('ticHarperAccusation')；
//     事件处理器在 content/.../entry-rules.js 的 `events` 里（选择嫌疑/窝点、正确数分支、装入营救幕 07061）。
//   · abilities（团队每轮一次的 [fast] 谈判）：读点 = parley.js#parleyMovesFor（当前幕实体参与枚举）
//     → ability-exec#executeDescriptor（kind:'free' 自动 action:false）；
//     费用 = api.scenario.payGroupClues(X × 人数)（scenario-runtime.js 的团队线索支付）；
//     X 的「先选 X 再付费」现有 cost.groupClues 不支持动态 X，故在 resolve 内手动选择 + 支付。
//     **抽取必须走真实遭遇结算管线**：`scenarioDecks.revealChooseDraw('leads', seat, X,
//     { mixEncounterTop: true })` —— 揭示 → 选择 1 张 → `deps.drawCard` 把它压进遭遇牌库顶再
//     `drawEncounter` 结算（嫌疑敌人按 `enemyRule.revelationSpawn` 显现、藏身地点按
//     `encounterResolve = putRevealedPrintedLocation` 入场），其余牌 + 遭遇库顶洗回迹象牌堆。
//     修复前用 `peek + take + put` 降级链路，抽到的卡只写进无人读取的 `harperDrawnLeads`
//     记账、从不入场，10 张迹象的真实效果全部不可达（审计 H1）。
function emitScenarioEvent(api, id, payload) {
  const target = api?.scenario && typeof api.scenario.resolveScenarioEvent === 'function' ? api.scenario : api
  const resolve = target?.resolveScenarioEvent
  if (typeof resolve !== 'function') return false
  try {
    resolve.call(target, id, payload)
    return true
  } catch (error) {
    if (/Unknown scenario event/.test(String(error?.message))) {
      target.info?.(`⚠️ 内容层尚未接线场景事件 ${id}：本次只记录，指控流程待 Lead 接线（见 harper-report.md）。`)
      return false
    }
    throw error
  }
}

const LEAD_SEAT = state => state.campaign?.leadSeat ?? 0

function choiceOf(api, spec) {
  return api.choose ? api.choose(spec) : api.choice(spec)
}

export default {
  code: '07060', scope: 'act', implemented: true,
  actRule: {
    // 印刷「任意轮结束时，你可以推进」：可选目标，引擎不自动推进。
    objective() { return false },

    // 轮末可选推进（内容层 roundEnded 分派到本函数；未接线时本函数不会被调用）。
    roundEndCheck(state, act, api) {
      const answer = choiceOf(api, {
        kind: 'story', seat: LEAD_SEAT(state), source: '07060', canSkip: true,
        prompt: '任意一轮结束时：是否发起指控并推进场景？（推进时必须进行指控）',
        options: [{ id: 'skip', label: '暂不推进' }, { id: 'advance', label: '发起指控并推进' }],
      })
      if (answer !== 'advance') return false
      api.advanceAct()
      return true
    },

    // 背面：阅读冒险幕间「指控」，由内容层事件处理器完成全部指控流程。
    onReveal(state, act, api) {
      emitScenarioEvent(api, 'ticHarperAccusation', {
        actCode: '07060', actId: act?.id ?? null, scenarioId: state.scenario?.id ?? null,
      })
    },
  },
  abilities: [{
    // [fast] 团队每轮一次：共同花费 X[每调查员]线索（谈判），查看迹象牌顶 X 张（最多 3）并抽取 1 张，
    // 其余与遭遇牌库顶一起洗回迹象牌堆。
    kind: 'free', actionKind: 'parley', range: 'anywhere',
    label: '谈判：团队花费 X[每调查员]线索，查看迹象牌顶 X 张并抽取 1 张',
    limit: { scope: 'perRound', owner: 'group' },
    // 「预览 = 校验 = 扣费」：团队线索不足 X=1 或迹象牌堆为空时不出现在合法行动里。
    criteria: ({ state }) => {
      const deck = state.scenarioFlags?.mechanics?.scenarioDecks?.leads?.deck
      return Array.isArray(deck) && deck.length > 0 && (state.clues || 0) >= state.numInvestigators
    },
    resolve({ state, inv, api }) {
      const decks = api.mechanics?.scenarioDecks
      if (!decks) return
      const perInvestigator = state.numInvestigators
      const deckSize = decks.size('leads')
      // X 的上限：印刷最大 3；本局实际能付 X×人数；牌堆里也得有 X 张。
      const max = Math.min(3, deckSize, Math.floor((state.clues || 0) / perInvestigator))
      if (max < 1) {
        api.info('团队线索不足以查看迹象牌堆（需要每位调查员 1 个线索）。')
        return
      }
      const picked = max === 1 ? 1 : Number(choiceOf(api, {
        kind: 'effect', seat: inv.seat, source: '07060',
        prompt: `团队共同花费 X[每调查员]个线索：选择 X（最多 ${max}）。`,
        options: Array.from({ length: max }, (_, index) => ({
          id: String(index + 1), label: `X=${index + 1}（共 ${(index + 1) * perInvestigator} 个线索）`,
        })),
      }))
      if (!Number.isInteger(picked) || picked < 1 || picked > max) return
      const paid = api.scenario?.payGroupClues?.(picked * perInvestigator)
      if (!paid || paid.paid !== picked * perInvestigator) return
      // 真实遭遇结算管线：揭示 → 选 1 张抽取（嫌疑显现 / 藏身地点入场）→ 其余 + 遭遇顶洗回牌堆。
      const drawn = decks.revealChooseDraw('leads', inv.seat, picked, { mixEncounterTop: true })
      if (!drawn) return
      api.info(`🕵️ 查看迹象牌顶 ${picked} 张，取得「${api.cardName(drawn) || drawn}」。`)
    },
  }],
}
