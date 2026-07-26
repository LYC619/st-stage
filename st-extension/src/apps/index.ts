/**
 * 内置手机 App 装配清单（十期·内部模块组织）：
 * 未来新增内置工具时，在此列表加一个模块即可，与 st-stage 一起构建发布。
 * 旧「设置」App 已移除：立绘设置迁入「立绘」App，图床设置迁入「图库」App；
 * 本期没有独立的手机平台设置，故主页不再显示设置图标。
 */

import type { PhoneApp } from '../../../core/phone-registry'
import { spriteApp } from './sprite-app'
import { galleryApp } from './gallery-app'
import { butlerApp } from './butler-app'
import { mvuApp } from './mvu-app'
import { newvarApp } from './newvar-app'
import type { NewvarRuntime } from './newvar/runtime'

export interface BuiltinAppDeps {
  /** 从手机打开图库管理弹窗（收起手机 + 记录来源，关闭后回手机图库页） */
  openGalleryManager: () => void
  /** 「新变量」运行时：入口创建并 start（注入/解析/存储常驻），App 只是它的控制台 */
  newvarRuntime: NewvarRuntime
  /** 打开「变量设计」弹窗（收起手机，关闭后回「新变量」页） */
  openNewvarDesigner: () => void
}

export function createBuiltinApps(deps: BuiltinAppDeps): PhoneApp[] {
  return [
    spriteApp(),
    galleryApp({ openManager: deps.openGalleryManager }),
    butlerApp(),
    mvuApp(),
    newvarApp({ runtime: deps.newvarRuntime, openDesigner: deps.openNewvarDesigner }),
  ]
}
