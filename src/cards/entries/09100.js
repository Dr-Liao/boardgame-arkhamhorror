// 09100 简易陷阱（Makeshift Trap）· 幸存者事件 · 0 经验 · 定制。
// 卡面：定制。使用(2 计时)。如果简易陷阱没有计时，将其弃掉。附属到你所在地点。
//       附属地点的每个非[[精英]]敌人得到 -1 攻击和 -1 躲避。
//       强制 - 当一轮结束时：移除简易陷阱的 1 计时。
//
// 读点：becomesAsset + api.putSelfIntoPlay 把这张事件变成场上卡（04199 同一原语）；
//       uses/usesType/discardWhenEmpty（实例 + 描述子结算后的统一弃置读点）；
//       forced roundEnds + api.spendUses；带毒/爆炸装置在强制结算里追加伤害。
//
// approximation（已写 primitive-request/09100.json）：
//   · 引擎的玩家支援没有 location 字段，也没有「地点附属上的敌方修正」读点；本实现把陷阱
//     当作随你移动的场上卡，「附属地点敌人 -1 攻击/-1 躲避」与远程布置/束网未实现（note）。
//   · Simple（获得快速）是静态关键字，定制项无法在运行期开关，未实现。
const CUSTOM_CHECKS = Object.freeze([
  { name: 'Improved Timer', checks: 1, text: 'When you play Makeshift Trap, you may increase or decrease its uses by 1.' },
  { name: 'Tripwire', checks: 1, text: "Only trigger Makeshift Trap's forced ability if there are 1 or more enemies at attached location." },
  { name: 'Simple', checks: 2, text: 'Makeshift Trap gains fast and "play during any [fast] window."' },
  { name: 'Poisonous', checks: 2, text: 'When you remove 1 or more time from Makeshift Trap, deal 1 damage to an enemy at attached location.' },
  { name: 'Remote Configuration', checks: 2, text: 'When you play Makeshift Trap, you may attach it to a revealed connecting location.' },
  { name: 'Net', checks: 3, text: 'Non-[[Elite]] enemies at attached location cannot move or make attacks of opportunity.' },
  { name: 'Explosive Device', checks: 4, text: 'When Makeshift Trap has no time and is discarded, deal 3 damage to each enemy and investigator at attached location.' },
])

const checked = (state, inv, index) => {
  const list = state?.campaign?.tsk?.customizations?.bySeat?.[inv?.seat]?.['09100']
  return Array.isArray(list) && list.filter(value => value === index).length > 0
}

export default {
  code: '09100',
  simplified: true,
  note: 'approximation: 见 primitive-request/09100.json（地点附属敌方修正/远程布置/束网/静态快速未实现；陷阱按随你的场上卡近似）',
  uses: 2,
  usesType: 'time',
  discardWhenEmpty: true,
  customizationOptions: CUSTOM_CHECKS,
  abilities: [
    {
      kind: 'played',
      becomesAsset: true,
      label: '以 2 计时入场（可调整 1 点）；没有计时时弃掉',
      resolve: ({ state, inv, api }) => {
        const asset = api.putSelfIntoPlay(inv.seat, '09100')
        if (!asset) return
        api.setUsesType(asset, 'time')
        let uses = 2
        if (checked(state, inv, 0)) {
          const answer = api.choice({
            kind: 'effect', source: '09100', seat: inv.seat,
            prompt: '优化计时器：增加还是降低 1 点计时？',
            options: [{ id: 'increase', label: '增加 1 点计时' }, { id: 'decrease', label: '降低 1 点计时' }],
          })
          uses += answer === 'decrease' ? -1 : 1
        }
        api.setAssetUses(asset, Math.max(0, uses))
        api.info(`🪤 「简易陷阱」以 ${asset.uses} 计时入场。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'roundEnds',
      label: '一轮结束时：移除 1 计时；带毒/爆炸装置追加伤害',
      criteria: [({ state, inv, source }) => {
        if (!source || (source.uses || 0) <= 0) return false
        if (checked(state, inv, 1)) return state.enemies.some(enemy => enemy.location === inv.location)
        return true
      }],
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        api.spendUses(source, 1)
        const enemies = state.enemies.filter(enemy => enemy.location === inv.location)
        if (checked(state, inv, 3) && enemies.length) {
          const picked = enemies.length === 1 ? enemies[0] : enemies.find(enemy => enemy.id === api.choice({
            kind: 'target', source: '09100', seat: inv.seat, prompt: '带毒：选择一个受到 1 点伤害的敌人。',
            options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
          })) || enemies[0]
          api.damageEnemy(picked, 1, inv.seat, { code: '09100' })
          api.info(`☠️ 「简易陷阱」：带毒对「${picked.name || picked.code}」造成 1 点伤害。`)
        }
        if ((source.uses || 0) <= 0 && checked(state, inv, 6)) {
          for (const enemy of state.enemies.filter(item => item.location === inv.location)) {
            api.damageEnemy(enemy, 3, inv.seat, { code: '09100' })
          }
          for (const other of api.investigatorsAt(inv.location)) api.damage(other.seat, 3)
          api.info('💣 「简易陷阱」：爆炸装置对地点内每个敌人与调查员造成 3 点伤害。')
        }
        api.info('🪤 「简易陷阱」：移除 1 计时。')
      },
    },
  ],
  modifiers: [],
}
