// 08581b 记忆敌人背面（直面内心恶魔）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：记录直面恶魔，并把该伙伴切换为坚毅（Resolute）版本。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08581b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { resolutePartner: '08591', victory: true, record: 'partnersFacedInnerDemon' },
  },
}
