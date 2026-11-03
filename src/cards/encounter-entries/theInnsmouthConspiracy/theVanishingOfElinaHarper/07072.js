import { putRevealedPrintedLocation } from '../../_shared.js'
// 朝岸贫民窟：每点地点毁灭降低2帷幕，调查失败才在同一实体放毁灭。
export default {
  code: '07072', scope: 'location', implemented: true,
  encounterResolve: putRevealedPrintedLocation,
  modifiers: [{ target: 'locationShroud', amount: ({ entity }) => -2 * (entity.doom || 0) }],
  abilities: [{
    kind: 'forced', trigger: 'investigateFail', label: '朝岸贫民窟：放置1个毁灭标记',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: [({ source, context }) => context.location === source.id],
    resolve: ({ source, api }) => api.placeDoomOnCard(source, 1),
  }],
}
