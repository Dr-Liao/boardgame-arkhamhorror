// 10025 信仰指引（Guided by Faith）· 守卫者事件 · 2 资源 · 灵魂/祝福萦绕
// 卡面：调查。你本次调查可以不使用 [intellect]，改为使用 [willpower]。本次检定揭示混乱标记前，
//       在混乱袋中加入 2 个 [bless] 标记。如果本次检定期间揭示了 [bless] 或 [elder_sign] 标记，
//       发现你所在地点的额外 1 个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「调查。」：played 描述子 `countsAs: 'investigate'`（actionKind 读点：借机攻击提示/结算口径）。
//   · 技能替代：`api.investigate(seat, { skill: 'willpower' })`（runInvestigate 用
//     `opts.skill || ...` 覆盖调查技能；05158/05322 同一读点）。「可以不使用」= 先询问玩家。
//   · 「揭示标记前加入 2 个祝福」：`api.chaosTokens.add('bless', 2)`（标记池唯一写点）在检定开始前
//     结算；本卡没有其它「检定开始时」效果，因此与「揭示前」等价。
//   · 「揭示祝福/旧印则额外发现 1 线索」：检定结果契约 `result.drawn`（B3）判断标记面，成功后用
//     `api.discoverClue(seat, 1)`（发现线索的唯一入口）追加 1 个线索。
const CODE = '10025'
const BLESS = 'bless'
const ELDER_SIGN = 'eldersign'
const BLESS_ADDED = 2

const statOf = (inv, skill) => {
  const value = Number(inv?.[skill])
  return Number.isFinite(value) ? value : 0
}

export default {
  code: CODE,
  name: 'Guided by Faith',
  abilities: [
    {
      kind: 'played',
      countsAs: 'investigate',
      label: '调查：可用意志代替智力；揭示前加入 2 祝福；揭示祝福/旧印则额外发现 1 线索',
      resolve: ({ state, inv, api }) => {
        const intellect = statOf(inv, 'intellect')
        const willpower = statOf(inv, 'willpower')
        const skill = intellect === willpower ? 'intellect' : api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: `信仰指引：本次调查使用哪项技能？（智力 ${intellect} / 意志 ${willpower}）`,
          options: [
            { id: 'intellect', label: `智力（${intellect}）` },
            { id: 'willpower', label: `意志（${willpower}）` },
          ],
        })
        const chosen = skill === 'willpower' ? 'willpower' : 'intellect'
        const added = api.chaosTokens.add(BLESS, BLESS_ADDED)
        api.info(`🕯️ 信仰指引：使用${chosen === 'willpower' ? '意志' : '智力'}调查，揭示前加入 ${added} 个祝福标记。`)
        const result = api.investigate(inv.seat, { skill: chosen })
        if (!result?.success) return
        const drawn = result.drawn || result.summary?.drawn || []
        if (!drawn.some(token => token === BLESS || token === ELDER_SIGN)) return
        const discovered = api.discoverClue(inv.seat, 1)
        api.info(`🕯️ 信仰指引：本次检定揭示了祝福/旧印标记，额外发现 ${discovered || 0} 个线索。`)
      },
    },
  ],
  modifiers: [],
}
