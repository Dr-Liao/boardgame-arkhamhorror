export function makeCoterieAgent(code, letter) {
  return {
    code,
    scope: 'enemy',
    implemented: true,
    flags: { concealed: 2, coterie: true, agentLetter: letter },
    enemyRule: { concealed: 2, sharedConcealed: true },
    abilities: [{
      kind: 'forced', trigger: 'tskEnteredShadows', silent: true,
      label: '进入阴影后：在结社特工上放置 1 个毁灭标记',
      criteria: ({ source, context }) => source?.id === context?.enemyId,
      resolve: ({ source, api }) => api.doomOn(source, 1),
    }, {
      kind: 'reaction', trigger: 'tskExposed',
      label: '结社特工揭露时：将其弃掉',
      criteria: ({ source, context }) => Boolean(source) && source.defeated !== true
        && context?.decoy === false && context.enemyId === source.id,
      resolve: ({ source, api }) => api.scenario.discardEnemy(source),
    }],
  }
}
