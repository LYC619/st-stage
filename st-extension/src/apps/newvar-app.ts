/**
 * 「新变量」App — 内置轻量变量追踪（手机端，刻意精简）：
 * 只留 启用开关（说明走 ⓘ 悬浮）+「打开变量设计」入口 + 变量状态树（delta 高亮 + 手动编辑）。
 * 变量定义/模板库/输出格式/注入预览/解析日志全部在「变量设计」弹窗（newvar/designer.ts）——
 * 设计变量不需要读正文，全屏表单对新手友好（用户实测反馈）。
 * 引擎/存储/事件在 newvar/runtime（随扩展常驻）；本文件只是开关与展示。
 */

import type { PhoneApp } from '../../../core/phone-registry'
import { el, appButton, toggleRow, hintField } from './widgets'
import { createVariableTreeView, computeDelta, type VariableTreeModel } from './variable-tree'
import type { NewvarRuntime } from './newvar/runtime'

export interface NewvarAppDeps {
  runtime: NewvarRuntime
  /** 打开「变量设计」弹窗（入口负责收起手机、关闭后回本页） */
  openDesigner: () => void
}

export function newvarApp(deps: NewvarAppDeps): PhoneApp {
  let unsub: (() => void) | null = null

  return {
    id: 'newvar',
    name: '新变量',
    icon: '🧮',
    order: 5,
    mount(container, ctx) {
      unsub?.()
      const { runtime, openDesigner } = deps

      const cfgBox = el('div', 'nv-box')
      const stateBox = el('div', 'nv-box')
      container.append(cfgBox, stateBox)

      function renderCfg(): void {
        cfgBox.textContent = ''
        const d = runtime.getData()
        const section = el('div', 'so-app-section')
        section.append(
          hintField(
            toggleRow('启用变量追踪', d.enabled, (v) => {
              ctx.setAppData({ ...runtime.getData(), enabled: v })
              runtime.onConfigChanged()
              renderCfg()
            }),
            '不依赖 MVU/酒馆助手：按你的变量定义自动向 AI 注入当前状态与更新规则，解析回复末尾的 <UpdateVariable> 并逐楼保存快照，任何角色卡都能用。变量定义、模板、注入预览都在「变量设计」里。',
          ),
          hintField(
            toggleRow('隐藏正文中的变量更新记录', d.hideUpdateBlocks, (v) => {
              ctx.setAppData({ ...runtime.getData(), hideUpdateBlocks: v })
              ctx.toast(
                'success',
                v
                  ? '已隐藏变量更新记录；原始回复和变量快照保持不变。'
                  : '已恢复 st-stage 隐藏的变量更新记录。若仍不可见，请检查 ST Regex 中删除 UpdateVariable 的规则。',
              )
              renderCfg()
            }),
            '只隐藏消息气泡里完整的 <UpdateVariable>...</UpdateVariable> 区块，不修改 SillyTavern 保存的原始回复，也不影响变量解析和楼层快照。关闭后会恢复 st-stage 自己隐藏的内容；ST Regex 等外部规则仍会独立生效。',
          ),
          appButton('打开变量设计', openDesigner),
        )
        cfgBox.append(section)
      }

      const tree = createVariableTreeView(stateBox, {
        getModel: (): VariableTreeModel => {
          const st = runtime.isSTAvailable()
          const d = runtime.getData()
          const state = runtime.getCurrentState()
          return {
            data: state,
            definitions: d.schema.variables,
            isMvu: false,
            delta: computeDelta(state, runtime.getPrevState(), false),
            status: st ? 'ready' : 'unavailable',
            statusText: st ? `内置追踪 · ${d.enabled ? '已启用' : '未启用'}` : '内置追踪 · 模拟器',
            emptyText: '暂无变量。点上方「打开变量设计」定义或导入模板，启用后 AI 回复会逐楼更新这里。',
            noticeText: st
              ? undefined
              : '未检测到 SillyTavern：模拟器中可打开变量设计编辑定义与预览注入，状态快照在 ST 内才会产生。',
            canWrite: st,
            allowAdd: false,
            addHint: '这里只能修改变量设计中已有的路径；新增变量请先在「变量设计」中添加定义。',
          }
        },
        commitSet: (path, value) => runtime.setManualValue(path, value),
        commitDelete: (path) => runtime.deleteVariable(path),
        requestRefresh: () => tree.render(),
      })

      renderCfg()
      tree.render()

      const offRuntime = runtime.subscribe(() => {
        if (!tree.isEditing()) tree.render()
      })
      unsub = () => offRuntime()
    },
    unmount() {
      unsub?.()
      unsub = null
    },
  }
}
