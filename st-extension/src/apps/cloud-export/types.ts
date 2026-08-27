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
