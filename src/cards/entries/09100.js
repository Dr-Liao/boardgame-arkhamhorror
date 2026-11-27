// 09100 简易陷阱（Makeshift Trap）· 幸存者事件 · 0 经验 · 定制。
// 卡面：定制。使用(2 计时)。如果简易陷阱没有计时，将其弃掉。附属到你所在地点。
//       附属地点的每个非[[精英]]敌人得到 -1 攻击和 -1 躲避。
//       强制 - 当一轮结束时：移除简易陷阱的 1 计时。
//
// 陷阱附属到实际地点。计时、当地敌人数值与束网规则均从附属实例读取。
const CUSTOM_CHECKS = Object.freeze([
  { name: 'Improved Timer', checks: 1, text: 'When you play Makeshift Trap, you may increase or decrease its uses by 1.' },
  { name: 'Tripwire', checks: 1, text: "Only trigger Makeshift Trap's forced ability if there are 1 or more enemies at attached location." },
  { name: 'Simple', checks: 2, text: 'Makeshift Trap gains fast and "play during any [fast] window."' },
  { name: 'Poisonous', checks: 2, text: 'When you remove 1 or more time from Makeshift Trap, deal 1 damage to an enemy at attached location.' },
  { name: 'Remote Configuration', checks: 2, text: 'When you play Makeshift Trap, you may attach it to a revealed connecting location.' },
  { name: 'Net', checks: 3, text: 'Non-[[Elite]] enemies at attached location cannot move or make attacks of opportunity.' },
  { name: 'Explosive Device', checks: 4, text: 'When Makeshift Trap has no time and is discarded, deal 3 damage to each enemy and investigator at attached location.' },
])

// 2026-11-16 P2-3：Poisonous（2 格）与 Explosive Device（4 格）必须勾满才生效；Improved Timer/Tripwire 为 1 格。
import { customizationOptionFullyChecked } from '../../engine/tsk-customizable.js'

const checked = (state, inv, index) =>
  customizationOptionFullyChecked(state, inv?.seat, '09100', index)

export default {
  code: '09100',
  uses: 2,
  usesType: 'time',
  assetRule: { ownerLocationAttachmentAbility: true },
  discardWhenEmpty: true,
  customizationOptions: CUSTOM_CHECKS,
  customizationEffects: { fast: checked => (checked || []).filter(index => index === 2).length >= 2 },
  abilities: [
    {
      kind: 'played',
      becomesAsset: true,
      label: '以 2 计时入场（可调整 1 点）；没有计时时弃掉',
      resolve: ({ state, inv, api }) => {
        const current = state.locations.find(location => location.id === inv.location)
        if (!current) return
        const locations = [current, ...(checked(state, inv, 4)
          ? state.locations.filter(location => location.revealed && current.connections?.includes(location.id)) : [])]
        const locationId = locations.length === 1 ? current.id : api.choice({
          kind: 'location', source: '09100', seat: inv.seat, prompt: '选择布置陷阱的地点。',
          options: locations.map(location => ({ id: location.id, label: location.name })),
        })
        let uses = 2
        if (checked(state, inv, 0)) {
          const answer = api.choice({
            kind: 'effect', source: '09100', seat: inv.seat,
            prompt: '优化计时器：增加还是降低 1 点计时？',
            options: [{ id: 'same', label: '不更改计时' },
              { id: 'increase', label: '增加 1 点计时' }, { id: 'decrease', label: '降低 1 点计时' }],
          })
          uses += answer === 'decrease' ? -1 : answer === 'increase' ? 1 : 0
        }
        const net = checked(state, inv, 5)
        api.placePlayerLocationAttachment(inv.seat, '09100', locationId, { uses, usesType: 'time',
          nonEliteOnly: true, blocksEnemyMove: net, blocksEnemyOpportunityAttack: net,
        })
        api.info(`🪤 「简易陷阱」以 ${uses} 计时入场。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'roundEnds',
      label: '一轮结束时：移除 1 计时；带毒/爆炸装置追加伤害',
      criteria: [({ state, inv, source }) => {
        if (!source || (source.uses || 0) <= 0) return false
        if (checked(state, inv, 1)) return state.enemies.some(enemy => enemy.location === source.location)
        return true
      }],
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        if (!api.spendPlayerLocationAttachmentUses(source, 1)) return
        const enemies = state.enemies.filter(enemy => enemy.location === source.location)
        if (checked(state, inv, 3) && enemies.length) {
          const picked = enemies.length === 1 ? enemies[0] : enemies.find(enemy => enemy.id === api.choice({
            kind: 'target', source: '09100', seat: inv.seat, prompt: '带毒：选择一个受到 1 点伤害的敌人。',
            options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
          })) || enemies[0]
          api.damageEnemy(picked, 1, inv.seat, { code: '09100' })
          api.info(`☠️ 「简易陷阱」：带毒对「${picked.name || picked.code}」造成 1 点伤害。`)
        }
        if ((source.uses || 0) <= 0 && api.discardPlayerAttachment(source) && checked(state, inv, 6)) {
          for (const enemy of state.enemies.filter(item => item.location === source.location)) {
            api.damageEnemy(enemy, 3, inv.seat, { code: '09100' })
          }
          for (const other of api.investigatorsAt(source.location)) api.damage(other.seat, 3)
          api.info('💣 「简易陷阱」：爆炸装置对地点内每个敌人与调查员造成 3 点伤害。')
        }
        api.info('🪤 「简易陷阱」：移除 1 计时。')
      },
    },
  ],
  modifiers: ['enemyFight', 'enemyEvade'].map(target => ({ target, amount: -1 })),
}
