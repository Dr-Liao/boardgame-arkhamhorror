const code = '11125'

export default {
  code,
  abilities: [{
    kind: 'commit',
    label: '成功后可移出本卡并免费打出一张收藏中的非永久零级卡，游戏结束时归还',
    skill: {
      afterTest: ({ inv, source, result, api }) => {
        if (result?.success && api.chooseCollectionPlay(inv.seat, { source: code, level: 0, returnToCollectionAtGameEnd: true })) {
          api.setCommitDestination(source, 'removedFromGame')
        }
      },
    },
  }],
}
