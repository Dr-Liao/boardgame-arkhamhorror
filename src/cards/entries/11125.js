const code = '11125'

export default {
  code,
  abilities: [{
    kind: 'commit',
    label: '成功后可移出本卡并免费打出一张收藏中的非永久零级卡',
    skill: {
      afterTest: ({ inv, source, result, api }) => {
        if (result?.success && api.chooseCollectionPlay(inv.seat, { source: code, level: 0 })) {
          api.setCommitDestination(source, 'removedFromGame')
        }
      },
    },
  }],
}
