/*!
 * Adapted from SillyTavern-WeiMeng src/commands.js
 * https://github.com/FR0MK3YT0E2D/SillyTavern-WeiMeng
 * MIT License
 *
 * Copyright (c) 2026 FR0MK3YT0E2D
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export interface Command { name: string; args: string; raw: string }

const CMD_NAMES = ['set', 'insert', 'assign', 'add', 'remove', 'unset', 'delete', 'move'];
const CMD_START_RE = new RegExp(`_\\.(${CMD_NAMES.join('|')})\\s*\\(`, 'gi');

function matchParen(text: string, openIdx: number): number {
    let depth = 0;

    let quote: string | null = null;

    for (let i = openIdx; i < text.length; i++) {
        const ch = text[i];

        if (quote) {
            if (ch === '\\') { i++; continue; }
            if (ch === quote) quote = null;
            continue;
        }

        if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
        if (ch === '(' || ch === '{' || ch === '[') depth++;
        else if (ch === ')' || ch === '}' || ch === ']') {
            depth--;
            if (depth === 0 && ch === ')') return i;
            if (depth < 0) return -1;
        }
    }
    return -1;
}

export function extractCommands(...parts: string[]): Command[] {
    const text = parts.filter(Boolean).join('\n');
    if (!text.trim()) return [];

    const out: Command[] = [];
    const seen = new Set();

    CMD_START_RE.lastIndex = 0;
    let m;
    while ((m = CMD_START_RE.exec(text)) !== null) {
        const openIdx = text.indexOf('(', m.index);
        const closeIdx = matchParen(text, openIdx);
        if (closeIdx < 0) continue;

        const name = m[1].toLowerCase();
        const args = text.slice(openIdx + 1, closeIdx).trim();
        const raw = `_.${name}(${args});`;

        // 以「完整指令」去重，而非以路径去重。
        // 旧版用路径当 key，导致同一轮要 insert 多笔朋友圈时只会留下最长的一条。
        if (seen.has(raw)) continue;
        seen.add(raw);
        out.push({ name, args, raw });

        CMD_START_RE.lastIndex = closeIdx;
    }

    return out;
}

export function isNoUpdate(...parts: string[]): boolean {
    const text = parts.filter(Boolean).join('\n');
    return /\bNO_UPDATE\b/i.test(text) && extractCommands(text).length === 0;
}

export function buildScript(commands: Command[]): string {
    if (!commands.length) return '';
    return `<UpdateVariable>\n${commands.map((c) => c.raw).join('\n')}\n</UpdateVariable>`;
}

export function splitArgs(args: string): string[] {

    const out = [];
    let depth = 0;

    let quote: string | null = null;
    let start = 0;

    for (let i = 0; i < args.length; i++) {
        const ch = args[i];

        if (quote) {
            if (ch === '\\') { i++; continue; }
            if (ch === quote) quote = null;
            continue;
        }

        if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
        if (ch === '(' || ch === '{' || ch === '[') depth++;
        else if (ch === ')' || ch === '}' || ch === ']') depth--;
        else if (ch === ',' && depth === 0) {
            out.push(args.slice(start, i).trim());
            start = i + 1;
        }
    }

    const tail = args.slice(start).trim();
    if (tail) out.push(tail);
    return out;
}

function stripTrailingComment(arg: string): string {
    let quote: string | null = null;
    for (let i = 0; i < arg.length; i++) {
        const ch = arg[i];
        if (quote) {
            if (ch === '\\') { i++; continue; }
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
        if (ch === '/' && arg[i + 1] === '/') return arg.slice(0, i).trim();
    }
    return arg.trim();
}

export function parseArg(token: string): { ok: true; value: unknown } | { ok: false } {
    const t = stripTrailingComment(token);
    if (!t) return { ok: false };

    const quote = t[0];
    if ((quote === "'" || quote === '"' || quote === '`') && t.at(-1) === quote && t.length >= 2) {
        const inner = t.slice(1, -1);
        return { ok: true, value: inner.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n') };
    }

    if (/^-?\d+(\.\d+)?$/.test(t)) return { ok: true, value: Number(t) };
    if (t === 'true') return { ok: true, value: true };
    if (t === 'false') return { ok: true, value: false };
    if (t === 'null') return { ok: true, value: null };

    if (t[0] === '{' || t[0] === '[') {
        try {
            return { ok: true, value: JSON.parse(t) };
        } catch {
            // LLM 常写成单引号 / 尾逗号的伪 JSON，尝试修一次
            try {
                const repaired = t
                    .replace(/,\s*([}\]])/g, '$1')
                    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'(\s*[:,}\]])/g, '"$1"$2')
                    .replace(/([{,]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'(\s*:)/g, '$1"$2"$3');
                return { ok: true, value: JSON.parse(repaired) };
            } catch {
                return { ok: false };
            }
        }
    }

    return { ok: false };
}

function tokenizePath(path: string): Array<string | number> {

    const out = [];
    for (const seg of String(path).split('.')) {
        if (!seg) continue;
        const re = /([^[\]]+)|\[(\d+)\]/g;
        let m;
        while ((m = re.exec(seg)) !== null) {
            if (m[1] !== undefined) out.push(m[1]);
            else out.push(Number(m[2]));
        }
    }
    return out;
}

function resolveParent(root: Record<string, unknown>, path: string, create: boolean): { parent: Record<string | number, unknown>; key: string | number } | null {
    let tokens = tokenizePath(path);
    if (!tokens.length || tokens.some(key => ['__proto__', 'constructor', 'prototype'].includes(String(key)))) return null;

    // 先把尾端的数字索引拆下来。等走到容器之后再决定它是「真的阵列索引」
    // 还是 MVU 的 ValueWithDescription 惯例（`路径[0]` 指向值本身）。
    // 不能在走访途中才判断 —— 若倒数第二段是纯量（例如 时间.显示），
    // 走访会先撞上字串而提早放弃，整条指令就被默默丢掉。

    let tailIndex: number | null = null;
    if (typeof tokens.at(-1) === 'number') {
        tailIndex = tokens.at(-1) as number;
        tokens = tokens.slice(0, -1);
        if (!tokens.length) return null;
    }

    let cur: Record<string | number, unknown> = root;
    for (let i = 0; i < tokens.length - 1; i++) {
        const key = tokens[i];

        if (typeof key === 'number' && !Array.isArray(cur)) continue;

        if (cur[key] === undefined || cur[key] === null) {
            if (!create) return null;
            cur[key] = typeof tokens[i + 1] === 'number' ? [] : {};
        }
        if (typeof cur[key] !== 'object') return null;
        cur = cur[key] as Record<string | number, unknown>;
    }

    const key = tokens.at(-1)!;

    // 尾端索引只有在容器真的是阵列时才当索引用；否则视为 [0] 惯例并忽略
    if (tailIndex !== null && Array.isArray(cur?.[key])) {
        return { parent: cur[key] as unknown as Record<string | number, unknown>, key: tailIndex };
    }
    return { parent: cur, key };
}

export function applyCommand(stat: Record<string, unknown>, cmd: Command): boolean {
    const rawArgs = splitArgs(cmd.args);
    if (!rawArgs.length) return false;

    const pathArg = parseArg(rawArgs[0]);
    if (!pathArg.ok || typeof pathArg.value !== 'string') return false;
    const path = pathArg.value;

    const rest = rawArgs.slice(1).map(parseArg);

    switch (cmd.name) {
        case 'set': {
            // _.set(path, new) 或 _.set(path, old, new) — 取最后一个参数为新值
            const valArg = rest.at(-1);
            if (!valArg?.ok) return false;
            const loc = resolveParent(stat, path, true);
            if (!loc || loc.key === undefined) return false;
            if (JSON.stringify(loc.parent[loc.key]) === JSON.stringify(valArg.value)) return false;
            loc.parent[loc.key] = valArg.value;
            return true;
        }

        case 'add': {
            const deltaArg = rest[0];
            if (!deltaArg?.ok || typeof deltaArg.value !== 'number') return false;
            const loc = resolveParent(stat, path, true);
            if (!loc || loc.key === undefined) return false;
            const cur = Number(loc.parent[loc.key]) || 0;
            loc.parent[loc.key] = cur + deltaArg.value;
            return true;
        }

        case 'insert':
        case 'assign': {
            const loc = resolveParent(stat, path, true);
            if (!loc || loc.key === undefined) return false;
            let target = loc.parent[loc.key];

            if (target === undefined || target === null) {
                target = rest.length >= 2 ? {} : [];
                loc.parent[loc.key] = target;
            }

            if (rest.length === 1) {
                const v = rest[0];
                if (!v.ok) return false;
                if (Array.isArray(target)) { target.push(v.value); return true; }
                if (typeof target === 'object' && v.value && typeof v.value === 'object') {
                    for (const [key, value] of Object.entries(v.value)) {
                        if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
                        (target as Record<string, unknown>)[key] = value;
                    }
                    return true;
                }
                return false;
            }

            if (rest.length >= 2) {
                const k = rest[0];
                const v = rest[1];
                if (!k.ok || !v.ok || ['__proto__', 'constructor', 'prototype'].includes(String(k.value))) return false;
                if (Array.isArray(target)) {
                    const idx = k.value === '-' ? target.length : Number(k.value);
                    if (Number.isNaN(idx)) return false;
                    target.splice(idx, 0, v.value);
                    return true;
                }
                if (typeof target === 'object') {
                    (target as Record<string, unknown>)[String(k.value)] = v.value;
                    return true;
                }
            }
            return false;
        }

        case 'remove':
        case 'delete':
        case 'unset': {
            const loc = resolveParent(stat, path, false);
            if (!loc || loc.key === undefined) return false;

            if (rest.length === 0) {
                if (Array.isArray(loc.parent) && typeof loc.key === 'number') {
                    loc.parent.splice(loc.key, 1);
                    return true;
                }
                if (loc.parent[loc.key] === undefined) return false;
                delete loc.parent[loc.key];
                return true;
            }

            const target = loc.parent[loc.key];
            const k = rest[0];
            if (!k.ok || target === undefined || target === null) return false;

            if (Array.isArray(target)) {
                const idx = typeof k.value === 'number'
                    ? k.value
                    : target.findIndex((it) => JSON.stringify(it) === JSON.stringify(k.value));
                if (idx < 0 || idx >= target.length) return false;
                target.splice(idx, 1);
                return true;
            }
            if (typeof target === 'object') {
                const key = String(k.value);
                if (!(key in target)) return false;
                delete (target as Record<string, unknown>)[key];
                return true;
            }
            return false;
        }

        default:
            // 'move' 等罕用指令：本地后端不支援，交由 MVU 后端处理
            return false;
    }
}

export function applyCommands(stat: Record<string, unknown>, commands: Command[]): number {
    let applied = 0;
    for (const cmd of commands) {
        try {
            if (applyCommand(stat, cmd)) applied++;
        } catch (e) {
            console.warn('[st-stage] 套用状态指令失败', e);
        }
    }
    return applied;
}

