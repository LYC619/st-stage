export type SystemExtensionRecommendation =
  | '保留'
  | '不用时可临时关闭'
  | '排障时可临时关闭观察'

export interface SystemExtensionAdvice {
  displayName: string
  purpose: string
  whenNeeded: string
  disabledImpact: string
  recommendation: SystemExtensionRecommendation
}

const SYSTEM_EXTENSION_ADVICE: Record<string, SystemExtensionAdvice> = {
  expressions: {
    displayName: '角色表情图片',
    purpose: '根据对话内容选择并显示角色表情图片，用于增强聊天中的视觉反馈。',
    whenNeeded: '角色卡配置了表情图片，或正在使用依赖表情分类和切换的视觉玩法时需要。',
    disabledImpact: '角色表情图片不会再自动切换，依赖该功能的视觉表现会消失。',
    recommendation: '不用时可临时关闭',
  },
  gallery: {
    displayName: '图片画廊',
    purpose: '集中浏览聊天或图像生成流程产生的图片，方便回看和管理视觉内容。',
    whenNeeded: '经常生成图片、查看消息图片，或需要从聊天外集中浏览图片时需要。',
    disabledImpact: '画廊入口和集中浏览功能不可用，但聊天中的普通图片不一定受影响。',
    recommendation: '不用时可临时关闭',
  },
  memory: {
    displayName: '聊天总结',
    purpose: '定期总结较长的聊天历史，用较短的记忆内容帮助模型延续长期对话。',
    whenNeeded: '长篇对话需要持续记住前情，且当前预设确实使用自动总结时需要。',
    disabledImpact: '不再自动生成或更新总结，长聊天可能更依赖原始上下文或其他记忆方案。',
    recommendation: '排障时可临时关闭观察',
  },
  'quick-reply': {
    displayName: '快捷回复与自动化',
    purpose: '提供快捷按钮、命令组合和自动化流程，可快速执行常用操作。',
    whenNeeded: '使用快捷回复按钮、自动执行规则或依赖 Quick Reply 脚本的玩法时需要。',
    disabledImpact: '快捷按钮和相关自动化停止工作，依赖它们的操作流程需要手动完成。',
    recommendation: '排障时可临时关闭观察',
  },
  regex: {
    displayName: '正则处理',
    purpose: '按用户规则修改提示词、模型回复或消息显示内容，常用于格式清理和玩法协议。',
    whenNeeded: '角色卡、预设或当前玩法依赖 Regex 规则处理内容时需要，关闭前应先检查规则清单。',
    disabledImpact: '所有依赖规则的替换、隐藏和格式转换都会停止，部分角色卡或玩法可能异常。',
    recommendation: '保留',
  },
  'stable-diffusion': {
    displayName: 'AI 图片生成',
    purpose: '连接图片生成服务，并从 SillyTavern 内发起角色、场景或其他图片生成。',
    whenNeeded: '正在使用 Stable Diffusion 或兼容图像服务生成图片时需要。',
    disabledImpact: 'SillyTavern 内的图片生成入口和自动生成流程不可用。',
    recommendation: '不用时可临时关闭',
  },
  translate: {
    displayName: '消息翻译',
    purpose: '调用翻译服务处理输入或回复，帮助跨语言阅读和对话。',
    whenNeeded: '需要自动翻译消息，或当前角色和预设依赖翻译流程时需要。',
    disabledImpact: '自动翻译与翻译按钮不可用，消息会保留原始语言。',
    recommendation: '不用时可临时关闭',
  },
  tts: {
    displayName: '语音朗读',
    purpose: '把角色回复转换成语音并播放，可连接浏览器或外部语音服务。',
    whenNeeded: '需要角色语音、自动朗读或无障碍听读时需要。',
    disabledImpact: '回复不再自动或手动朗读，已配置的语音服务不会从该扩展调用。',
    recommendation: '不用时可临时关闭',
  },
  vectors: {
    displayName: '向量检索',
    purpose: '为聊天历史或资料建立语义索引，并按内容相关性召回片段。',
    whenNeeded: '长聊天、资料库或记忆流程需要语义召回，而不是只依赖关键词时需要。',
    disabledImpact: '语义召回和相关索引流程停止，模型可能失去由向量检索补入的相关内容。',
    recommendation: '排障时可临时关闭观察',
  },
}

export function getSystemExtensionAdvice(name: string): SystemExtensionAdvice | null {
  const normalized = name.trim().toLowerCase().split('/').pop() ?? ''
  return SYSTEM_EXTENSION_ADVICE[normalized] ?? null
}
