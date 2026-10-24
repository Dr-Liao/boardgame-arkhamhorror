// 05037 绝望之举
// 卡面：作为打出绝望之举的额外费用，从你手牌或游戏区域选择并弃掉一张占用至少1个手部槽位的[[道具]]支援。
// 卡面：攻击。本次攻击你得到+X[combat]并造成+1伤害，其中X为所选支援的印刷资源费用。
//       如果你检定成功且该支援是从你游戏区域弃掉的，获得X资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05037 绝望之举：事件自带「攻击」结算（不引发借机攻击、不再付行动）。
// 额外费用在 resolve 里先处理：手牌/场上的[[道具]]支援（占 ≥1 手部槽位）二选一弃掉；
// 然后做一次攻击（+X 战斗、+1 伤害），若弃掉的是场上支援且检定成功则获得 X 资源。
// 槽位判定读印刷卡面数据（cards-data 的 slots/slot）；卡面费用读 api.cardCost。
// 第 5 步 P7：不能用 engine/card-lookup.js —— entries → card-lookup → content/registered 会绕回
// card-abilities/entries，形成 ESM 循环（CARD_ABILITY_ENTRIES TDZ）。cards-data 是纯数据表，无环。
import { ALL_CARDS } from '../../cards/cards-data.js'

const isItem = traits => (traits || []).some(trait => String(trait).toLowerCase() === 'item')
const handSlots = def => (Array.isArray(def?.slots) ? def.slots : def?.slot ? [def.slot] : [])
  .some(slot => /^hand/i.test(String(slot).trim()))
const isSlotItem = code => isItem(ALL_CARDS[code]?.traits) && handSlots(ALL_CARDS[code])

export default {
  code: '05037',
  // 卡面的额外费用（弃一张占手部槽位的[[道具]]支援）与「攻击」目标都不是可选的：
  // 没有合法费用卡或没有可攻击敌人时不能打出（否则会出现白付费用/白弃道具）。
  playCondition: [{
    when: ({ state, inv }) => {
      const hasCostCard = (inv.hand || []).some(isSlotItem)
        || (inv.assets || []).some(asset => isSlotItem(asset.code))
      if (!hasCostCard) return false
      return (state.enemies || []).some(enemy => !enemy.defeated && enemy.location === inv.location
        && (!enemy.aloof || enemy.engagedSeat != null))
    },
    message: '没有可支付额外费用的占手部槽位[[道具]]支援，或所在地点没有可攻击的敌人',
  }],
  abilities: [
    {
      kind: 'played',
      label: '绝望之举',
      // 卡面「攻击。」：不引发借机攻击（与普通攻击行动同一口径）。
      noOpportunityAttack: true,
      resolve: ({ state, inv, api }) => {
        // --- 额外费用：弃掉一张占手部槽位的[[道具]]支援（手牌或游戏区域） ---
        const handItems = inv.hand.filter(isSlotItem)
        const playItems = inv.assets.filter(asset => isSlotItem(asset.code))
        const options = [
          ...handItems.map(code => ({ id: 'hand:' + code, label: `手牌：${api.cardName(code)}` })),
          ...playItems.map(asset => ({ id: 'play:' + asset.id, label: `场上：${api.cardName(asset.code)}` })),
        ]
        if (!options.length) { api.info('没有可弃掉的占用至少 1 个手部槽位的[[道具]]支援。'); return }
        const chosen = options.length === 1 ? options[0].id
          : api.choice({ kind: 'target', source: '05037', seat: inv.seat,
            prompt: '选择要弃掉的[[道具]]支援（占用至少 1 个手部槽位）。', options })
        let printedCost = 0
        let fromPlayArea = false
        if (String(chosen).startsWith('hand:')) {
          const code = String(chosen).slice('hand:'.length)
          const index = inv.hand.indexOf(code)
          if (index < 0) return
          inv.hand.splice(index, 1)
          inv.discard.push(code)
          printedCost = api.cardCost(code) || 0
        } else {
          const asset = inv.assets.find(item => item.id === String(chosen).slice('play:'.length))
          if (!asset) return
          printedCost = api.cardCost(asset.code) || 0
          fromPlayArea = true
          api.discardAsset(inv.seat, asset)
        }
        // --- 攻击：+X 战斗、+1 伤害 ---
        const targets = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.defeated)
        if (!targets.length) { api.info('这里没有可攻击的敌人。'); return }
        const targetId = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '05037', seat: inv.seat, prompt: '选择攻击的敌人。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const result = api.fight(inv.seat, targetId, {
          combatBonus: printedCost,
          damageBonus: 1,
          assetId: '05037',
          noSpend: true,
        })
        if (result?.success && fromPlayArea) {
          inv.resources += printedCost
          api.info(`💰 ${inv.name} 因弃掉场上的道具支援获得 ${printedCost} 资源。`)
        }
      },
    },
  ],
  modifiers: [

  ],
}
