// 10105 上古封印（Seal of the Elders）· 神秘者事件 · 0 资源 · 5 经验 · [[法术]]/[[契约]]/[[祝福]]/[[诅咒萦绕]]
// 卡面：
//   快速。你所在地点的技能检定结束后打出，该技能检定须揭示了至少 2 个 [curse] 标记或 2 个 [bless] 标记。
//   如果揭示了 2 个 [curse] 标记：查找你的绑定卡牌，找出黄铜仆从（10107），并将其放置入场。
//   如果揭示了 2 个 [bless] 标记：查找你的绑定卡牌，找出钥匙看管者（10106），并将其放置入场。
//   如果 2 个 [curse] 标记和 2 个 [bless] 标记都被揭示，改为两者都执行。
//   将上古封印从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「快速。技能检定结束后打出」= played 描述子 fast:true + trigger:'testEnds'
//     （P2-4 快速事件统一通道：候选出口 encounter.js#reactionWindow，执行器 assets.js#playReactionCard；
//     窗口在 tests.js#closeTest 打开，context = { when, seat, result, source }）。
//   · 「你所在地点」= context.seat 那位调查员（检定执行者）所在地点等于控制者所在地点；
//     testEnds 的 context 不带 location，因此按 seat 读 state.investigators（与 10046 同一写法）。
//   · 「揭示了至少 2 个 [curse]/[bless]」= context.result.drawn 的计数（B3 检定结果契约）。
// 对应召唤物通过绑定区的入场入口放置，然后移除此事件。
const CODE = '10105'
const CURSE = 'curse'
const BLESS = 'bless'
const SERVANT = '10107'
const KEEPER = '10106'

const countOf = (drawn, token) => (drawn || []).filter(face => face === token).length

export default {
  code: CODE,
  name: '上古封印',
  removeAfterPlay: true,
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'testEnds',
      label: '快速：检定结束（揭示 2 诅咒/2 祝福）后，把对应的绑定召唤物放置入场，然后移出游戏',
      criteria: [({ state, inv, context }) => {
        if (context?.when !== 'testEnds') return false
        const tester = (state.investigators || [])[context.seat]
        if (!tester || tester.location !== inv.location) return false
        const drawn = context.result?.drawn || []
        return countOf(drawn, CURSE) >= 2 || countOf(drawn, BLESS) >= 2
      }],
      resolve: ({ inv, context, api }) => {
        const drawn = context?.result?.drawn || []
        const curses = countOf(drawn, CURSE)
        const blesses = countOf(drawn, BLESS)
        if (curses >= 2) {
          if (api.bonded.putAssetIntoPlay(inv.seat, SERVANT)) {
            api.info('🔑 「上古封印」：揭示了 2 个诅咒标记——黄铜仆从放置入场。')
          } else {
            api.info('🔑 「上古封印」：场外绑定集合里找不到黄铜仆从。')
          }
        }
        if (blesses >= 2) {
          if (api.bonded.putAssetIntoPlay(inv.seat, KEEPER)) {
            api.info('🔑 「上古封印」：揭示了 2 个祝福标记——钥匙看管者放置入场。')
          } else {
            api.info('🔑 「上古封印」：场外绑定集合里找不到钥匙看管者。')
          }
        }
        if (curses < 2 && blesses < 2) api.info('🔑 「上古封印」：本次检定没有揭示 2 个诅咒或 2 个祝福标记。')
      },
    },
  ],
  modifiers: [],
}
