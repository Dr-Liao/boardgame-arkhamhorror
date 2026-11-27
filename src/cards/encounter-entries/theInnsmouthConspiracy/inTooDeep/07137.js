import { removeBarrierParley } from '../../_shared.js'
export default {
  code: '07137', scope: 'location', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'move', label: '国立第一杂货铺：在进入时经过的通道放置1个屏障',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: [({ source, context }) => context.location === source.id && source.connections?.includes(context.from)],
    resolve: ({ source, context, api }) => api.barriers.change(source.id, context.from, 1),
  }, removeBarrierParley({
    label: '谈判：以最低技能值检定(2)，成功移除1个屏障',
    cost: { action: 1 },
    test: { skill: 'lowest', difficulty: 2 },
  })],
}
