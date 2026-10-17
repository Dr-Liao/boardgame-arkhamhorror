// Authored behavioral findings, not inferred from effect keys or test mentions.
export const findings = [
  { code: '01013', before: '回合结束时弃置并增加毁灭，无法付费打出。', expected: '手中保留时每回合结束受到2恐惧；付费打出增加1毁灭。', reference: 'Event/Events/DarkMemory.hs', test: 'P6 01013' },
  { code: '01019', before: '只能治疗使用者。', expected: '可选择同地点有相应伤害或恐惧的调查员；不能选择远处角色。', reference: 'Asset/Assets/FirstAid.hs', test: 'P6 01019' },
  { code: '01026', before: '将印刷初始弹药视为容量上限，满弹药武器不能补充。', expected: '在合法火器上放置3弹药，可超过初始弹药。', reference: 'Event/Events/ExtraAmmunition1.hs', test: 'P6 01026' },
  { code: '01108', before: '移除书房将敌人按击败处理，产生胜利点和击败反应。', expected: '弃置书房敌人，移动所有调查员后移除书房，不触发击败。', reference: 'Act/Cards/NightOfTheZealot/TheGathering/Trapped.hs', test: 'P6 01108' },
  { code: '01117', before: '结局加入的丽塔使牌组被计为31张普通卡，关间升级全被拒绝。', expected: '剧情卡保留在持久牌组，不占普通构筑尺寸，合法升级仍可执行。', reference: 'Scenario/Scenarios/NightOfTheZealot/TheGathering.hs', test: 'P6 01117' },
  { code: '01155', before: '静谧空地治疗次数由全队每轮共用。', expected: '每名调查员每回合独立限一次，仅当有可治疗伤害或恐惧时可用。', reference: 'Location/Cards/NightOfTheZealot/TheDevourerBelow/ArkhamWoodsQuietGlade.hs', test: 'P6 01155' },
]
