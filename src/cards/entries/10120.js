// 10120 消防斧（Fire Axe）· 生存者资产 · 2 经验 · 手槽
// 卡面：快速。
//       [action]：攻击。如果你的资源池中没有资源，本次攻击造成 +1 伤害。
//       [fast] 在使用消防斧的攻击期间，花费 1 资源：你本次技能检定得到 +2[combat]。
//       （每次攻击仅限三次。）
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「快速」资产：条目级 `fast: true`（turn-flow.js#actionCost 的 cardPlayFlag 读点）。
//   · [action] 攻击：`api.fight(...)`（combat.js 的 mkChooseFight），`trackAssetSource: true` 让
//     检定的 source.assetId 指向本支援（[fast] 加值据此限定「使用消防斧的攻击」）。
//   · 「没有资源则 +1 伤害」：`onSuccess({ result, opts })` 在伤害合计前回调（10021 同一读点），
//     此时快速能力花费的资源已经扣完，读 `state.investigators[seat].resources === 0` 才是最终口径。
//   · [fast] +2[combat]：`free` 描述子 + test.beforeCommit/test.afterCommit 玩家窗口 +
//     `duringOwnSkillTest`（09123/06241 同款）；加值写 `api.addPendingTestBonus(2)`（下一次并进检定值），
//     限次 `limit: { scope: 'perTest', owner: 'instance', count: 3 }`。
const CODE = '10120'

export default {
  code: CODE,
  name: 'Fire Axe',
  fast: true,
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      label: '攻击：资源池为空时本次攻击 +1 伤害',
      target: { kind: 'enemy' },
      cost: { action: true },
      resolve: ({ state, inv, source, targetId, api }) => {
        if (!targetId) return
        api.fight(inv.seat, targetId, {
          assetId: source?.id,
          trackAssetSource: true,
          onSuccess: ({ opts }) => {
            const owner = state.investigators[inv.seat]
            if (!owner || (owner.resources || 0) > 0) return
            opts.damageBonus = (opts.damageBonus || 0) + 1
            api.info('🪓 消防斧：你的资源池为空，本次攻击造成 +1 伤害。')
          },
        })
      },
    },
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      label: '花 1 资源：本次攻击 +2[combat]（每次攻击限三次）',
      cost: { resources: 1 },
      limit: { scope: 'perTest', owner: 'instance', count: 3 },
      criteria: [({ state, source }) => Boolean(source) && state.skillTest?.source?.assetId === source.id],
      resolve: ({ api }) => api.addPendingTestBonus(2),
    },
  ],
  modifiers: [],
}
