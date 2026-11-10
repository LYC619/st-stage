interface CommandProps {
  name: string
  callback: (args: Record<string, unknown>) => string
  namedArgumentList: unknown[]
  helpString: string
}
interface SlashContext {
  SlashCommandParser?: { addCommandObject: (command: unknown) => void }
  SlashCommand?: { fromProps: (props: CommandProps) => unknown }
  SlashCommandNamedArgument?: { fromProps: (props: { name: string; description: string; typeList: string[]; isRequired: boolean }) => unknown }
  ARGUMENT_TYPE?: { STRING: string }
}
export interface PhoneCommandActions {
  isOpen(): boolean
  expand(): void
  collapse(): void
  hasApp(id: string): boolean
  openApp(id: string): void
}

export function registerPhoneCommand(context: unknown, phone: PhoneCommandActions): void {
  const host = context as SlashContext | undefined
  if (typeof host?.SlashCommandParser?.addCommandObject !== 'function' || typeof host.SlashCommand?.fromProps !== 'function'
    || typeof host.SlashCommandNamedArgument?.fromProps !== 'function' || typeof host.ARGUMENT_TYPE?.STRING !== 'string') return
  host.SlashCommandParser.addCommandObject(host.SlashCommand.fromProps({
    name: 'baigong',
    callback(args) {
      const app = typeof args.app === 'string' ? args.app.trim() : ''
      if (app) {
        if (!phone.hasApp(app)) return `未找到 App「${app}」，请检查 App id。`
        phone.expand(); phone.openApp(app)
      } else if (phone.isOpen()) phone.collapse()
      else phone.expand()
      return ''
    },
    namedArgumentList: [host.SlashCommandNamedArgument.fromProps({ name: 'app', description: '直接打开的 App id，如 wechat-sister', typeList: [host.ARGUMENT_TYPE.STRING], isRequired: false })],
    helpString: '展开或收起百工手机；使用 app=wechat-sister 可直接打开指定 App。',
  }))
}
