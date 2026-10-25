// 05110 水落石出
// 卡面：快速。一位调查员发现你所在地点的最后一个线索后打出。
// 卡面：位于该地点的调查员获得总计X资源，由你自行分配。X为该地点的隐藏值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：快速事件挂在 clueDiscovered 窗口上（played + fast + trigger，与 01022 证据！同一写法）。
// 窗口上下文带 location / lastClue / shroud（src/engine/locations.js 的 discoverClueAt），
// 因此「最后一个线索」与 X=隐藏值都直接读上下文；资源分配逐点询问接收者。

export default {
  code: '05110',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'clueDiscovered',
      criteria: [ctx => ctx.context?.location === ctx.inv?.location && ctx.context?.lastClue === true],
      label: '水落石出：该地点调查员分配 X 资源',
      resolve: ({ state, inv, context, api }) => {
        const location = state.locations.find(entry => entry.id === context?.location)
        if (!location || context?.lastClue !== true) {
          api.info('只有在一位调查员发现你所在地点最后一个线索后，才能打出水落石出。')
          return
        }
        // R5：用引擎的完整「当前隐藏值」读点（含 shroudMod/雾/剧本与地点修正）。
      const X = Math.max(0, Number(api.locationShroud?.(location.id) ?? context.shroud ?? location.shroud) || 0)
        const recipients = state.investigators.filter(other => !other.defeated && !other.resigned
          && other.location === location.id)
        if (!recipients.length || !X) {
          api.info(`水落石出：该地点没有可分配资源的调查员（X=${X}）。`)
          return
        }
        if (recipients.length === 1) {
          api.gainResources(recipients[0].seat, X)
          api.info(`水落石出：${recipients[0].name} 获得 ${X} 资源（X=隐藏值）。`)
          return
        }
        // 由打出者自行分配：每 1 点资源选一位位于该地点的调查员。
        for (let i = 0; i < X; i++) {
          const seat = Number(api.choice({ kind: 'investigator', source: '05110', seat: inv.seat,
            prompt: `水落石出：分配第 ${i + 1}/${X} 点资源给位于该地点的调查员。`,
            options: recipients.map(other => ({ id: String(other.seat), label: other.name })) }))
          const target = recipients.find(other => other.seat === seat) || recipients[0]
          api.gainResources(target.seat, 1)
        }
        api.info(`水落石出：位于「${api.locName(location.id)}」的调查员共获得 ${X} 资源。`)
      },
    },
  ],
  modifiers: [],
}
