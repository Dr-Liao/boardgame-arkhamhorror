// 60471 惊悚低语（Eldritch Whispers，Marie Lambeau，1 XP）· 技能
// 卡面：每次技能检定最多投入 1 张。
//       如果本次检定期间揭示了符号标记，在你控制的支援上放置总计最多 2 个充能或 2 个秘密。
//
// 读点（批次 3 原语）：投入档案 onSymbolRevealed({ state, inv, source, test, token, api })：
//   引擎在每次揭示符号标记后对每张已投入卡调用（tests.js#performTest 标记揭示段）。
//   「本次检定只结算一次」不新增状态字段：读当前检定帧已揭示的符号数，只有第一个符号标记时才放置
//   （state.chaos.revealed 从 frames.at(-1) 起，与 07110/12082 同一读点）。
import { ALL_CARDS } from '../cards-data.js'

const CODE = '60471'
const SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing']

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '揭示符号标记：在你控制的支援上放置最多 2 充能/秘密',
      skill: {
        maxPerTest: 1,
        onSymbolRevealed: ({ state, inv, api }) => {
          const start = state?.chaos?.frames?.at(-1) ?? 0
          const revealed = (state?.chaos?.revealed || []).slice(start)
          const symbols = revealed.filter(token => SYMBOLS.includes(token))
          if (symbols.length !== 1) return
          const assets = (inv.assets || []).filter(asset => asset.usesType
            && ['charges', 'secrets'].includes(asset.usesType) && ALL_CARDS[asset.code])
          if (!assets.length) return
          const asset = assets.length === 1 ? assets[0] : assets.find(item => item.id === api.choice({
            kind: 'card', source: CODE, seat: inv.seat,
            prompt: '选择要放置 2 个充能/秘密的支援。',
            options: assets.map(item => ({ id: item.id, cardCode: item.code, label: api.cardName(item.code) })),
          })) || assets[0]
          if (asset) api.addUses(asset, 2)
        },
      },
    },
  ],
  modifiers: [],
}
