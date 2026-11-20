export default {
  code: '11016',
  encounterLookRule: { forceBeneath: true, defeatCount: 3, mentalTrauma: 1 },
  abilities: [{ kind: 'weakness', label: '涌动', weakness: { type: 'custom' },
    resolve: ({ inv, api }) => api.drawEncounter(inv.seat) }],
}
