// 09042 鸦翎羽毛笔（The Raven Quill）· 探求者事件 · 3 费 · 定制 · 独特。
// 卡面：定制。你在购买鸦翎羽毛笔时，指定一个[[书籍]]或[[法术]]支援，并将其名称记录在本卡牌的
//       升级卡上。附属到你控制的已指定支援。
//       [reaction] 在你撤退或游戏结束时：勾选鸦翎羽毛笔升级卡上的一个方框，或者在下场冒险开始前
//       升级所附属支援的经验值费用降低 1 点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 打出：选择你控制的一张[[书籍]]或[[法术]]支援，把本事件作为升级附属到它（api.attachPlayerCardToAsset
//     的 code 参数是卡号，宿主附属会被 descriptorSources 枚举为能力来源）；
//   · Energy Sap（已勾选，2 格）：本卡获得「[fast] 横置：把 1 充能/秘密从你控制的另一张支援移到
//     所附属支援」——逐项实现，读点 uses（api.addUses）。
// approximation：撤退/游戏结束没有玩家卡可用的窗口，且「升级经验 -1」属于战役升级报价层
//   （campaign-flow 的 XP 计算），本条目未实现；Living Quill / Spectral Binding / Mystic Vane /
//   Interwoven Ink / Supernatural Record 缺「按勾选条件改槽位/改检定值/改触发」的读点，未实现。
//   逐项见 note 与 artifacts/migration/tsk/primitive-requests/09042.json。
import { customizationChecked } from '../../engine/tsk-customizable.js'

const SOURCE = '09042'
const hostOf = state => {
  for (const owner of state.investigators || []) {
    for (const asset of owner.assets || []) {
      const attachment = (asset.attachments || []).find(item => item.code === SOURCE && !item.assetReference)
      if (attachment) return { owner, asset, attachment }
    }
  }
  return null
}

export default {
  code: '09042',
  note: 'approximation: 只实现「附属到已指定的书籍/法术支援」与 Energy Sap 的移标记；撤退/游戏结束的勾选与升级经验 -1、以及另 5 项定制效果缺读点未实现（见 primitive-requests/09042.json）',
  customizationOptions: [
    { name: 'Living Quill', checks: 1, text: "Using attached asset's [action] abilities does not provoke attacks of opportunity." },
    { name: 'Spectral Binding', checks: 1, text: 'Attached asset does not take up any slots.' },
    { name: 'Mystic Vane', checks: 2, text: 'You get +2 skill value while performing skill tests on attached asset.' },
    { name: 'Endless Inkwell', checks: 2, text: 'Name two more [[Tome]] or [[Spell]] assets:' },
    { name: 'Energy Sap', checks: 2, text: 'The Raven Quill gains: "[fast] Exhaust The Raven Quill: Move 1 secret or charge from an asset you control to attached asset."' },
    { name: 'Interwoven Ink', checks: 3, text: 'After you resolve an [action] ability on attached asset, you may exhaust The Raven Quill to ready another asset you control.' },
    { name: 'Supernatural Record', checks: 4, text: 'When you play The Raven Quill, instead of attaching it to a named asset you control, you may search your deck, discard pile, and hand for a copy of a named asset and play it (paying its cost). Then, attach The Raven Quill to it.' },
  ],
  abilities: [
    {
      kind: 'played',
      label: '附属到你控制的一张[[书籍]]或[[法术]]支援',
      resolve: ({ state, inv, api }) => {
        const candidates = (inv.assets || []).filter(asset => (api.cardTraits(asset.code) || [])
          .some(trait => ['tome', 'spell'].includes(String(trait).toLowerCase())))
        if (!candidates.length) {
          api.info('鸦翎羽毛笔：你控制的支援里没有[[书籍]]或[[法术]]。')
          return
        }
        const chosen = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'asset', source: SOURCE, seat: inv.seat,
          prompt: '鸦翎羽毛笔：选择要附属的[[书籍]]或[[法术]]支援。',
          options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const host = candidates.find(item => item.id === chosen) || candidates[0]
        api.attachPlayerCardToAsset(SOURCE, host, { ownerSeat: inv.seat })
        api.info(`鸦翎羽毛笔：附属到「${api.cardName(host.code)}」。`)
      },
    },
    {
      kind: 'free',
      label: '墨力汲取（Energy Sap）：横置本卡，把 1 充能/秘密移到所附属支援',
      cost: { exhaust: true },
      criteria: [({ state, inv }) => {
        const host = hostOf(state)
        if (!host) return false
        if (!customizationChecked(state, inv.seat, SOURCE).includes(4)) return false
        return (inv.assets || []).some(card => card !== host.asset && (card.uses || 0) > 0)
      }],
      resolve: ({ state, inv, api }) => {
        const host = hostOf(state)
        if (!host) return
        const sources = (inv.assets || []).filter(card => card !== host.asset && (card.uses || 0) > 0)
        if (!sources.length) return
        const assetId = sources.length === 1 ? sources[0].id : api.choice({
          kind: 'asset', source: SOURCE, seat: inv.seat,
          prompt: '墨力汲取：选择要移走充能/秘密的支援。',
          options: sources.map(card => ({ id: card.id, label: `${api.cardName(card.code)}（${card.uses}）` })),
        })
        const from = sources.find(card => card.id === assetId) || sources[0]
        api.addUses(from, -1)
        api.addUses(host.asset, 1)
        api.info(`鸦翎羽毛笔：把 1 个标记从「${api.cardName(from.code)}」移到「${api.cardName(host.asset.code)}」。`)
      },
    },
  ],
  modifiers: [],
}
