export default {
  code: '11003',
  threatEffect: { playHorrorByType: { event: 1 } },
  abilities: [
    { kind: 'weakness', label: '放入威胁区', weakness: { type: 'threat' } },
    {
      kind: 'free', label: '弃掉 3 张事件：清除这张弱点',
      cost: { discardHand: 3, discardHandType: 'event' },
      resolve: ({ source, api }) => api.removeThreat(source),
    },
  ],
}
