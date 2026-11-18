// 10027 特遣队（Task Force）· 守卫者事件 · 2 资源 · 策略/双重（Double）
// 卡面：作为打出特遣队的额外费用，花费一个行动。选择你所在地点的一位调查员按任意顺序依次……
//       - ……结算其控制的支援上的一个 [action] 能力，不支付其 [action] 费用。
//       - ……移动到一个连接地点。
//       - ……发现其所在地点的 1 个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · Double 的额外行动费用：played 描述子 `cost: { action: 1 }`（ability.js#playedActionCost；
//     legalMoves / validateMove / doPlay 三处同源校验并在支付资源后扣减，卡面 resolve 不重复实现）。
//   · 三项「一一次、任意顺序」：用 api.choice 让玩家逐项选择顺序（剩余项即候选），选项是三种子句。
//   · 每项都要先选「你所在地点的一位调查员」（同地点、未败/未撤退）；同一人可被选多次（卡面没有
//     「不同调查员」限制）。
//   · 结算 [action] 能力且不付 [action] 费用：`api.cardAbilityOptions(seat, asset,
//     { ignoreActionCost: true, actionOnly: true })` + `api.resolveAssetAction(seat, { assetId,
//     abilityIndex, waive: 'action' })`（api-card.js 的唯一读点：waive 'action' = 只免行动费，
//     资源/使用次数等仍由该调查员支付）。
//   · 移动：`api.moveInvestigator(seat, locationId)`（移动管线唯一入口，走地点入场/交战窗口）。
//   · 发现线索：`api.discoverClue(seat, 1)`（发现线索的唯一入口，按该调查员所在地点结算；无线索时
//     原语自身返回 0）。
const CODE = '10027'
const BULLETS = [
  { id: 'ability', label: '结算其控制的一个 [action] 能力（不支付 [action] 费用）' },
  { id: 'move', label: '移动到一个连接地点' },
  { id: 'clue', label: '发现其所在地点的 1 个线索' },
]

const investigatorsHere = (state, location) => (state.investigators || [])
  .filter(other => !other.defeated && !other.resigned && other.location === location)

export default {
  code: CODE,
  name: 'Task Force',
  abilities: [
    {
      kind: 'played',
      cost: { action: 1 },
      label: '额外花费 1 行动：按任意顺序让同地点调查员结算[action]能力 / 移动 / 发现线索',
      resolve: ({ state, inv, api }) => {
        const remaining = [...BULLETS]
        while (remaining.length) {
          const bulletId = remaining.length === 1 ? remaining[0].id : api.choice({
            kind: 'effect', source: CODE, seat: inv.seat,
            prompt: `特遣队：选择接下来结算哪一项（剩余：${remaining.map(row => row.label).join('；')}）。`,
            options: remaining.map(row => ({ id: row.id, label: row.label })),
          })
          const bullet = remaining.find(row => row.id === bulletId) || remaining[0]
          remaining.splice(remaining.indexOf(bullet), 1)
          const colleagues = investigatorsHere(state, inv.location)
          if (!colleagues.length) {
            api.info('「特遣队」：你所在地点没有其他调查员。')
            continue
          }
          const seatAnswer = colleagues.length === 1 ? String(colleagues[0].seat) : api.choice({
            kind: 'investigator', source: CODE, seat: inv.seat,
            prompt: `特遣队：选择要「${bullet.label}」的调查员。`,
            options: colleagues.map(other => ({ id: String(other.seat), label: other.name || `调查员 ${other.seat + 1}` })),
          })
          const actor = colleagues.find(other => String(other.seat) === String(seatAnswer)) || colleagues[0]
          if (bullet.id === 'ability') resolveActionAbility(api, actor, inv)
          else if (bullet.id === 'move') moveToConnectingLocation(state, api, actor, inv)
          else discoverClueAtActor(api, actor)
        }
      },
    },
  ],
  modifiers: [],
}

function resolveActionAbility(api, actor, lead) {
  const rows = []
  for (const asset of actor.assets || []) {
    const options = api.cardAbilityOptions(actor.seat, asset, { ignoreActionCost: true, actionOnly: true })
    for (const option of options) rows.push({ asset, option })
  }
  if (!rows.length) {
    api.info(`「特遣队」：${actor.name} 没有可结算的 [action] 能力。`)
    return
  }
  let row = rows[0]
  if (rows.length > 1) {
    const picked = api.choice({
      kind: 'ability', source: CODE, seat: lead.seat,
      prompt: `特遣队：选择 ${actor.name} 要结算的 [action] 能力。`,
      options: rows.map((item, index) => ({ id: String(index), label: `${api.cardName(item.asset.code)}：${item.option.label}` })),
    })
    row = rows[Number(picked)] || rows[0]
  }
  const resolved = api.resolveAssetAction(actor.seat, {
    assetId: row.asset.id, abilityIndex: row.option.index, waive: 'action',
  })
  if (resolved) api.info(`🎖️ 特遣队：${actor.name} 结算「${api.cardName(row.asset.code)}」的 [action] 能力（不付行动费）。`)
  else api.info(`「特遣队」：「${api.cardName(row.asset.code)}」的能力当前不能结算。`)
}

function moveToConnectingLocation(state, api, actor, lead) {
  const here = (state.locations || []).find(location => location.id === actor.location)
  const destinations = [...(here?.connections || [])]
  if (!destinations.length) {
    api.info(`「特遣队」：${actor.name} 所在地点没有连接地点。`)
    return
  }
  const picked = destinations.length === 1 ? destinations[0] : api.choice({
    kind: 'location', source: CODE, seat: lead.seat,
    prompt: `特遣队：选择 ${actor.name} 要移动到的连接地点。`,
    options: destinations.map(id => ({ id, label: api.locName(id) })),
  })
  const destination = destinations.includes(picked) ? picked : destinations[0]
  api.moveInvestigator(actor.seat, destination)
  api.info(`🎖️ 特遣队：${actor.name} 移动到「${api.locName(destination)}」。`)
}

function discoverClueAtActor(api, actor) {
  const found = api.discoverClue(actor.seat, 1)
  api.info(`🎖️ 特遣队：${actor.name} 在其地点发现 ${found || 0} 个线索。`)
}
