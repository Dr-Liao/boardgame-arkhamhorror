// 09015 达雷尔·西蒙斯（Darrell Simmons）· 幸存者 · 记者
// 卡面：
//   你以「达雷尔的柯达相机」在场开始游戏。
//   [free] 在你地点的技能检定期间，从你控制的一张支援上花费 1 个证据：
//     本次检定的难度降低 2。（每次检定仅限一次）
//   [elder_sign] 效果：+1。在你控制的一张支援上放置 1 个证据。
//
// 读点（卡面 → 引擎读点）：
//   · 开局柯达在场：条目 `investigator.startsWith = ['09016']`（setup.js 开局带入签名卡）。
//   · 检定期 [free]：P1-6 修正。原实现写在 `investigator.freeAction` 上，但检定窗口
//     （encounter.js#playerWindow → test.beforeCommit / test.afterCommit）只枚举「场上支援 /
//     调查员条目的 abilities 描述子」，不枚举 investigator.freeAction，因此能力永不出现。
//     改为 `kind:'free'` 描述子 + trigger ['test.beforeCommit','test.afterCommit']
//     （读点 ability-rules.js#descriptorUsable 按 timingWindow 过滤，encounter.js#doFreeDescriptor
//     执行），与 09099「便携万能工具」同一套检定期 fast 读点。
//   · 「你地点的技能检定」：用 criteria 比较「本次检定执行者所在地点」与达雷尔所在地点，
//     不限定本人执行（卡面允许作用于同地点他人的检定）。
//   · 花费 1 证据：api.addCardCounter(card, 'evidence', -1)（card-counters.js 的具名计数器；
//     不写 null 目标——旧实现用 api.moveCardCounters(card, null, ...) 在 card-counters.js:73
//     因「无目标卡」直接返回 0，永远不扣证据）。
//   · 难度 -2：api.reduceTestDifficulty（tests.js 在判定前统一扣减 skillTest.difficultyReduction）。
//   · 每次检定限一次：limit { scope:'perTest' }（limits.js）。
//     引擎缺口：perTest 键只在 `scenario.eventWindowInstances` 开启时用 skillTest.id
//     （tests.js:177，目前只有《暗中交易》开）；其余 TSK 章节退化为 round:turnSerial，
//     同一回合的第二次检定会被误判为同一次。已在汇报中列给主进程。
//   · 旧印 +1 放证据：条目 elderSign.resolve 返回 delta 1，并把证据放到柯达（没有柯达时放第一张支援）。
//
// 近似：他人执行、与达雷尔同地点的检定，beforeCommit 窗口只对检定执行者开（tests.js 传
// restrictedSeat），达雷尔只有在「已请求帮助」的 afterCommit 窗口才会被询问——窗口参与座位
// 属于引擎读点，已列给主进程；单人/本人检定时行为与卡面一致。
const KODAK = '09016'
const evidenceOf = asset => Number(asset?.markers?.evidence) || 0
const evidenceSources = inv => (inv.assets || []).filter(asset => evidenceOf(asset) > 0)

// 卡面「在你地点的技能检定期间」：本次检定执行者所在地点 = 达雷尔所在地点（不必达雷尔本人执行）。
const testAtLocation = (state, inv) => {
  const performer = state.investigators?.[state.skillTest?.seat]
  return Boolean(state.skillTest) && Boolean(performer) && performer.location === inv.location
}

export default {
  code: '09015',
  note: 'approximation: 他人执行的同地点检定经 flags.testWindowObserver 参与 test.beforeCommit / afterCommit 窗口（P1-6 引擎读点已接线）；perTest 上限随 skillTest.id 唯一化。',
  kind: 'investigator',
  // 2026-11-13 P1-6：「在你的地点的技能检定期间」——允许该调查员的免费能力出现在同地点
  // 他人检定的 test.beforeCommit / afterCommit 窗口（引擎读点 tests.js#testWindowSeats）。
  flags: { testWindowObserver: true },
  investigator: {
    elderSign: { bonus: 1 },
    startsWith: [KODAK],
  },
  elderSign: {
    id: '09015-eldersign',
    label: '达雷尔旧印：+1；在你控制的一张支援上放置 1 个证据',
    resolve: ({ inv, api }) => {
      const assets = inv.assets || []
      const target = assets.find(asset => asset.code === KODAK) || assets[0]
      if (target) api.addCardCounter(target, 'evidence', 1)
      return { delta: 1 }
    },
  },
  abilities: [
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      // 每次检定限一次：limit 读点见 limits.js；TSK 章节 perTest 键的退化已披露在文件头。
      limit: { scope: 'perTest', owner: 'instance' },
      label: '你地点的技能检定期间花费 1 个支援上的证据：本次检定难度 -2（每次检定限一次）',
      cost: { action: false },
      criteria: [({ state, inv }) => testAtLocation(state, inv) && evidenceSources(inv).length > 0],
      resolve: ({ inv, api }) => {
        const sources = evidenceSources(inv)
        if (!sources.length) return
        const source = sources.length === 1 ? sources[0] : sources[Number(api.choice({
          kind: 'target', source: '09015', seat: inv.seat, prompt: '选择要花费证据的支援。',
          options: sources.map((asset, index) => ({ id: String(index), label: api.cardName(asset.code) })),
        }))]
        if (!source) return
        api.addCardCounter(source, 'evidence', -1)
        const difficulty = api.reduceTestDifficulty(2)
        api.info(`📷 达雷尔花费 1 个证据：本次检定难度 -2（当前 ${difficulty}）。`)
      },
    },
  ],
  modifiers: [],
}
