/** ST avatar filenames survive display-name and array-order changes. Missing identity never guesses. */
export function stableCharacterKey(card?: { avatar?: string; name?: string }): string | null {
  const avatar = card?.avatar
  return typeof avatar === 'string' && avatar.trim() === avatar && avatar.length > 0 && avatar.length <= 255
    && avatar !== 'none' && avatar !== '.' && avatar !== '..' && !/[\\/]/.test(avatar)
    && ![...avatar].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    ? `avatar:${avatar}` : null
}
export function isStableCharacterKey(key: string): boolean { return key.startsWith('avatar:') && stableCharacterKey({ avatar: key.slice(7) }) === key }
