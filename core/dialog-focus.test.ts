// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manageDialogFocus } from './dialog-focus'

const disposers: (() => void)[] = []
afterEach(() => {
  disposers.splice(0).reverse().forEach(dispose => dispose())
  document.body.replaceChildren()
})

function setup(content = '<button>First</button><input><button>Last</button>') {
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  const dialog = document.createElement('div')
  dialog.innerHTML = content
  document.body.append(dialog)
  const onEscape = vi.fn()
  const focus = manageDialogFocus(dialog, { onEscape })
  disposers.push(focus.dispose)
  focus.focusInitial()
  return { opener, dialog, focus, onEscape }
}

function key(target: Element | Document, key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

describe('dialog focus', () => {
  it('uses only the selected radio in each named group as a Tab stop', () => {
    const { dialog } = setup('<button>First</button><input type="radio" name="mode" checked><input type="radio" name="mode">')
    const selected = dialog.querySelector<HTMLInputElement>('input:checked')!
    selected.focus()
    expect(key(selected, 'Tab').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(dialog.firstElementChild)
  })

  it('allows implicit contenteditable Tab stops and skips nested editing regions', () => {
    const { dialog } = setup('<button>First</button><div contenteditable="true">Editor<div contenteditable="true">Nested</div></div>')
    expect(key(dialog.firstElementChild!, 'Tab').defaultPrevented).toBe(false)
  })

  it('wraps keyboard focus in both directions and recaptures outside focus', () => {
    const { opener, dialog } = setup()
    const first = dialog.firstElementChild as HTMLElement
    const last = dialog.lastElementChild as HTMLElement
    expect(document.activeElement).toBe(first)
    expect(key(first, 'Tab', true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
    expect(key(last, 'Tab').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    opener.focus()
    expect(document.activeElement).toBe(first)
  })

  it('skips hidden, inert, disabled and collapsed controls, recalculating after updates', () => {
    const { dialog, focus } = setup('<button disabled>Disabled</button><div hidden><input></div><div style="display:none"><input></div><div inert><input></div><fieldset disabled><input></fieldset><details><summary>Section</summary><input></details><button>Last</button>')
    const summary = dialog.querySelector('summary')!
    expect(document.activeElement).toBe(summary)
    key(summary, 'Tab', true)
    expect(document.activeElement).toBe(dialog.lastElementChild)
    dialog.innerHTML = '<input aria-label="New">'
    focus.focusInitial()
    expect(document.activeElement).toBe(dialog.firstElementChild)
  })

  it('only the top dialog handles Escape, including separate document listeners', () => {
    const outer = setup()
    const nestedOpener = outer.dialog.querySelector('input')!
    nestedOpener.focus()
    const inner = document.createElement('div')
    inner.innerHTML = '<button>Inner</button>'
    document.body.append(inner)
    const onEscape = vi.fn()
    const focus = manageDialogFocus(inner, { onEscape })
    disposers.push(focus.dispose)
    focus.focusInitial()
    const host = vi.fn()
    document.addEventListener('keydown', host)
    expect(key(document.activeElement!, 'Escape').defaultPrevented).toBe(true)
    expect(onEscape).toHaveBeenCalledOnce()
    expect(outer.onEscape).not.toHaveBeenCalled()
    expect(host).not.toHaveBeenCalled()
    focus.dispose()
    inner.remove()
    focus.restoreFocus()
    expect(document.activeElement).toBe(nestedOpener)
    key(nestedOpener, 'Escape')
    expect(outer.onEscape).toHaveBeenCalledOnce()
    document.removeEventListener('keydown', host)
  })

  it('restores the opener after disposal and does not leave a focus listener behind', () => {
    const { opener, dialog, focus, onEscape } = setup()
    focus.dispose()
    focus.dispose()
    dialog.remove()
    focus.restoreFocus()
    expect(document.activeElement).toBe(opener)
    key(opener, 'Escape')
    expect(onEscape).not.toHaveBeenCalled()
  })

  it('does not steal focus from a newer dialog when an older dialog is disposed', () => {
    const outer = setup()
    const inner = setup()
    const active = document.activeElement
    outer.focus.dispose()
    outer.dialog.remove()
    outer.focus.restoreFocus()
    expect(document.activeElement).toBe(active)
    inner.focus.dispose()
  })

  it('focuses the dialog itself when empty, and does not dismiss during IME composition', () => {
    const { dialog, onEscape } = setup('No controls')
    expect(document.activeElement).toBe(dialog)
    expect(key(dialog, 'Tab').defaultPrevented).toBe(true)
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }))
    expect(onEscape).not.toHaveBeenCalled()
  })
})
