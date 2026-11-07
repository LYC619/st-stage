/** Public gallery entry; views, media actions and lifecycle live in sprite-manager/. */
import type { ManagerActions, ManagerContext, ManagerController, ManagerDeps } from './sprite-manager/types'
import { SPRITE_PAGE_SIZE } from './sprite-manager/types'
import { createLifecycle } from './sprite-manager/lifecycle'
import { createSettings } from './sprite-manager/settings'
import { createControls } from './sprite-manager/controls'
import { createList } from './sprite-manager/list'
import { createResources } from './sprite-manager/resources'
import { createDetail } from './sprite-manager/detail'
import { createLightbox } from './sprite-manager/lightbox'
import { createUpload } from './sprite-manager/upload'

export type { ManagerDeps, ManagerSource, ManagerController } from './sprite-manager/types'

export function createSpriteManager(deps: ManagerDeps): ManagerController {
  const ctx: ManagerContext = {
    deps,
    state: {
      backdrop: null,
      destroyed: false,
      view: { kind: 'list' },
      spriteVisibleCount: SPRITE_PAGE_SIZE,
      spriteFilterQuery: '',
      spriteFilterLabels: [],
      packFilterQuery: '',
      packFilterRole: '',
      packFilterKind: '',
      packFilterTag: '',
      expandedRoleGroupKey: '',
      openSections: new Map<string, boolean>(),
      enableListOpen: false,
      enableListDocHandler: null,
      batchMode: false,
      selectedPackIds: new Set<string>(),
      batchResourceBusy: false,
      openedFrom: 'overlay',
      activeLightbox: null,
      storageDialog: null,
      importController: null,
      dialogFocus: null,
      childDialogs: new Set<() => void>(),
      popoverListeners: new Set<() => void>(),
      popoverOpener: null,
      stopViewport: null,
    },
    // Factories only create closures; wire callbacks before exposing the controller.
    actions: {} as ManagerActions,
  }
  Object.assign(ctx.actions, createLifecycle(ctx), createSettings(ctx), createControls(ctx), createList(ctx), createResources(ctx), createDetail(ctx), createLightbox(ctx), createUpload(ctx))
  const { open, close, destroy, refreshIfOpen } = ctx.actions
  return { open, close, destroy, refreshIfOpen }
}
