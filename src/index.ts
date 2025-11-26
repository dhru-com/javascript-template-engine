export type DataObject = Record<string, any>;
export type HelperFn = (value: any, ...args: any[]) => any;

export interface TemplateOptions {
  escapeHtml?: boolean; // escape by default for double braces
  escapeFn?: (input: string) => string; // custom escape strategy
  strict?: boolean; // throw on missing helpers/partials/helpers
  strictVariables?: boolean; // throw on missing variables/paths
  cacheTemplates?: boolean; // enable compile() result caching by template string
  cacheSize?: number; // max cached templates
}

function isDangerousKey(key: string): boolean {
  return key === "__proto__" || key === "prototype" || key === "constructor";
}

function getValueByPath(obj: any, path: string): any {
  if (path === ".") return obj && Object.prototype.hasOwnProperty.call(obj, "this") ? (obj as any).this : obj;
  if (!path) return undefined;
  const parts = path.split(".");
  let acc: any = obj;
  for (const rawKey of parts) {
    const key = rawKey.trim();
    if (!key) return undefined;
    if (isDangerousKey(key)) return undefined;
    if (acc && typeof acc === "object" && Object.prototype.hasOwnProperty.call(acc, key)) {
      acc = acc[key];
    } else {
      return undefined;
    }
  }
  return acc;
}

function formatDate(date: Date, pattern: string = "YYYY-MM-DD"): string {
  const pad = (n: number, len: number = 2) => String(n).padStart(len, "0");

  const map: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  };

  return pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => map[token]);
}

function escapeHtml(input: any): string {
  const s = String(input);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// A tiny wrapper to mark a value as safe (skip escaping)
class SafeString {
  private v: any;
  constructor(v: any) { this.v = v; }
  toString() { return String(this.v); }
}

export class TemplateEngine {
  private helpers: Map<string, HelperFn> = new Map();
  private partials: Map<string, string> = new Map();
  private options: Required<TemplateOptions>;
  // simple LRU for compiled templates (by template string)
  private tplCache?: Map<string, (data: DataObject) => string>;

  constructor(options?: TemplateOptions) {
    this.options = {
      escapeHtml: true,
      escapeFn: (s: string) => escapeHtml(s),
      strict: false,
      strictVariables: false,
      cacheTemplates: false,
      cacheSize: 200,
      ...(options || {}),
    };
    if (this.options.cacheTemplates) {
      this.tplCache = new Map();
    }
    // Built-in helpers / filters
    this.registerHelper("default", (value, fallback) => {
      return value === undefined || value === null || value === "" ? fallback : value;
    });

    this.registerHelper("json", (value, space?: string | number) => {
      const n = typeof space === "string" ? parseInt(space, 10) : space;
      const json = JSON.stringify(value, null, Number.isFinite(n as number) ? (n as number) : 0);
      // Mark JSON as safe so quotes/braces are not HTML-escaped
      return new SafeString(json);
    });

    this.registerHelper("date", (value, pattern: string = "YYYY-MM-DD") => {
      if (!value) return "";
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return "";
      return formatDate(d, pattern);
    });

    // String helpers
    this.registerHelper("upper", (v) => String(v ?? "").toUpperCase());
    this.registerHelper("lower", (v) => String(v ?? "").toLowerCase());
    this.registerHelper("capitalize", (v) => {
      const s = String(v ?? "");
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    });
    this.registerHelper("trim", (v) => String(v ?? "").trim());

    // Array/Object helpers
    this.registerHelper("length", (v) => {
      if (Array.isArray(v) || typeof v === "string") return v.length;
      if (v && typeof v === "object") return Object.keys(v).length;
      return 0;
    });
    this.registerHelper("join", (v, sep = ",") => (Array.isArray(v) ? v.join(String(sep)) : String(v ?? "")));

    // Number/compare helpers
    this.registerHelper("number", (v, locale = "en-US") => {
      try { return new Intl.NumberFormat(String(locale)).format(Number(v)); } catch { return String(v ?? ""); }
    });
    const cmp = (a: any, b: any) => { const na = Number(a), nb = Number(b); return isNaN(na) || isNaN(nb) ? String(a) === String(b) : na === nb; };
    this.registerHelper("eq", (a, b) => (cmp(a, b) ? "true" : ""));
    this.registerHelper("ne", (a, b) => (!cmp(a, b) ? "true" : ""));
    this.registerHelper("gt", (a, b) => (Number(a) > Number(b) ? "true" : ""));
    this.registerHelper("gte", (a, b) => (Number(a) >= Number(b) ? "true" : ""));
    this.registerHelper("lt", (a, b) => (Number(a) < Number(b) ? "true" : ""));
    this.registerHelper("lte", (a, b) => (Number(a) <= Number(b) ? "true" : ""));

    // Raw/safe output
    this.registerHelper("raw", (v) => new SafeString(v));
  }

  registerHelper(name: string, fn: HelperFn): void {
    this.helpers.set(name, fn);
  }

  registerPartial(name: string, template: string): void {
    this.partials.set(name, template);
  }

  setOptions(options: TemplateOptions): void {
    const prevCache = this.options.cacheTemplates;
    this.options = { ...this.options, ...(options || {}) } as Required<TemplateOptions>;
    if (this.options.cacheTemplates && !this.tplCache) {
      this.tplCache = new Map();
    }
    if (!this.options.cacheTemplates && prevCache && this.tplCache) {
      this.tplCache.clear();
      this.tplCache = undefined;
    }
  }

  compile(template: string): (data: DataObject) => string {
    if (this.tplCache) {
      const cached = this.tplCache.get(template);
      if (cached) return cached;
      const fn = (data: DataObject) => this.render(template, data);
      // LRU discipline: move to end when (re)inserted
      this.tplCache.set(template, fn);
      if (this.tplCache.size > this.options.cacheSize) {
        // delete oldest
        const firstKey = this.tplCache.keys().next().value as string | undefined;
        if (firstKey !== undefined) this.tplCache.delete(firstKey);
      }
      return fn;
    }
    return (data: DataObject) => this.render(template, data);
  }

  private applyFilters(initialValue: any, filterParts: string[], data: DataObject): any {
    return filterParts.reduce((value, rawFilter) => {
      if (!rawFilter) return value;

      const [namePart, ...argParts] = rawFilter.split(":");
      const name = namePart.trim();
      const helper = this.helpers.get(name);

      if (!helper) {
        if (this.options.strict) throw new Error(`Unknown helper: ${name}`);
        return value;
      }

      let rawArgs = argParts.join(":").trim();
      let args: any[] = [];

      if (rawArgs) {
        // support comma-separated args: date:"YYYY-MM-DD HH:mm",json:2
        args = rawArgs.split(",").map((s) => {
          let v = s.trim();
          // if quoted, treat as literal string (strip quotes)
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            return v.slice(1, -1);
          }
          // numeric literal
          if (/^[+-]?\d+(?:\.\d+)?$/.test(v)) {
            return Number(v);
          }
          // attempt to resolve as a data path
          const resolved = getValueByPath(data, v);
          return resolved !== undefined ? resolved : v;
        });
      }

      return helper(value, ...args);
    }, initialValue);
  }

  render(template: string, data: DataObject): string {
    let output = template;

    // Precompiled regexes (hoisted for small perf gain)
    const RE_LINE_COMMENT = /{{!\s*[^}]*}}/g;
    const RE_BLOCK_COMMENT = /{{!--[\s\S]*?--}}/g;
    // Indentation-aware partial (m flag to catch line starts)
    const RE_PARTIAL_WITH_INDENT = /(^[ \t]*){{>\s*([\w.]+)(?:\s+([^}]+))?\s*}}/gm;
    const RE_IF = /{{#if ([^}]+)}}([\s\S]*?){{\/if}}/g;
    const RE_UNLESS = /{{#unless ([^}]+)}}([\s\S]*?){{\/unless}}/g;
    const RE_EACH = /{{#each ([^}]+)}}([\s\S]*?){{\/each}}/g;
    const RE_TRIPLE = /{{{\s*([^}]+)\s*}}}/g;
    const RE_VAR = /{{\s*([^}]+)\s*}}/g;
    const RE_ELSE_SPLIT = /{{\s*else\s*}}/;
    const RE_SECTION = /{{#\s*([\w.]+)\s*}}([\s\S]*?){{\/\s*\1\s*}}/g; // Mustache section
    const RE_INVERTED = /{{\^\s*([\w.]+)\s*}}([\s\S]*?){{\/\s*\1\s*}}/g; // Mustache inverted
    // Standalone lines: trim lines that contain only a tag (per Mustache spec subset)
    // Consume the trailing newline so we don't leave an extra blank line
    const RE_STANDALONE = /(^|\r?\n)[ \t]*{{(?:![\s\S]*?|>\s*[\w.]+(?:\s+[^}]+)?|[#\/^][^}]*)}}[ \t]*(?:\r?\n|$)/g;

    // Comments (single-line and block): {{! ...}} and {{!-- ... --}}
    output = output.replace(RE_LINE_COMMENT, "");
    output = output.replace(RE_BLOCK_COMMENT, "");

    // Partials: {{> name}}
    // Also supports context: {{> name contextPath}} and indentation semantics
    output = output.replace(RE_PARTIAL_WITH_INDENT, (_match, indent, name, ctx) => {
      const partialName = String(name).trim();
      const partial = this.partials.get(partialName);
      if (!partial) {
        if (this.options.strict) throw new Error(`Unknown partial: ${partialName}`);
        return "";
      }
      let ctxData: DataObject = data;
      if (ctx) {
        const resolved = getValueByPath(data, String(ctx).trim());
        if (resolved && typeof resolved === "object") ctxData = { ...data, ...resolved, this: resolved };
        else ctxData = { ...data, this: resolved };
      }
      const rendered = this.render(partial, ctxData);
      if (!indent) return rendered;
      // Apply indentation to each line of the partial
      return String(rendered).split(/\r?\n/).map((line, i) => (i === 0 ? indent + line : (line.length ? indent + line : line))).join("\n");
    });

    // Standalone trimming (after partial expansion to preserve indentation semantics)
    output = output.replace(RE_STANDALONE, (_m, p1) => (p1 ? p1 : ""));

    // Mustache sections: {{#section}} ... {{/section}}
    output = output.replace(RE_SECTION, (_m, name, block) => {
      const key = String(name).trim();
      const value = getValueByPath(data, key);
      // Lambda section: function receives unrendered text and a render callback
      if (typeof value === "function") {
        try {
          const lambdaResult = value.call(data, String(block), (tmpl: string) => this.render(String(tmpl), data));
          return typeof lambdaResult === "string" ? this.render(lambdaResult, data) : String(lambdaResult ?? "");
        } catch {
          return "";
        }
      }
      if (Array.isArray(value)) {
        if (value.length === 0) return "";
        return value
          .map((item) => {
            const ctx = typeof item === "object" && item !== null ? { ...data, ...item, this: item } : { ...data, this: item };
            return this.render(String(block), ctx);
          })
          .join("");
      }
      if (value) {
        const ctx = typeof value === "object" ? { ...data, ...value, this: value } : { ...data, this: value };
        return this.render(String(block), ctx);
      }
      return "";
    });

    // Mustache inverted sections: {{^section}} ... {{/section}}
    output = output.replace(RE_INVERTED, (_m, name, block) => {
      const key = String(name).trim();
      const value = getValueByPath(data, key);
      const shouldRender = Array.isArray(value) ? value.length === 0 : !value;
      return shouldRender ? this.render(String(block), data) : "";
    });

    // IF: {{#if cond}} ... {{/if}}
    output = output.replace(RE_IF, (_match, condition, content) => {
      const value = getValueByPath(data, String(condition).trim());
      const parts = String(content).split(RE_ELSE_SPLIT);
      return value ? parts[0] ?? "" : parts[1] ?? "";
    });

    // UNLESS: {{#unless cond}} ... {{/unless}}
    output = output.replace(
      RE_UNLESS,
      (_match, condition, content) => {
        const value = getValueByPath(data, String(condition).trim());
        const parts = String(content).split(RE_ELSE_SPLIT);
        return !value ? parts[0] ?? "" : parts[1] ?? "";
      }
    );

    // EACH: {{#each items}} ... {{/each}}
    output = output.replace(RE_EACH, (_match, path, blockContent) => {
      const arr = getValueByPath(data, String(path).trim());
      const content = String(blockContent);
      const parts = content.split(RE_ELSE_SPLIT);
      const loopTpl = parts[0] ?? "";
      const emptyTpl = parts[1] ?? "";
      if (!Array.isArray(arr) || arr.length === 0) return emptyTpl;
      return arr
        .map((item, idx) => {
          // Simple support: {{this}} and meta vars
          let rendered = String(loopTpl).replace(/{{\s*this\s*}}/g, String(item));
          // Support Mustache current item token {{.}}
          rendered = rendered.replace(/{{\s*\.\s*}}/g, String(item));
          rendered = rendered.replace(/{{\s*@index\s*}}/g, String(idx));
          rendered = rendered.replace(/{{\s*@first\s*}}/g, idx === 0 ? "true" : "");
          rendered = rendered.replace(/{{\s*@last\s*}}/g, idx === (arr.length - 1) ? "true" : "");
          // Render with context extended by `this`
          return this.render(rendered, { ...data, this: item });
        })
        .join("");
    });

    // Triple mustaches: {{{ expr }}} — never escape
    output = output.replace(RE_TRIPLE, (_m, inner) => {
      const raw = String(inner).trim();
      const segments = raw.split("|").map((s) => s.trim());
      const path = segments[0];
      const filters = segments.slice(1);
      let value: any = path === "." ? (Object.prototype.hasOwnProperty.call(data, "this") ? (data as any).this : data) : getValueByPath(data, path);
      // Variable lambda: call and use returned string
      if (typeof value === "function") {
        try { value = value.call(data); } catch { value = ""; }
      }
      if (filters.length > 0) value = this.applyFilters(value, filters, data);
      if (value === undefined || value === null) return "";
      return String(value);
    });

    // Variables + Filters: {{ expr | filter:arg }}
    output = output.replace(RE_VAR, (_match, inner) => {
      const raw = String(inner).trim();

      // Skip block tags / partials (already processed)
      if (raw.startsWith("#") || raw.startsWith("/") || raw.startsWith(">")) {
        return "";
      }

      // Split by '|' for filters
      const segments = raw.split("|").map((s) => s.trim());
      const path = segments[0];
      const filters = segments.slice(1);

      let value: any = getValueByPath(data, path);

      // Variable lambda: call and use returned string
      if (typeof value === "function") {
        try { value = value.call(data); } catch { value = ""; }
      }

      if (filters.length > 0) {
        value = this.applyFilters(value, filters, data);
      }

      if (value === undefined || value === null) {
        if (this.options.strictVariables) {
          throw new Error(`Unknown variable or path: ${path}`);
        }
        return "";
      }
      const str = String(value);
      // If value is a SafeString or escape is disabled, return as is
      const isSafe = value instanceof SafeString;
      return this.options.escapeHtml && !isSafe ? this.options.escapeFn(str) : str;
    });

    return output;
  }
}

export default TemplateEngine;
