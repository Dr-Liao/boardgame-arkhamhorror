// 10084 猫面具（Cat Mask）· 秘术（Mystic）资产 · 1 资源 · [[道具]]/[[护符]]/[[面具]]
//
// 卡面：
//   每位调查员仅限 1 张 [[面具]]。
//   使用（2 贡品）。在毁灭标记放置到一张没有毁灭标记的卡牌后，补满其中的 2 个贡品。
//   [fast] 花费 1 贡品：你本次技能检定得到 +2 [willpower] 或 +2 [combat]。（每次检定仅限一次。）
//
// 一条行为的读点（卡面 → 引擎）：
//   · 「每位调查员仅限 1 张[[面具]]」：assetRule.controlledTraitLimit（assets.js#exceedsControlledTraitLimit，
//     在 canEquip 的唯一槽位读点里判定；打出候选与在场卡同一口径）。
//   · 「使用（2 贡品）」：条目级 uses / usesType（newPlayerAssetInstance 初始化 + assetEffect 展示，
//     与 09123 灵魂封圣同一套「贡品」命名）。
//   · 「毁灭标记放置到没有毁灭标记的卡后，补满 2 贡品」：forced 描述子 + trigger 'doomPlaced'
//     （act-agenda.js#placeDoomOnCard 的唯一派发点，context = { card, amount, hadDoom }）；
//     `context.hadDoom === false` 就是印刷的「a card with no doom」，`context.card` 非空排除密谋毁灭。
//     补充走 api.setAssetUses（api-clue.js：实例使用次数的唯一写点，0 时走 resolveEmptyUses）。
//   · 「[fast] 花费 1 贡品：本次技能检定 +2 意志/战斗」：kind:'free' + trigger
//     ['test.beforeCommit','test.afterCommit']（performTest 内的玩家窗口，09123 / 06241 同款），
//     duringOwnSkillTest 限定本人检定，cost.uses 支付贡品，limit perTest 保证每次检定仅一次；
//     +2 写 api.addPendingTestBonus（检定主流程统一叠加的待决加值）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10084'
const SKILLS = ['willpower', 'combat']

const skillList = state => [state?.skillTest?.skill].flat().filter(Boolean)

export default {
  code: CODE,
  name: 'Cat Mask',
  uses: 2,
  usesType: 'offerings',
  // 「每位调查员仅限 1 张[[面具]]」：canEquip 的受限特性读点。
  assetRule: { controlledTraitLimit: { trait: 'Mask', amount: 1 } },
  abilities: [
    {
      kind: 'forced',
      trigger: 'doomPlaced',
      label: '毁灭放到没有毁灭的卡上后：补满 2 个贡品',
      criteria: [({ source, context }) => Boolean(source) && context?.card != null && context.hadDoom === false],
      resolve: ({ source, api }) => {
        if (!source) return
        api.setAssetUses(source, 2)
        api.info(`🎭 「${api.cardName(CODE)}」：毁灭标记放到一张没有毁灭的卡上，补满 2 个贡品。`)
      },
    },
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      label: '[fast] 花费 1 贡品：本次检定 +2 意志/战斗（每次检定仅限一次）',
      cost: { uses: 1 },
      limit: { scope: 'perTest', owner: 'instance' },
      criteria: [({ state }) => skillList(state).some(skill => SKILLS.includes(skill))],
      resolve: ({ inv, api }) => {
        api.addPendingTestBonus(2)
        api.info(`🎭 「${ALL_CARDS[CODE]?.name || CODE}」：${inv.name} 花费 1 贡品，本次检定 +2 技能值。`)
      },
    },
  ],
  modifiers: [],
}
