// 10122 水手的罗盘（Mariner's Compass）· 生存者资产 · 2 经验 · 手槽
// 卡面：[action] 横置水手的罗盘：调查。如果你检定失败，重整水手的罗盘。如果你检定成功且你的
//       资源池中没有资源，发现你所在地点额外 1 个线索。
//       [fast] 在使用水手的罗盘的调查期间，花费 1 资源：你本次技能检定得到 +1[intellect]。
//       （每次调查仅限三次。）
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · [action] 调查：`api.investigate(inv.seat, { assetId, trackAssetSource, clueIfNoResources: 1 })`。
//     `clueIfNoResources` 是 actions.js#runInvestigate 的成功结算读点（资源为 0 时 +1 线索，与
//     07121 水手的罗盘(1) 同一参数）；`trackAssetSource` 让 source.assetId 指向本支援，
//     [fast] 加值据此限定「使用水手的罗盘的调查」。
//   · 「检定失败则重整」：api.investigate 返回 B3 结果契约，resolve 内 `api.ready(source)`。
//   · [fast] +1[intellect]：`free` 描述子 + test.beforeCommit/test.afterCommit 玩家窗口 +
//     `duringOwnSkillTest`，加值写 `api.addPendingTestBonus(1)`；限次 `perTest` 3 次。
const CODE = '10122'

export default {
  code: CODE,
  name: "Mariner's Compass",
  abilities: [
    {
      kind: 'action',
      countsAs: 'investigate',
      label: '横置：调查；失败则重整；成功且无资源则额外发现 1 个线索',
      cost: { action: true, exhaust: true },
      resolve: ({ inv, source, api }) => {
        const result = api.investigate(inv.seat, {
          assetId: source?.id,
          trackAssetSource: true,
          clueIfNoResources: 1,
        })
        if (result && result.success === false && source) {
          api.ready(source)
          api.info('🧭 水手的罗盘：调查失败，重整水手的罗盘。')
        }
      },
    },
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      label: '花 1 资源：本次调查 +1[intellect]（每次调查限三次）',
      cost: { resources: 1 },
      limit: { scope: 'perTest', owner: 'instance', count: 3 },
      criteria: [({ state, source }) => Boolean(source) && state.skillTest?.source?.assetId === source.id],
      resolve: ({ api }) => api.addPendingTestBonus(1),
    },
  ],
  modifiers: [],
}
