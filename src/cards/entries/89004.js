// 89004 现实溶蚀（Reality Acid）· 中立 · 诡计/力量 · 5U-21 签名弱点（3 张）。
//
// 卡面（cards-data 89004）：
//   Revelation - If Ravenous (Controlled Hunger) is face up, flip it over. You devour a random aspect
//   of reality. Reveal a random chaos token from the chaos bag and consult Reality Acid reference card
//   to determine what you devoured.
//
// 引擎读点（近似实现）：
//   · 翻面：`api.flipAsset(asset, '89002b')`（可控饥饿 89002 面 → 失控面 89002b；api-misc.js 物理面翻转）。
//   · 随机标记：`api.revealChaosTokens(1, { seat })`（api-card.js；近似：该读点会按正常规则结算标记的
//     数值/效果，而卡面是「查阅参考卡」不结算标记效果——见 note + request）。
//   · 吞噬：`api.commitOrigins.store/take`（宿主下方容器）与 `api.discardAsset`（自己场上的支援），
//     近似口径同 89001/89003（只支持自己的手牌/牌库/弃牌堆/场上卡）。
//   · 参考卡（Reality Acid reference，89005+ 属 side-story 工作流）未入本仓库 cards-data/遭遇数据，
//     各面效果按卡面简化实现：数值面按「吞噬牌库顶/弃牌堆顶/手牌」等近似；符号面（cultist/tablet 的
//     延迟效果、旧印吞噬敌人、触手面资产等）暂记为未实现日志。

const code = '89004'
const ravenousOf = inv => (inv.assets || []).find(asset => asset.code === '89002')
const storeDevoured = (inv, api, cardCode, from) => {
  const host = (inv.assets || []).find(asset => asset.code === '89002' || asset.code === '89002b')
  if (!host) return false
  return api.commitOrigins.store(inv.seat, host.id, cardCode, { from })
}
const devourFrom = (inv, api, zone, count = 1) => {
  const cards = (inv[zone] || []).slice(-count).filter(cardCode => typeof cardCode === 'string')
  let stored = 0
  for (const cardCode of cards) if (storeDevoured(inv, api, cardCode, zone)) stored += 1
  return stored
}
const devourHand = (inv, api, count = 1) => {
  let stored = 0
  for (let i = 0; i < count; i++) {
    const cardCode = (inv.hand || [])[0]
    if (!cardCode) break
    if (storeDevoured(inv, api, cardCode, 'hand')) stored += 1
  }
  return stored
}

export default {
  code,
  abilities: [
    {
      kind: 'weakness',
      label: '显现：翻开饥肠辘辘为失控面，随机揭示 1 个标记并按参考卡吞噬现实',
      weakness: { type: 'realityAcid' },
      resolve: ({ inv, api }) => {
        const controlled = ravenousOf(inv)
        if (controlled) api.flipAsset(controlled, '89002b')
        const tokens = api.revealChaosTokens(1, { seat: inv.seat })
        const token = tokens[0]
        api.info(`「现实溶蚀」揭示标记：${token ? api.tokenLabel(token) : '无'}。`)
        let devoured = 0
        switch (token) {
          case '+1': // 吞噬每位调查员弃牌堆顶 1 张
            devoured += devourFrom(inv, api, 'discard', 1)
            break
          case '0': // 吞噬牌库顶 1 张
            devoured += devourFrom(inv, api, 'deck', 1)
            break
          case '-1': // 吞噬随机 1 张手牌（近似取第一张）
            devoured += devourHand(inv, api, 1)
            break
          case '-2': { // 吞噬你控制的一张支援
            const asset = (inv.assets || []).find(item => item.code !== '89002' && item.code !== '89002b')
            if (asset) {
              api.discardAsset(inv.seat, asset)
              devoured += storeDevoured(inv, api, asset.code, 'discard') ? 1 : 0
            }
            break
          }
          case '-3': // 吞噬附属卡（玩家卡附属未纳入近似）
            api.info('「现实溶蚀」：附属卡吞噬暂未实现。')
            break
          case '-4': // 吞噬牌库顶 2 张
            devoured += devourFrom(inv, api, 'deck', 2)
            break
          case '-5': // 吞噬手牌中 3 张
            devoured += devourHand(inv, api, 3)
            break
          case '-6': // 吞噬所有手牌中的事件（近似：自己手牌中的事件）
            for (const eventCode of [...new Set(inv.hand || [])].filter(item => api.cardType(item) === 'event')) {
              if (inv.hand.includes(eventCode)) devoured += storeDevoured(inv, api, eventCode, 'hand') ? 1 : 0
            }
            break
          case '-7': // 每位调查员吞噬一张支援（近似：自己一张）
            {
              const asset = (inv.assets || []).find(item => item.code !== '89002' && item.code !== '89002b')
              if (asset) {
                api.discardAsset(inv.seat, asset)
                devoured += storeDevoured(inv, api, asset.code, 'discard') ? 1 : 0
              }
            }
            break
          case '-8': // 吞噬签名卡（近似：不实现）
            api.info('「现实溶蚀」：吞噬签名卡暂未实现。')
            break
          case 'skull': { // 吞噬失控饥饿下方 1 张
            const host = (inv.assets || []).find(asset => asset.code === '89002b')
            const cards = host ? api.commitOrigins.beneath(inv.seat, host.id) : []
            if (host && cards.length) {
              api.commitOrigins.take(inv.seat, host.id, cards[0], 'discard')
              devoured += 1
            }
            break
          }
          case 'cultist':
          case 'tablet':
            api.info('「现实溶蚀」：标记的延迟效果需参考卡数据（未入库），跳过。')
            break
          case 'elderthing': { // 吞噬标记最多的支援（近似：自己 uses 最多的支援）
            const asset = (inv.assets || []).filter(item => item.code !== '89002' && item.code !== '89002b')
              .sort((a, b) => (b.uses || 0) - (a.uses || 0))[0]
            if (asset) {
              api.discardAsset(inv.seat, asset)
              devoured += storeDevoured(inv, api, asset.code, 'discard') ? 1 : 0
            }
            break
          }
          case 'eldersign':
            api.info('「现实溶蚀」：旧印面（吞噬同地点非精英敌人）暂未实现。')
            break
          case 'autofail':
            api.info('「现实溶蚀」：自动失败面（再揭示 3 个标记）暂未实现。')
            break
          default:
            break
        }
        if (devoured) api.info(`「现实溶蚀」吞噬了 ${devoured} 张卡。`)
      },
    },
  ],
  modifiers: [],
  note: '近似：标记按正常揭示规则结算（卡面本应只查阅参考卡）；参考卡（89005+）未入库，仅数值面的「吞噬牌库顶/弃牌堆顶/手牌/支援」实现；符号面部分未实现（primitive-requests/core-inv-89004-reality-acid-reference.json）。',
}
