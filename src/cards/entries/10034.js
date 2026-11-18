// 10034 蒙福之刃（Blessed Blade）· 守护者支援 · 4 经验 · 3 资源 · 手部 · 道具/武器/近战/祝福
// 卡面：[action]：攻击。你本次检定得到 +2[combat]。如果本次攻击成功，造成 +1 伤害。
//       将本次攻击期间揭示的每个[bless]标记返回混乱袋。
//       在本次攻击揭示混乱标记前，你可以横置蒙福之刃以在混乱袋中加入 2 个[bless]标记。
//
// 读点（卡面 → 引擎）：
//   · 主动攻击 = kind:'action' + countsAs:'fight' + target:{kind:'enemy'} + cost.action；
//     加值与伤害 = api.fight(seat, enemyId, { combatBonus: 2, damageBonus: 1 })
//     （damageBonus 只在攻击成功时并入，与卡面「如果成功」同口径）。
//   · 「揭示前可以横置并加入 2 个[bless]」= resolve 内先询问，再用 api.exhaust（唯一横置写点，
//     会派发 assetExhausted 窗口）与 api.addChaosToken('bless') ×2。
//   · 「将本次攻击期间揭示的每个[bless]返回混乱袋」= 战斗返回后数 api.fight 结果里的 drawn，
//     再逐个 api.addChaosToken('bless')。引擎在 endChaosTest 会消耗已揭示的 bless（chaos-bag.js），
//     因此这里等于把被消耗的祝福放回袋中（其他调查员的祝福不受影响）。
const CODE = '10034'
const BLESS = 'bless'

function optionalBlessings({ source, inv, api }) {
  if (!source || source.exhausted) return
  const pick = api.choice({
    kind: 'effect', source: CODE, seat: inv.seat,
    prompt: '蒙福之刃：揭示混乱标记前是否横置，在混乱袋中加入 2 个祝福标记？',
    options: [{ id: 'skip', label: '不横置' }, { id: 'exhaust', label: '横置并加入 2 个祝福标记' }],
  })
  if (pick !== 'exhaust') return
  api.exhaust(source)
  api.addChaosToken(BLESS)
  api.addChaosToken(BLESS)
  api.info('🗡 蒙福之刃：横置并在混乱袋中加入 2 个祝福标记。')
}

function attack({ inv, source, target, api }) {
  const enemy = target?.entity
  if (!enemy) return
  optionalBlessings({ source, inv, api })
  const result = api.fight(inv.seat, enemy.id, { combatBonus: 2, damageBonus: 1 })
  const revealed = (result?.drawn || []).filter(token => token === BLESS).length
  for (let index = 0; index < revealed; index += 1) api.addChaosToken(BLESS)
  if (revealed) api.info(`🗡 蒙福之刃：本次攻击揭示的 ${revealed} 个祝福标记返回混乱袋。`)
}

export default {
  code: CODE,
  name: 'Blessed Blade',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      cost: { action: true },
      label: '攻击：战斗 +2、伤害 +1；揭示的祝福标记返回混乱袋（可横置预加 2 祝福）',
      resolve: attack,
    },
  ],
  modifiers: [],
}
