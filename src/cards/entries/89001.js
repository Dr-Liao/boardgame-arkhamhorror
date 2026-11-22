// 89001 个体代号 5U-21（Subject 5U-21）· 中立 · 调查员/异常体 · The Blob That Ate Everything ELSE!。
//
// 卡面（cards-data 89001）：
//   You begin the game with Ravenous (Controlled Hunger) in play.
//   During each upkeep phase, draw 1 additional card and devour a non-weakness player card in your hand.
//   [fast]: Devour a non-story card controlled by an investigator at your location. (Limit once per round.)
//   [elder_sign] effect: +2. After this test ends, you may add a devoured card to its owner's hand.
//
// 引擎读点（近似实现）：
//   · 开局自带永久弱点 89002：永久卡由 setup.js 的 `cardDef.permanent` 分支开局入场（89002 是签名永久
//     弱点，构筑接线由 Lead 负责）。
//   · 「吞噬」在本 Mod 没有专门原语；用通用「压在宿主卡下方」容器实现：
//     `api.commitOrigins.store(seat, hostId, code, { from })` / `.beneath(seat, hostId)` /
//     `.take(seat, hostId, code, 'hand')`（07303 先祖知识、09089 束敌宝罐同款读点；宿主 = 89002 实例）。
//     近似：可控/失控两面都暂用同一容器（失控面卡面写「set aside, out of play」）；
//     只能吞噬「自己的」手牌与「自己的」场上卡（其它调查员控制的卡缺跨所有者搬运原语），
//     已在 primitive-requests/core-inv-89001-devour.json 请求完整 devour 子系统。
//   · 补给阶段额外抽 1 + 吞噬手牌：`phaseBegins` 窗口 + `state.phase === 'upkeep'`，limit oncePerRound。
//   · [fast] 吞噬场上卡：`kind:'action', cost:{ action:false }, fast:true, limit:'oncePerRound'`。
//   · 旧印：`elderSign.resolve` 返回 { delta: 2 }，并把一张已吞噬卡还给其所有者手牌（近似：还给自己）。

import { ALL_CARDS } from '../cards-data.js'

const code = '89001'
const isWeakness = cardCode => String(ALL_CARDS[cardCode]?.subtype || '').toLowerCase().includes('weakness')
const ravenousOf = inv => (inv.assets || []).find(asset => asset.code === '89002' || asset.code === '89002b')

function devourHandCard(inv, api) {
  const host = ravenousOf(inv)
  if (!host) return false
  const candidates = [...new Set((inv.hand || []).filter(cardCode => ALL_CARDS[cardCode] && !isWeakness(cardCode)))]
  if (!candidates.length) return false
  const picked = candidates.length === 1 ? candidates[0] : api.choice({
    kind: 'card', source: code, seat: inv.seat, prompt: '吞噬你手牌中的一张非弱点玩家卡。',
    options: candidates.map(cardCode => ({ id: cardCode, cardCode, label: api.cardName(cardCode) })),
  })
  if (!candidates.includes(picked)) return false
  const stored = api.commitOrigins.store(inv.seat, host.id, picked, { from: 'hand' })
  if (stored) api.info(`「个体代号 5U-21」吞噬了手牌中的「${api.cardName(picked)}」。`)
  return Boolean(stored)
}

export default {
  code,
  kind: 'investigator',
  investigator: { elderSign: { bonus: 2 }, specialDeckbuilding: 'subject5u21' },
  elderSign: {
    id: '89001-eldersign',
    label: '旧印：+2。检定结束后可以把一张被吞噬的卡加入其所有者手牌',
    resolve: ({ inv, api }) => {
      const host = ravenousOf(inv)
      const devoured = host ? [...new Set(api.commitOrigins.beneath(inv.seat, host.id))] : []
      if (devoured.length) {
        const picked = devoured.length === 1 ? devoured[0] : api.choice({
          kind: 'card', source: '89001-eldersign', seat: inv.seat, prompt: '选择一张被吞噬的卡返回手牌。',
          options: devoured.map(cardCode => ({ id: cardCode, cardCode, label: api.cardName(cardCode) })),
        })
        if (devoured.includes(picked)) api.commitOrigins.take(inv.seat, host.id, picked, 'hand')
      }
      return { delta: 2 }
    },
  },
  abilities: [
    {
      kind: 'forced',
      trigger: 'phaseBegins',
      limit: 'oncePerRound',
      label: '补给阶段：额外抽 1 张并吞噬手牌中一张非弱点玩家卡',
      criteria: ({ inv, state }) => state.phase === 'upkeep' && Boolean(ravenousOf(inv)),
      resolve: ({ inv, api }) => {
        api.drawCards(inv.seat, 1)
        devourHandCard(inv, api)
      },
    },
    {
      kind: 'action',
      cost: { action: false },
      fast: true,
      limit: 'oncePerRound',
      label: '[fast] 吞噬你所在地点一位调查员控制的一张非剧情卡',
      criteria: ({ inv }) => Boolean(ravenousOf(inv)) && (inv.assets || []).some(asset => asset.code !== '89002'
        && asset.code !== '89002b' && !ALL_CARDS[asset.code]?.permanent && cardIsDevourable(asset.code)),
      resolve: ({ inv, api }) => {
        const host = ravenousOf(inv)
        const candidates = (inv.assets || []).filter(asset => asset.code !== '89002' && asset.code !== '89002b'
          && !ALL_CARDS[asset.code]?.permanent && cardIsDevourable(asset.code))
        if (!host || !candidates.length) return
        const pickedId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: code, seat: inv.seat, prompt: '吞噬你控制的一张非剧情卡。',
          options: candidates.map(asset => ({ id: asset.id, cardCode: asset.code, label: api.cardName(asset.code) })),
        })
        const asset = candidates.find(item => item.id === pickedId)
        if (!asset) return
        api.discardAsset(inv.seat, asset)
        api.commitOrigins.store(inv.seat, host.id, asset.code, { from: 'discard' })
        api.info(`「个体代号 5U-21」吞噬了「${api.cardName(asset.code)}」。`)
      },
    },
  ],
  modifiers: [],
  note: '近似：吞噬用 commitOrigins 的宿主下方容器（09089 同款读点），两面 Ravenous 共用；只支持自己的手牌/场上卡，跨所有者吞噬与「set aside」独立区域待引擎原语（primitive-requests/core-inv-89001-devour.json）。',
}

function cardIsDevourable(cardCode) {
  const def = ALL_CARDS[cardCode]
  if (!def) return false
  if (def.type !== 'asset') return false
  if (String(def.subtype || '').toLowerCase().includes('weakness')) return false
  return def.type !== 'story'
}
