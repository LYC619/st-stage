/** ZIP 文件身份不能被静默改名；采用可跨平台恢复的单段文件名规则。 */
export function isArchiveSegment(value: string): boolean {
  const hasControl = Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  return Boolean(value) && value.trim() === value && !/^[.]+$/.test(value)
    && !hasControl && !/[\\/:*?"<>|]/.test(value) && !/[. ]$/.test(value)
    && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(value)
}

export function archiveSegment(value: string, kind: string): string {
  if (!isArchiveSegment(value)) throw new Error('无法生成可恢复备份：' + kind + '文件名不合法')
  return value
}
