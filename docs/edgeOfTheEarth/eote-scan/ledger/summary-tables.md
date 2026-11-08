# EOTE 全量扫描统计汇总（自动生成）

生成时间：2026-11-08T11:31:10.437Z

## 覆盖与 verdict

| 分区 / 章节 | total | match | approximation | gap | blocked |
| --- | --- | --- | --- | --- | --- |
| eoteInvestigators|- | 22 | 14 | 5 | 3 | 0 |
| eotePlayer|- | 115 | 38 | 60 | 17 | 0 |
| eoteCampaign|shared:_shared | 80 | 23 | 20 | 37 | 0 |
| eoteCampaign|iceAndDeathPart1 | 5 | 0 | 0 | 5 | 0 |
| eoteCampaign|iceAndDeathPart2 | 21 | 5 | 11 | 5 | 0 |
| eoteCampaign|iceAndDeathPart3 | 5 | 0 | 0 | 5 | 0 |
| eoteCampaign|fatalMirage | 75 | 0 | 3 | 72 | 0 |
| eoteCampaign|toTheForbiddenPeaks | 25 | 1 | 1 | 23 | 0 |
| eoteCampaign|cityOfTheElderThings | 27 | 1 | 5 | 21 | 0 |
| eoteCampaign|theHeartOfMadnessPart1 | 12 | 7 | 1 | 4 | 0 |
| eoteCampaign|theHeartOfMadnessPart2 | 16 | 1 | 5 | 10 | 0 |

## issue 统计

- 总 issue（去重）：904；按 severity：{"high":476,"medium":312,"low":116}
- 按维度：{"impl-vs-text":422,"primitive":226,"runtime":157,"duplication":54,"perceivability":17,"docs":24,"tests":1,"code-quality":3}
- 场景级 issue：90

## 各 area 覆盖

| area | 卡数 | issue | severity |
| --- | --- | --- | --- |
| investigators | 22 | 31 | {"high":5,"medium":13,"low":13} |
| player-a | 60 | 77 | {"low":23,"medium":47,"high":7} |
| player-b | 55 | 65 | {"high":12,"medium":33,"low":20} |
| campaign-a | 48 | 132 | {"high":61,"medium":63,"low":8} |
| campaign-b | 75 | 322 | {"high":226,"medium":94,"low":2} |
| campaign-c | 52 | 91 | {"high":65,"medium":20,"low":6} |
| campaign-d | 91 | 152 | {"low":37,"medium":53,"high":62} |
| scenarios | 0 | 38 | {"high":17,"medium":18,"low":3} |
| interactions | 0 | 5 | {"medium":2,"low":3} |
| primitives | 0 | 39 | {"high":33,"medium":5,"low":1} |

## 账本有效性 / 死钩子

```json
{
 "ledgerValidity": {
  "records": 403,
  "withValid": 268,
  "onlyBad": 135,
  "noEvidence": 0,
  "onlyBadByPartition": {
   "eoteInvestigators": 4,
   "eoteCampaign": 131
  }
 },
 "deadHooks": {
  "files": 8,
  "hooks": 21
 }
}
```