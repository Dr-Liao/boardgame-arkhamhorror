// 05019 安息日男爵
// 卡面：显现 - 将安息日男爵放置入场。他身上有少于3个毁灭标记时，他不能离场。
// 卡面：强制 - 在任意数量的伤害被放置到安息日男爵所在地点的调查员上时：在该调查员上放置额外1点伤害。
// 卡面：[free]横置安息日男爵：在安息日男爵上放置1个毁灭标记。如果他身上有至少3个毁灭标记，将他弃掉。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 第七轮（2026-10-25）：引擎原语已落地——
//   · 显现：weaknessPlaysAsAsset:true → 弱点资产作为真实支援进入 inv.assets（doom 0，不占威胁区；
//     读点 src/engine/weakness.js:276-281）；
//   · 不能离场：cannotLeavePlayWhile(state, inv, asset) => (asset.doom||0) < 3，引擎在 leaveAsset
//     入口读取（src/engine/assets.js:281-286），条件为真时拒绝任何离场路径并打日志；
//   · [free] 横置放毁灭：doom 到 3 后调 api.discardSelf('05019')（leaveAsset 此时放行）真实离场进弃牌堆；
//   · 「强制额外伤害」仍挂 harmDealt 窗口（context.damage +1，走正常分配管线）。
// 旧实现（counters=3−doom 镜像 + 威胁区 + 补给阶段同步）已删除。

const BARON_CODE = '05019'

export default {
  code: '05019',
  weaknessPlaysAsAsset: true,
  // 少于 3 个毁灭标记时不能离场（引擎 leaveAsset 入口读取；返回 true 表示拒绝离场）。
  cannotLeavePlayWhile: (state, inv, asset) => ((asset?.doom || 0) < 3),
  abilities: [
    {
      kind: 'weakness',
      label: '安息日男爵进入支援区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'forced',
      trigger: 'harmDealt',
      silent: true,
      label: '同地点调查员受到伤害时额外受到 1 点伤害',
      criteria: [({ inv, state, context, source }) => {
        if (source?.code !== BARON_CODE) return false
        if (!(Number(context?.damage) > 0)) return false
        if (!Number.isInteger(context?.seat)) return false
        const harmed = state.investigators?.[context.seat]
        // 卡面「安息日男爵所在地点」= 其控制者所在地点（男爵在控制者的支援区）。
        return Boolean(harmed) && harmed.location === inv.location
      }],
      resolve: ({ inv, state, context, api }) => {
        context.damage = Math.max(0, Number(context.damage) || 0) + 1
        const harmed = state.investigators?.[context.seat]
        api.info(`「安息日男爵」强制：${harmed?.name || '该调查员'} 额外受到 1 点伤害。`)
      },
    },
    {
      // 卡面 [fast]：免费触发能力，任意玩家窗口可用；毁灭到 3 后弃掉自身。
      kind: 'free',
      cost: { exhaust: true },
      label: '横置男爵：放置 1 个毁灭标记（≥3 时弃掉）',
      resolve: ({ api, source }) => {
        const card = source?.code === BARON_CODE ? source : null
        if (!card) return
        api.placeDoomOnCard(card, 1)
        if ((card.doom || 0) >= 3) {
          api.discardSelf(BARON_CODE)
          api.info('安息日男爵身上有 3 个毁灭标记，被弃掉。')
        }
      },
    },
  ],
  modifiers: [

  ],
}
