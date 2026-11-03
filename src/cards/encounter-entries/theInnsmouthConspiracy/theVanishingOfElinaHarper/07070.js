import { putRevealedPrintedLocation } from '../../_shared.js'
// 达贡密教：真实抽到单面地点时入场并揭示；最后一个线索被发现才盲移除迹象顶牌。
export default {
  code: '07070', scope: 'location', implemented: true,
  encounterResolve: putRevealedPrintedLocation,
  abilities: [{
    kind: 'forced', trigger: 'clueDiscovered', label: '达贡密教：不查看并移除迹象顶牌',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: [({ state, source, context }) => context.location === source.id && context.lastClue === true
      && (state.scenarioFlags?.mechanics?.scenarioDecks?.leads?.deck.length || 0) > 0],
    resolve: ({ api }) => api.scenarioDecks.removeTop('leads', 1),
  }],
}
