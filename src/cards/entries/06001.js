// 06001 托米·马尔登
// 卡面：[reaction]在你控制的一个支援被击败时：获得 X 资源，其中 X 等于该支援上的伤害和恐惧总和。
//       将该支援混洗回你的牌库。
// 卡面：[elder_sign] 效果：+2。你可以将托米·马尔登上的总计最多 2 点伤害和/或恐惧移动到你控制的
//       一个支援上，或者将你控制的一个支援上的总计最多 2 点伤害和/或恐惧移动到托米·马尔登。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 主能力挂在 P6 原语 `assetDefeated` 窗口上（src/engine/asset-defeat.js）——支援被击败的
//     唯一判定点；`context.shuffledIntoDeck` 是「改为洗回牌库」的通用出口。
//   · 旧印的位移走 `api.moveHarm`（src/engine/harm-transfer.js），支援达到上限由同一判定点处理。
//   · 贝基：从本能力获得的资源可以改为放在贝基上作为子弹（`api.addUses`）。

export default {
  code: '06001',
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 2, moveHarmUpTo: 2 },
  },
  elderSign: {
    id: '06001-eldersign',
    label: '旧印：+2，可移动最多 2 点伤害/恐惧',
    resolve: ({ inv, api }) => {
      const bonus = 2
      const limit = 2
      const assets = (inv.assets || []).filter(asset => api.cardType(asset.code) === 'asset')
      if (!assets.length) return { delta: bonus }
      const options = []
      for (const asset of assets) {
        const room = api.harmRoomOf({ seat: inv.seat, assetId: asset.id })
        const onCard = { damage: asset.damage || 0, horror: asset.horror || 0 }
        if (room.damage > 0 || room.horror > 0) {
          options.push({ id: `to:${asset.id}`, label: `把托米身上的伤害/恐惧移到「${api.cardName(asset.code)}」` })
        }
        if (onCard.damage > 0 || onCard.horror > 0) {
          options.push({ id: `from:${asset.id}`, label: `把「${api.cardName(asset.code)}」身上的伤害/恐惧移到托米` })
        }
      }
      if (!options.length) return { delta: bonus }
      const answer = api.choice({
        kind: 'effect', source: 'tommyElderSign', seat: inv.seat, canSkip: true,
        prompt: `旧印：移动最多 ${limit} 点伤害/恐惧（或跳过，只保留 +${bonus}）。`,
        options: [{ id: 'skip', label: '不移动' }, ...options],
      })
      if (answer === 'skip') return { delta: bonus }
      const [direction, assetId] = String(answer).split(':')
      const asset = assets.find(item => item.id === assetId)
      if (!asset) return { delta: bonus }
      const sourceRoom = api.harmRoomOf({ seat: inv.seat, assetId: direction === 'from' ? assetId : undefined })
      const targetRoom = api.harmRoomOf({ seat: inv.seat, assetId: direction === 'to' ? assetId : undefined })
      const source = direction === 'to'
        ? { damage: inv.damage || 0, horror: inv.horror || 0 }
        : { damage: asset.damage || 0, horror: asset.horror || 0 }
      const room = direction === 'to' ? targetRoom : sourceRoom
      const combos = []
      for (let damage = 0; damage <= limit; damage++) {
        for (let horror = 0; damage + horror <= limit; horror++) {
          if (!damage && !horror) continue
          if (damage > source.damage || horror > source.horror) continue
          if (damage > room.damage || horror > room.horror) continue
          combos.push({ damage, horror })
        }
      }
      if (!combos.length) return { delta: bonus }
      const label = combo => [combo.damage ? `${combo.damage} 点伤害` : '', combo.horror ? `${combo.horror} 点恐惧` : '']
        .filter(Boolean).join(' + ')
      const amountId = combos.length === 1 ? { id: '0' } : api.choice({
        kind: 'effect', source: 'tommyElderSignAmount', seat: inv.seat,
        prompt: '旧印：选择移动的伤害/恐惧数量。',
        options: combos.map((combo, index) => ({ id: String(index), label: label(combo) })),
      })
      const combo = combos[Number(amountId)]
      if (!combo) return { delta: bonus }
      const target = direction === 'to' ? { seat: inv.seat, assetId } : { seat: inv.seat }
      const from = direction === 'to' ? { seat: inv.seat } : { seat: inv.seat, assetId }
      api.moveHarm(from, target, combo)
      return { delta: bonus }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetDefeated',
      id: 'tommyAssetDefeated',
      label: '你控制的支援被击败时：获得 X 资源并洗回牌库',
      criteria: [({ inv, context }) => context?.ownerSeat === inv.seat],
      // 一次击败只询问一次；X 只按这张支援上的伤害/恐惧总和算。
      limit: { scope: 'perWindow', owner: 'instance' },
      resolve: ({ inv, context, api }) => {
        const total = Math.max(0, (context?.damage || 0) + (context?.horror || 0))
        const becky = (inv.assets || []).find(asset => asset.code === '06006')
        if (becky && total > 0) {
          const answer = api.choice({
            kind: 'effect', source: 'tommyReaction', seat: inv.seat,
            prompt: `获得 ${total} 资源，或把其中任意数量放在贝基上作为子弹？`,
            options: [
              { id: 'resources', label: `获得 ${total} 资源` },
              { id: 'ammo', label: `把 ${total} 资源放到贝基上（作为子弹）` },
            ],
          })
          if (answer === 'ammo') api.addUses(becky, total)
          else api.gainResources(inv.seat, total)
        } else {
          api.gainResources(inv.seat, total)
        }
        // 「将该支援洗回你的牌库」：引擎在 asset-defeat 里读这个标记决定去向。
        context.shuffledIntoDeck = true
        api.info(`${inv.name} 因「${api.cardName(context.assetCode)}」被击败获得 ${total} 资源，并将其洗回牌库。`)
      },
    },
  ],
  modifiers: [],
}
