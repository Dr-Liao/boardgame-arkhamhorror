// 10028 修修补补（Tinker）· 守卫者事件 · 1 资源 · 洞察/升级
// 卡面：快速。只能在你的回合期间打出。将修修补补附属到你游戏区域的 [[工具]] 支援。
//       每个支援仅限 1 张。所附属的支援少占据 1 个手部或饰品槽位。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 快速 + 只能在自己回合打出：`kind: 'played', fast: true` + playCondition `ownTurn()`
//     （matcher 的回合读点，与 play-condition 的唯一判定同源）。
//   · 附属到[[工具]]支援：`api.attachPlayerCardToAsset(CODE, host, { ownerSeat })`
//     （actions-extra.js#attachCardTo 的唯一写点）；条目 `keepOnPlay` 阻止事件结算后进弃牌堆。
//   · 每个支援仅限 1 张：playCondition/候选只收还没有「修修补补」附属的[[工具]]支援。
//   · 少占 1 个手部/饰品槽位：`api.scenario.exemptAssetSlot(host, slot)`
//     （scenario-runtime.js 的实例槽位豁免写点；assets.js#occupiedSlots 是唯一读取点）。
//     approximation：该原语只能**整格**豁免（hand / accessory），没有「Hand x2 只少 1 格」的
//     半格读点 —— 宿主是双手[[工具]]时会少算 2 格。见 primitive-requests/10028.json。
import { ALL_CARDS } from '../../cards/cards-data.js'

// 「只能在自己回合期间打出」的纯判据（与 engine/matcher.js#ownTurn 同口径；卡文件不 import 引擎）。
const ownTurn = () => ctx => {
  const { state, inv } = ctx || {}
  return state?.phase === 'investigation' && state?.currentSeat === inv?.seat
}


const CODE = '10028'

const isTool = code => (ALL_CARDS[code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'tool')
const hasTinker = host => (host?.attachments || []).some(card => card.code === CODE)
const printedSlots = host => {
  const slots = host?.slotsOverride && Array.isArray(host.slots) && host.slots.length
    ? host.slots
    : (ALL_CARDS[host?.code]?.slots || [])
  return slots.map(slot => String(slot).trim().toLowerCase())
}
const tinkerTargets = inv => (inv?.assets || []).filter(host => isTool(host.code) && !hasTinker(host))

export default {
  code: CODE,
  name: 'Tinker',
  keepOnPlay: true,
  simplified: true,
  note: 'approximation: 双手[[工具]]宿主只支持整格豁免（会少算 2 格而不是 1 格）；缺「按格数减少占用」原语，见 primitive-requests/10028.json。',
  playCondition: [
    ownTurn(),
    {
      when: ({ inv }) => tinkerTargets(inv).length > 0,
      message: '你的游戏区域没有可附属「修修补补」的[[工具]]支援',
    },
  ],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '快速：附属到一件[[工具]]支援，使该支援少占 1 个手部或饰品槽位',
      resolve: ({ inv, api }) => {
        const hosts = tinkerTargets(inv)
        if (!hosts.length) {
          api.info('「修修补补」：你没有可以附属的[[工具]]支援。')
          return
        }
        const picked = hosts.length === 1 ? hosts[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '修修补补：选择要附属的[[工具]]支援。',
          options: hosts.map(host => ({ id: host.id, label: api.cardName(host.code) })),
        })
        const host = hosts.find(item => item.id === picked) || hosts[0]
        if (!api.attachPlayerCardToAsset(CODE, host, { ownerSeat: inv.seat })) {
          api.info(`「修修补补」：「${api.cardName(host.code)}」无法附属。`)
          return
        }
        const slots = printedSlots(host)
        const slot = slots.some(value => value === 'hand' || value === 'handx2' || value === 'hand x2')
          ? 'hand'
          : slots.includes('accessory') ? 'accessory' : null
        if (!slot) {
          api.info(`🧰 「修修补补」附属到「${api.cardName(host.code)}」；该支援没有手部或饰品槽位，无槽位可减少。`)
          return
        }
        api.scenario.exemptAssetSlot(host, slot)
        api.info(`🧰 「修修补补」附属到「${api.cardName(host.code)}」：少占 1 个${slot === 'hand' ? '手部' : '饰品'}槽位。`)
      },
    },
  ],
  modifiers: [],
}
