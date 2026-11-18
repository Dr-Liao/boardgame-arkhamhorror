// 10058 显微镜（Microscope）· 探求者支援 · 4 经验 · 费用 2 · 手槽 · 道具/工具/科学。
//
// 卡面：[reaction] 你所在地点的敌人被成功躲避或击败后：在显微镜上放置 1 资源，作为证据。
//       [action][action]：调查。显微镜上每有 1 证据，你本次调查得到 +2[智力]（最多 +6[智力]）。
//       如果你检定成功，你可以花费最多 3 证据，以额外发现你所在地点的同等数量线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 证据 = 条目级 `uses: 0` / `usesType: 'evidence'`（实例计数；读写走 api.addUses / api.spendUses，
//     与 09059/08086 的「证据」同一形状——引擎没有通用的「在任意卡上放资源」写入口，卡上计数用 uses）。
//   · 「敌人被成功躲避或击败后」→ `defeatEnemy` / `defeatAtLocation` / `evadeSuccess` 三个窗口
//     （enemies.js#defeatEnemy 与 combat.js#doEvade 的派发点；context 带 enemy 与 location）。
//     「你所在地点」= context.location === inv.location（击败者 / 躲避者可能在别处，仍按敌人所在地判）。
//   · [action][action] → `cost: { action: 2 }`（turn-flow.js#actionCost 对数值 action 返回 2，
//     dispatch 校验并扣 2 个行动；与 09056 同一写法）。
//   · 「调查 + 每证据 +2（最多 +6）」→ api.investigate 的 `bonus`；「最多 +6」在 resolve 里先截断。
//   · 「花费最多 3 证据额外发现线索」→ api.spendUses + api.discoverClue（locations.js#discoverClueAt）。
//   · 口径：证据用实例 uses 计数（存档/界面显示为「证据」），与卡面「资源，作为证据」的载体不同；
//     累计、封顶与花费上限的行为一致（与 08086/09059 同一口径）。
const CODE = '10058'

export default {
  code: CODE,
  uses: 0,
  usesType: 'evidence',
  note: 'approximation: 证据用实例 uses/usesType 计数（引擎没有通用的「在任意卡上放资源」写入口，与 08086/09059 同一口径）；累计与花费行为一致。',
  abilities: [
    {
      kind: 'reaction',
      trigger: ['defeatEnemy', 'defeatAtLocation', 'evadeSuccess'],
      // 同一次「敌人被躲避/击败」事件只结算一次（反应本来就是一次性触发；引擎的能力窗口
      // 会重复询问直到让过，perWindow 用同一窗口实例去重）。
      limit: { scope: 'perWindow', owner: 'instance' },
      label: '你所在地点的敌人被成功躲避或击败后：在显微镜上放 1 资源作为证据',
      criteria: [({ inv, context }) => {
        // 先取「敌人所在地点」：从连接地点远程躲避时 context.location 是执行者的地点，
        // 但卡面要求敌人本身在你所在地点（击败窗口的 context.location 是敌人被击败时地点，
        // 敌人实例的 location 已清空时回退它）。
        const enemy = context?.enemy
        if (!enemy) return false
        const location = enemy.location ?? context?.location
        return location === inv.location
      }],
      resolve: ({ source, api }) => {
        if (!source) return
        api.addUses(source, 1)
        api.info(`🔬 「显微镜」：放置 1 资源作为证据（当前 ${source.uses || 0}）。`)
      },
    },
    {
      kind: 'action',
      countsAs: 'investigate',
      cost: { action: 2 },
      label: '[action][action]：调查，每有 1 证据 +2[智力]（最多+6）；成功后最多花 3 证据额外发现等量线索',
      resolve: ({ state, inv, source, api }) => {
        const evidence = Math.max(0, Number(source?.uses) || 0)
        const bonus = Math.min(6, evidence * 2)
        const result = api.investigate(inv.seat, { assetId: source?.id, sourceCode: CODE, bonus })
        if (!result?.success) return
        const here = state.locations.find(location => location.id === inv.location)
        const available = Math.min(3, Number(source?.uses) || 0, Math.max(0, Number(here?.clues) || 0))
        if (available <= 0) return
        const options = [{ id: '0', label: '不花费证据' }]
        for (let count = 1; count <= available; count++) {
          options.push({ id: String(count), label: `花费 ${count} 证据，额外发现 ${count} 个线索` })
        }
        const answer = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '「显微镜」：本次调查成功，是否花费证据额外发现线索？',
          options,
        })
        const spend = Math.max(0, Math.min(available, Number(answer) || 0))
        if (!spend) return
        if (!api.spendUses(source, spend)) return
        const got = api.discoverClue(inv.seat, spend)
        api.info(`🔬 「显微镜」：花费 ${spend} 证据，额外发现 ${got} 个线索。`)
      },
    },
  ],
  modifiers: [],
}
