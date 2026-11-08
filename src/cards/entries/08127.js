// 08127 雪橇犬（Sled Dog）
// 卡面：你的牌库中可以有至多 4 张雪橇犬。1 个盟友槽位可以有至多 2 张雪橇犬。
// [action] 横置 X 张雪橇犬：移动。移动 X 次。
// [action] 横置 X 张雪橇犬：攻击。你本次攻击得到 +X[combat]。本次攻击不造成基础伤害，改为造成 X 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「2 张共占 1 个盟友槽」= 引擎既有 sharedSlotGroup（06241–06243 同一原语）；
//   · 横置任意数量同名狗：api.exhaust；移动走 api.moveInvestigator；攻击走 api.fight（combatBonus/damageBonus）。
const code = '08127'

function readySledDogs(inv) {
  return (inv.assets || []).filter(item => item.code === code && !item.exhausted)
}

// 横置 X 张雪橇犬（消耗来源自身 + 其它已就绪的同名狗；同名卡无差别，交给引擎记账）。
function exhaustDogs(inv, source, count, api) {
  const dogs = [source, ...readySledDogs(inv).filter(item => item !== source)].slice(0, Math.max(1, count))
  for (const dog of dogs) api.exhaust(dog)
  return dogs.length
}

// X 只能取 1..已就绪数量；只有 1 张时不再询问。
function chooseDogCount(inv, api) {
  const ready = readySledDogs(inv).length
  if (ready <= 1) return Math.max(0, Math.min(1, ready))
  const answer = Number(api.choice({
    kind: 'amount', source: code, seat: inv.seat,
    prompt: `雪橇犬：横置几张（1–${ready}）？`,
    options: Array.from({ length: ready }, (_, index) => ({
      id: String(index + 1), label: `横置 ${index + 1} 张雪橇犬`,
    })),
  }))
  return Math.max(1, Math.min(ready, Number.isSafeInteger(answer) ? answer : 1))
}

export default {
  code,
  sharedSlotGroup: { id: 'sledDog', slot: 'ally', upTo: 2 },
  abilities: [
    {
      kind: 'action',
      label: '横置 X 张雪橇犬：移动 X 次',
      countsAs: 'move',
      cost: { action: true },
      criteria: [({ inv, source }) => !source?.exhausted && readySledDogs(inv).length > 0],
      resolve: ({ state, inv, source, api }) => {
        const count = chooseDogCount(inv, api)
        if (!count) return
        exhaustDogs(inv, source, count, api)
        for (let step = 0; step < count; step++) {
          const here = state.locations.find(location => location.id === inv.location)
          const destinations = (here?.connections || [])
            .map(id => state.locations.find(location => location.id === id))
            .filter(Boolean)
          if (!destinations.length) break
          const destination = destinations.length === 1 ? destinations[0].id : api.choice({
            kind: 'move', source: code, seat: inv.seat,
            prompt: `雪橇犬：第 ${step + 1} 次移动，选择目的地。`,
            options: destinations.map(location => ({ id: location.id, label: location.name || location.id })),
          })
          if (!destination) break
          api.moveInvestigator(inv.seat, destination)
        }
        api.info(`🛷 「雪橇犬」：${inv.name} 横置 ${count} 张雪橇犬并移动了 ${count} 次。`)
      },
    },
    {
      kind: 'action',
      label: '横置 X 张雪橇犬：攻击，+X 战斗并造成 X 点伤害',
      countsAs: 'fight',
      cost: { action: true },
      criteria: [({ inv, source }) => !source?.exhausted && readySledDogs(inv).length > 0],
      target: { kind: 'enemy' },
      resolve: ({ inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        const count = chooseDogCount(inv, api)
        if (!count) return
        exhaustDogs(inv, source, count, api)
        api.fight(inv.seat, enemy.id, {
          combatBonus: count,
          damageBonus: count - 1,
          sourceCode: code,
          noSpend: true,
        })
      },
    },
  ],
  modifiers: [],
}
