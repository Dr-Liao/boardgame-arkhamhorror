// 09007「受伤的旁观者」（Wounded Bystander）· 支援 · 文森特专属弱点
// 卡面：显现 - 将「受伤的旁观者」放置入场，放到你的游戏区域，带有 3 点伤害。
//       它有伤害时不能离场（除非被击败）。如果它没有伤害，弃掉它。
//       强制 - 在你受到非直接伤害时，如可能，其中至少 1 点必须分配到受伤的旁观者。
//       强制 - 如果受伤的旁观者被击败：你承受 1 点精神创伤。
//
// 读点（卡面 → 引擎读点）：
//   · 显现放置入场：`weaknessPlaysAsAsset: true` + weakness type threat 的资产分支
//     （src/engine/weakness.js:290-301 把实例放进 inv.assets）。
//   · 入场带 3 点伤害：`entersPlay` 描述子（卡面规则只写这一处；源实例 = 放置入场的那张支援）。
//     引擎缺口：actions.js#doPlay 在打出支援时会执行 entersPlay 描述子，但弱点资产入场的
//     weakness.js 分支没有执行它，因此当前 3 点伤害不会放置（扫描探针 asset.damage=undefined）。
//     需要的引擎读点是「weakness.js 的 weaknessPlaysAsAsset 分支在 push 之后执行同一份
//     entersPlay 描述子」——不改卡侧直接写状态，已列给主进程。本卡保留标准 entersPlay 声明，
//     引擎接线后自动生效。
//   · 有伤害不能离场：条目 `cannotLeavePlayWhile`（assets.js#leaveAsset 的读点）。
//     被击败（伤害 >= 印刷生命值）时必须允许离场，否则 checkAssetDefeated 会先被拒、再重复把
//     卡号塞进弃牌堆，出现「在场 + 在弃牌堆」双份。因此这里显式排除已击败情形（印刷 5 生命）。
//   · 「非直接伤害至少 1 点分配给它」：引擎伤害分配读点 flags.composureDamage
//     （src/engine/harm-threat.js#assignHarm:162-165：非直接伤害的 mandatory 资产，存在时不提供
//     「由调查员承受」选项，先填满该支援）。P1-6 修正：原实现挂在事后 `harmAssigned` 窗口上，
//     只能给支援追加伤害，无法改变实际分配（扫描判定为「入场伤害未放置 + 事后追打翻倍」）。
//     近似：引擎的 mandatory 只保证「不先给调查员」，同地点其他支援仍可被选；「必须先给旁观者」
//     的精确目标限制需要分配读点支持，已列给主进程。
//   · 被击败 → 1 点精神创伤：`assetDefeated` 窗口（asset-defeat.js#checkAssetDefeated 的唯一判定点）
//     + api.addTrauma('mental')。
import { ALL_CARDS } from '../../cards/cards-data.js'

const BYSTANDER = '09007'
// 印刷生命值（卡面数据 cards-data.js：health 5）；用于区分「有伤害不能离场」与「已被击败」。
const BYSTANDER_HEALTH = Number(ALL_CARDS[BYSTANDER]?.health) || 5

export default {
  code: BYSTANDER,
  weaknessPlaysAsAsset: true,
  // 有伤害时不能离场；已被击败时必须放行（见文件头读点说明）。
  cannotLeavePlayWhile: (state, inv, asset) => {
    const damage = Number(asset?.damage) || 0
    return damage > 0 && damage < BYSTANDER_HEALTH
  },
  // 非直接伤害必须先分配到本支援（harm-threat.js#assignHarm 的 mandatory 读点）；
  // 2026-11-13 P1-6：引擎保证「第 1 点强制分配给本支援」，其余点数才轮到其它支援/调查员。
  flags: { composureDamage: true },
  abilities: [
    {
      kind: 'weakness',
      label: '显现：以 3 点伤害放入你的游戏区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'entersPlay',
      label: '入场：其上放置 3 点伤害',
      resolve: ({ source, api }) => {
        if (source && api.investigatorTools?.setAssetDamage) api.investigatorTools.setAssetDamage(source, 3)
      },
    },
    {
      kind: 'forced',
      trigger: 'assetDefeated',
      silent: true,
      label: '受伤的旁观者被击败时：你承受 1 点精神创伤',
      criteria: [({ inv, context }) => context?.assetCode === BYSTANDER
        && (context?.ownerSeat == null || context.ownerSeat === inv.seat)],
      resolve: ({ inv, api }) => {
        api.addTrauma(inv.seat, 'mental', 1)
        api.info(`🩸 「受伤的旁观者」被击败：${inv.name} 承受 1 点精神创伤。`)
      },
    },
  ],
  modifiers: [],
}
