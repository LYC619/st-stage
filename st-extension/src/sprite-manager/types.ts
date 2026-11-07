import type { PluginSettings } from '../../../core/types'
import type { manageDialogFocus } from '../../../core/dialog-focus'
import type { STAdapter } from '../st-adapter'
import type { SpriteLightboxController } from '../sprite-lightbox'
import type { ImageStorageDialogController } from '../image-storage-dialog'
import type { createLifecycle } from './lifecycle'
import type { createSettings } from './settings'
import type { createControls } from './controls'
import type { createList } from './list'
import type { createResources } from './resources'
import type { createDetail } from './detail'
import type { createLightbox } from './lightbox'
import type { createUpload } from './upload'

export interface ManagerDeps {
  adapter: STAdapter
  getSettings: () => PluginSettings
  updateSettings: (next: PluginSettings) => void
  /** 将内嵌图片暂存为 ST 用户图片；导入和迁移使用，失败不会写 settings。 */
  saveDataUri?: (dataUri: string, options?: { signal?: AbortSignal }) => Promise<string>
  /** 弹窗关闭回调（带打开来源）：来源=手机时由 index.ts 重新展开手机回图库页 */
  onClosed?: (source: ManagerSource) => void
}

export type ManagerSource = 'overlay' | 'phone'

export interface ManagerController {
  open(source?: ManagerSource): void
  close(): void
  destroy(): void
  /** 弹窗打开时刷新内容（角色切换后调用） */
  refreshIfOpen(): void
}

export type View = { kind: 'list' } | { kind: 'pack'; packId: string }

export interface ActiveLightbox {
  controller: SpriteLightboxController | null
  packId: string
  index: number
}

export const SPRITE_PAGE_SIZE = 60

export interface ManagerState {
  backdrop: HTMLElement | null
  destroyed: boolean
  view: View
  spriteVisibleCount: number
  spriteFilterQuery: string
  spriteFilterLabels: string[]
  packFilterQuery: string
  packFilterRole: string
  packFilterKind: string
  packFilterTag: string
  expandedRoleGroupKey: string
  openSections: Map<string, boolean>
  enableListOpen: boolean
  enableListDocHandler: ((e: MouseEvent) => void) | null
  batchMode: boolean
  selectedPackIds: Set<string>
  batchResourceBusy: boolean
  openedFrom: ManagerSource
  activeLightbox: ActiveLightbox | null
  storageDialog: ImageStorageDialogController | null
  importController: AbortController | null
  dialogFocus: ReturnType<typeof manageDialogFocus> | null
  childDialogs: Set<() => void>
  popoverListeners: Set<() => void>
  popoverOpener: HTMLElement | null
  stopViewport: (() => void) | null
}

export type ManagerActions = ReturnType<typeof createLifecycle>
  & ReturnType<typeof createSettings>
  & ReturnType<typeof createControls>
  & ReturnType<typeof createList>
  & ReturnType<typeof createResources>
  & ReturnType<typeof createDetail>
  & ReturnType<typeof createLightbox>
  & ReturnType<typeof createUpload>

export interface ManagerContext {
  deps: ManagerDeps
  state: ManagerState
  actions: ManagerActions
}
