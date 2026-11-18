// 10046 控制变量（Control Variable）· 探寻者事件 · 1 资源 · [[洞见]]/[[科学]]/[[诅咒]]
// 卡面：
//   快速。有调查员在你地点的技能检定期间揭示了 [curse] 标记后打出。
//   发现你所在地点的 1 个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 快速 + 固定时机 = played 描述子 `fast: true` + trigger 'chaosTokenRevealed'
//     （P2-4 快速事件统一通道：候选出口 encounter.js#reactionWindow，执行器 assets.js#playReactionCard；
//     窗口由 tests.js 在每次揭示标记后开，context = { when, seat, location, token, tokenIndex }）。
//   · 「[curse] 标记」= context.token === 'curse'（祝福/诅咒标记的结算口径在 chaos-token-effects.js）。
//   · 「你地点的技能检定」= context.location === 控制器所在地点（reactionWindow 的旧式
//     anyLocation 过滤只认对象形条件，因此这条判定写在 criteria 里）。
//   · 「发现 1 个线索」= api.discoverClue（discoverClueAt 的唯一内容层入口，自动截断到地点剩余线索）。
export default {
  code: '10046',
  name: '控制变量',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'chaosTokenRevealed',
      id: 'controlVariableDiscover',
      label: '快速：你地点的检定揭示 [curse] 标记后，发现你所在地点的 1 个线索',
      // 窗口本身只在技能检定的标记揭示时开（tests.js），因此这里只核对标记与地点。
      criteria: [
        ({ inv, context }) => context?.token === 'curse' && context.location === inv.location,
      ],
      resolve: ({ inv, api }) => {
        api.discoverClue(inv.seat, 1, inv.location)
        api.info(`🧫 「控制变量」：${inv.name} 发现所在地点的 1 个线索。`)
      },
    },
  ],
  modifiers: [],
}
