export default {
  code: '11061',
  abilities: [
    {
      kind: 'commit', label: '仅自己的检定：押注最多 3 资源，成功至少 1 点则获得双倍资源',
      skill: { selfTestOnly: true, wagerResources: 3, wagerMinimumSuccessBy: 1 },
    },
  ],
}
