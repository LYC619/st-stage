export type ExportTab = 'characters' | 'worldbooks' | 'presets' | 'regex'

export interface ExportChat {
  id: string
  name: string
  path: string
  updatedAt?: number
}

export interface ExportCharacter {
  id: string
  name: string
  avatar: string
  updatedAt?: number
  chats: ExportChat[]
  /**
   * 角色卡在 `data.extensions.world` 里声明的关联世界书名称（没有则为 undefined）。
   *
   * 这是一个**指针**，指向独立的 `worlds/<名称>.json`，PNG 里不含它——所以只导出
   * PNG 会丢掉这本世界书。与之相对，`data.character_book`（内嵌世界书）和
   * `data.extensions.regex_scripts`（角色局部正则）是写在卡内的，PNG 导出自带，
   * 不需要单独收集。
   *
   * 导出时必须取 SillyTavern 里那本**实时**世界书（`/api/worldinfo/get` 读磁盘文件），
   * 不能拿卡内嵌的 `character_book` 顶替：内嵌那份是做卡时的快照，用户在玩的过程中
   * 对世界书的增删改都只落在 `worlds/<名称>.json` 上。拿快照导出等于把用户的修改丢掉。
   */
  linkedWorldName?: string
}

export interface ExportWorldbook {
  id: string
  name: string
  fileName: string
  updatedAt?: number
  content?: unknown
}

export interface ExportPreset {
  id: string
  name: string
  fileName: string
  updatedAt?: number
  content: unknown
}

export interface ExportRegexSet {
  updatedAt?: number
  rules: unknown[]
}

export interface ExportSnapshot {
  characters: ExportCharacter[]
  worldbooks: ExportWorldbook[]
  presets: ExportPreset[]
  regex: ExportRegexSet | null
}

export interface ExportSettingsAssets {
  presets: ExportPreset[]
  regex: ExportRegexSet | null
}

export interface ExportSelection {
  characterIds: Set<string>
  chatIds: Set<string>
  worldbookIds: Set<string>
  presetIds: Set<string>
  regex: boolean
}

export interface ExportFile {
  path: string
  data: Blob | ArrayBuffer | Uint8Array | string
  updatedAt?: number
}
