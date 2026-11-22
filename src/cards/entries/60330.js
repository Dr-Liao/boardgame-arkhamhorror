// 60330 学人精
// 卡面：你将学人精投入一次技能检定后，在另一位调查员的弃牌堆中查找一张可以投入本次检定的技能，并将其投入。本次检定结束后，将该卡放到其所有者牌库底。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60330',
  abilities: [{
    kind: 'commit',
    label: '投入另一位调查员弃牌堆中的一张技能，检定结束后放到其牌库底',
    skill: {
      onCommit: ({ state, inv, api }) => {
        const candidates = state.investigators
          .filter(owner => owner.seat !== inv.seat && !owner.resigned && !owner.defeated)
          .flatMap(owner => [...new Set(owner.discard)]
            .filter(code => api.cardType(code) === 'skill'
              && api.canCommitCard(inv.seat, code, { from: 'discard', ownerSeat: owner.seat }))
            .map(code => ({ id: `${owner.seat}:${code}`, owner, code })))
        if (!candidates.length) return
        const selectedId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'card', source: '60330', seat: inv.seat,
          prompt: '选择要从另一位调查员的弃牌堆投入的技能。',
          options: candidates.map(({ id, owner, code }) => ({
            id, cardCode: code, label: `${owner.name}的「${api.cardName(code)}」`,
          })),
        })
        const selected = candidates.find(candidate => candidate.id === selectedId)
        api.commitOrigins.commit(inv.seat, {
          from: 'discard', code: selected.code, ownerSeat: selected.owner.seat, returnToOwnerDeckBottom: true,
        })
      },
    },
  }],
}
