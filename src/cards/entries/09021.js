// 09021 猎人护甲（Hunter's Armor）· 守卫者资产 · 0 经验 · 定制。
// 卡面：定制。（身体槽；生命 2 / 神智 2；费用 4）
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 定制口径（勾选面板契约由条目静态声明，注册期登记到 tsk-customizable 原语）：
//   · 已勾选可判定项在运行时用 customizationChecked(state, seat, code) 读，不新造状态字段；
//   · 费用修正有两个读点：customizationEffects.playCost（面板/审计契约）与条目 playCostModifier
//     （turn-flow.js#playCost 的真实读点，本卡用后者让「-1 费用」真的生效）。
// 已实现：Lightweight（-1 费用，真实读点）、Enchanted 的 [[Relic]] 特性授予（add:trait 修正）、
//         Hexdrinker / Armor of Thorns 的横置反应（窗口 assetHarmPlaced / enemyAttackDamage）。
// approximation：① Enchanted 的「改占奥秘槽而非身体槽」没有实例级槽位改写读点（槽位只认
//   card-defs 的印刷 slots），只实现特性授予；② Durable/Hallowed 的「+2 生命 / +2 神智」没有
//   支援实例生命/神智修正读点（assetCapacityValue 只读 cardDef），未实现；③ Protective Runes 的
//   「可承接同地点其他调查员的伤害/恐惧」走条目 passive.assignHarmAtLocation 是**无条件**声明，
//   无法只对已勾选生效，因此未声明（否则未勾选也会生效）。三项均见
//   artifacts/migration/tsk/primitive-requests/09021.json。
import { customizationChecked } from '../../engine/tsk-customizable.js'

const SOURCE = '09021'
const isChecked = (state, inv, index) => customizationChecked(state, inv?.seat ?? state.currentSeat, SOURCE).includes(index)
const armorOf = inv => (inv?.assets || []).find(card => card.code === SOURCE) || null

export default {
  code: '09021',
  note: 'approximation: Enchanted 未改槽位（只授予 Relic）；Durable/Hallowed 的 +2 生命/+2 神智与 Protective Runes 的跨调查员承接未实现（缺实例级读点，见 primitive-requests/09021.json）',
  customizationOptions: [
    { name: 'Enchanted', checks: 1, text: 'Hunter\'s Armor gains the [[Relic]] trait and takes up an arcane slot instead of a body slot.' },
    { name: 'Protective Runes', checks: 2, text: 'Hunter\'s Armor may be assigned damage and/or horror dealt to other investigators at your location.' },
    { name: 'Durable', checks: 2, text: 'Hunter\'s Armor gains +2 health.' },
    { name: 'Hallowed', checks: 2, text: 'Hunter\'s Armor gains +2 sanity.' },
    { name: 'Lightweight', checks: 2, text: 'Hunter\'s Armor gets -1 cost and playing it does not provoke attacks of opportunity.' },
    { name: 'Hexdrinker', checks: 3, text: 'After 1 or more damage or horror is assigned to Hunter\'s Armor from a treachery effect, you may exhaust it to draw 1 card.' },
    { name: 'Armor of Thorns', checks: 3, text: 'After 1 or more damage or horror is assigned to Hunter\'s Armor from an enemy attack, you may exhaust it to deal 1 damage to that enemy.' },
  ],
  customizationEffects: {
    playCost: checked => (checked || []).filter(index => index === 4).length ? -1 : 0,
  },
  playCostModifier: ({ state, inv }) => (isChecked(state, inv, 4) ? -1 : 0),
  modifiers: [
    // Enchanted：运行期授予 [[Relic]] 特性（授予修正只作用于声明它的这张卡）。
    { target: 'add:trait', value: 'Relic', condition: { when: ({ state, inv }) => isChecked(state, inv, 0) } },
  ],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetHarmPlaced',
      label: '折磨之饮（Hexdrinker）：护甲被分配到伤害/恐惧后横置，抽 1 张牌',
      cost: { exhaust: true },
      criteria: [({ state, inv, context }) => {
        const armor = armorOf(inv)
        return Boolean(armor) && isChecked(state, inv, 5)
          && context?.assetId === armor.id
          && ((context.damage || 0) + (context.horror || 0)) > 0
      }],
      resolve: ({ inv, api }) => {
        api.drawCards(inv.seat, 1)
        api.info('「猎人护甲」被击中，抽 1 张牌。')
      },
    },
    {
      kind: 'reaction',
      trigger: 'enemyAttackDamage',
      label: '荆棘之甲（Armor of Thorns）：护甲被敌人攻击伤害后横置，对攻击者造成 1 点伤害',
      cost: { exhaust: true },
      criteria: [({ state, inv, context }) => {
        const armor = armorOf(inv)
        if (!armor || !isChecked(state, inv, 6)) return false
        if (!context?.enemy) return false
        return (context.damagedAssetIds || []).includes(armor.id)
      }],
      resolve: ({ inv, context, api }) => {
        api.damageEnemy(context.enemy, 1, inv.seat, { code: SOURCE })
        api.info(`「猎人护甲」的荆棘刺伤了「${context.enemy.name}」。`)
      },
    },
  ],
}
