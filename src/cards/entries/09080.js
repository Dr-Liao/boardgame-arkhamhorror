// 09080 召来的仆从（Summoned Servitor）· 秘术师支援 · 0 经验 · 定制。
// 卡面：定制。作为打出召来的仆从的额外费用，你必须弃掉自己控制的另一个支援。
//       召来的仆从在你的地点入场。它在你每个回合期间能进行 1 次行动，只能用于下列行动：
//       - 将召来的仆从移动到一个已揭示的连接地点。
//       定制项见 customizationOptions（options.json 原文）。
//
// 读点：额外费用「弃掉你控制的另一个支援」——引擎的打出费用管线（actions.js#doPlay/payPlayCost）
//       不读 `cost.discardControlledAsset`（该字段只在 ability-rules.js#payAbilityCost 的能力描述子
//       路径生效），因此卡侧用 playCondition（唯一可用性读点）要求「有另一个可弃支援」，并在
//       entersPlay 的 resolve 里用 api.choice + api.discardAsset 支付；声明式 cost 保留给主进程接线
//       打出费用管线（见 primitive-request/09080.json）。
//       移动 = api.attachSelfToLocation（把自身支援变为地点附属，卡面真的到了目标地点）；
//       定制行动 = action 描述子 + checked 判定；检定基础值 4 走 api.fight/investigate/evade 的 baseValue。
//
// approximation（已写 primitive-request/09080.json）：
//   · 引擎的支援实例没有独立 location 字段；「移动仆从」用「把这张支援卡附属到目标地点」
//     近似（移动后它不再作为支援参与能力枚举）。
//   · Dominance（不占槽）、Dreaming Call（返回手牌代替弃掉）、Dæmonic Influence（2 个行动）
//     缺少实例级槽位覆盖 / 替代费用 / 行动预算读点，逐项 note，不伪造。
//   · Armored Carapace（3 生命 + 替同地点调查员承受伤害）与 Jaws「忽略警戒」没有对应读点，未实现
//     （note 披露）。
//   · 定制行动按 limit oncePerTurn 逐个记账（引擎没有「每个支援每回合 1 个行动」的共享预算）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CUSTOM_CHECKS = Object.freeze([
  { name: 'Armored Carapace', checks: 1, text: 'Summoned Servitor gains a health value of 3. It can be assigned damage dealt to any investigator at its location.' },
  { name: 'Claws that Catch', checks: 1, text: 'Add this action: "- Fight. You fight any enemy at this location with a base [combat] of 4. Ignore the aloof and retaliate keywords for this attack."' },
  { name: 'Jaws that Snatch', checks: 1, text: 'Add this action: "- Evade. You attempt to evade any enemy at this location with a base [agility] of 4. Ignore the alert keyword for this evasion attempt."' },
  { name: 'Eyes of Flame', checks: 1, text: 'Add this action: "- Investigate. You investigate this location with a base [intellect] of 4."' },
  { name: 'Wings of Night', checks: 1, text: 'After Summoned Servitor moves from your location to a connecting location, you may move to that location, as well.' },
  { name: 'Dominance', checks: 2, text: 'Summoned Servitor no longer takes up an (circle one): arcane / ally slot.' },
  { name: 'Dreaming Call', checks: 3, text: "Instead of discarding another asset you control in order to play Summoned Servitor, you may return that asset to its owner's hand." },
  { name: 'Dæmonic Influence', checks: 5, text: 'Summoned Servitor can take 2 different actions instead of 1 during each of your turns.' },
])

const checked = (state, inv, index) => {
  const list = state?.campaign?.tsk?.customizations?.bySeat?.[inv?.seat]?.['09080']
  return Array.isArray(list) && list.filter(value => value === index).length > 0
}

// 「可被弃掉来支付额外费用的另一个支援」：永久的支援不能被弃置（数据层读点）。
const discardableAssets = (state, inv) => (inv?.assets || []).filter(asset =>
  ALL_CARDS[asset.code]?.permanent !== true)

export default {
  code: '09080',
  simplified: true,
  note: 'approximation: 额外费用在 entersPlay 里用 api.discardAsset 支付（引擎打出费用管线未读 cost.discardControlledAsset，'
    + '声明式 cost 待主进程接线）；支援无独立 location，用附属到地点近似移动；'
    + '槽位覆盖/返回手牌费用/共享行动预算/Armored Carapace/Jaws 忽略警戒未实现，见 primitive-request/09080.json',
  customizationOptions: CUSTOM_CHECKS,
  // 打出条件：「必须能弃掉另一个支援」——引擎打出费用管线不读 cost 的 discardControlledAsset，
  // 这里用唯一可用性读点挡住「无支援可弃也打出」的情况。
  playCondition: [
    { when: ({ state, inv }) => discardableAssets(state, inv).length > 0,
      message: '「召来的仆从」需要弃掉另一个你控制的支援' },
  ],
  abilities: [
    {
      kind: 'entersPlay',
      entersPlay: {},
      label: '作为额外费用弃掉另一个支援；召来的仆从在你的地点入场',
      // 声明式费用：引擎打出管线未读（见文件头注释），保留给主进程接线。
      cost: { discardControlledAsset: 1 },
      resolve: ({ state, inv, source, api }) => {
        const candidates = discardableAssets(state, inv).filter(asset => asset !== source)
        if (!candidates.length) {
          api.info('「召来的仆从」：没有可以弃掉的另一个支援。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'discard-asset', source: '09080', seat: inv.seat,
          prompt: '「召来的仆从」：作为额外费用，弃掉你控制的另一个支援。',
          options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const paid = candidates.find(asset => asset.id === picked) || candidates[0]
        api.discardAsset(inv.seat, paid)
        api.info(`👁️ 「召来的仆从」：弃掉「${api.cardName(paid.code)}」作为额外费用，在你的地点入场。`)
      },
    },
    {
      kind: 'action',
      label: '移动召来的仆从到一个已揭示的连接地点',
      cost: { action: true },
      limit: 'oncePerTurn',
      target: {
        kind: 'location',
        query: ({ state, inv, candidate }) => {
          const here = state.locations.find(location => location.id === inv.location)
          return Boolean(here?.connections?.includes(candidate.id) && candidate.entity.revealed !== false)
        },
      },
      resolve: ({ state, inv, source, target, api }) => {
        if (!source || !target?.entity) return
        const destination = target.entity.id
        const attached = api.attachSelfToLocation(source, destination)
        if (!attached) {
          api.info('「召来的仆从」：无法移动到该地点。')
          return
        }
        api.info(`👁️ 「召来的仆从」移动到「${target.entity.name || destination}」。`)
        if (checked(state, inv, 4)) {
          const answer = api.choice({
            kind: 'reaction', source: '09080', seat: inv.seat, canSkip: true,
            prompt: '黑翼如夜：是否也移动到该地点？',
            options: [{ id: 'move', label: '一起移动' }, { id: 'skip', label: '留在原地' }],
          })
          if (answer === 'move') api.moveInvestigator(inv.seat, destination)
        }
      },
    },
    {
      kind: 'action',
      label: '利爪如钩：以基础战斗值 4 攻击此地点的任意敌人（忽略冷漠/反击）',
      cost: { action: true },
      limit: 'oncePerTurn',
      target: { kind: 'enemy' },
      criteria: [({ state, inv }) => checked(state, inv, 1)],
      resolve: ({ inv, target, api }) => {
        if (!target?.entity) return
        api.fight(inv.seat, target.entity.id, { baseValue: 4, noSpend: true, ignoreAloof: true, ignoreRetaliate: true })
      },
    },
    {
      kind: 'action',
      label: '巨口如网：以基础敏捷值 4 躲避此地点的任意敌人（忽略警戒）',
      cost: { action: true },
      limit: 'oncePerTurn',
      target: { kind: 'enemy' },
      criteria: [({ state, inv }) => checked(state, inv, 2)],
      resolve: ({ inv, target, api }) => {
        if (!target?.entity) return
        api.engage(target.entity, inv.seat)
        api.evade(inv.seat, { enemyId: target.entity.id, baseValue: 4 })
      },
    },
    {
      kind: 'action',
      label: '亮眼如火：以基础智识值 4 调查此地点',
      cost: { action: true },
      limit: 'oncePerTurn',
      criteria: [({ state, inv }) => checked(state, inv, 3)],
      resolve: ({ inv, api }) => {
        api.investigate(inv.seat, { baseValue: 4 })
      },
    },
  ],
  modifiers: [],
}
