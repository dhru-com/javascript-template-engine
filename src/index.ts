export type DataObject = Record<string, any>;
export type HelperFn = (value: any, ...args: any[]) => any;

export interface TemplateOptions {
  escapeHtml?: boolean; // escape by default for double braces
  strict?: boolean; // throw on missing helpers/partials
}

function getValueByPath(obj: any, path: string): any {
  return path.split(".").reduce((acc: any, key: string) => {
    if (acc && acc[key] !== undefined) return acc[key];
    return undefined;
  }, obj);
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

  constructor(options?: TemplateOptions) {
    this.options = {
      escapeHtml: true,
      strict: false,
      ...(options || {}),
    };
    // Built-in helpers / filters
    this.registerHelper("default", (value, fallback) => {
      return value === undefined || value === null || value === "" ? fallback : value;
    });

    this.registerHelper("json", (value, space?: string | number) => {
      const n = typeof space === "string" ? parseInt(space, 10) : space;
      return JSON.stringify(value, null, Number.isFinite(n as number) ? (n as number) : 0);
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
    this.options = { ...this.options, ...(options || {}) } as Required<TemplateOptions>;
  }

  compile(template: string): (data: DataObject) => string {
    return (data: DataObject) => this.render(template, data);
  }

  private applyFilters(initialValue: any, filterParts: string[]): any {
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
          // strip quotes if present
          if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
          ) {
            v = v.slice(1, -1);
          }
          return v;
        });
      }

      return helper(value, ...args);
    }, initialValue);
  }

  render(template: string, data: DataObject): string {
    let output = template;

    // Comments (single-line and block): {{! ...}} and {{!-- ... --}}
    output = output.replace(/{{!\s*[^}]*}}/g, "");
    output = output.replace(/{{!--[\s\S]*?--}}/g, "");

    // Partials: {{> name}}
    // Also supports context: {{> name contextPath}}
    output = output.replace(/{{>\s*([\w.]+)(?:\s+([^}]+))?\s*}}/g, (_match, name, ctx) => {
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
      // Render partial content with provided or same data context
      return this.render(partial, ctxData);
    });

    // IF: {{#if cond}} ... {{/if}}
    output = output.replace(/{{#if ([^}]+)}}([\s\S]*?){{\/if}}/g, (_match, condition, content) => {
      const value = getValueByPath(data, String(condition).trim());
      const parts = String(content).split(/{{\s*else\s*}}/);
      return value ? parts[0] ?? "" : parts[1] ?? "";
    });

    // UNLESS: {{#unless cond}} ... {{/unless}}
    output = output.replace(
      /{{#unless ([^}]+)}}([\s\S]*?){{\/unless}}/g,
      (_match, condition, content) => {
        const value = getValueByPath(data, String(condition).trim());
        const parts = String(content).split(/{{\s*else\s*}}/);
        return !value ? parts[0] ?? "" : parts[1] ?? "";
      }
    );

    // EACH: {{#each items}} ... {{/each}}
    output = output.replace(/{{#each ([^}]+)}}([\s\S]*?){{\/each}}/g, (_match, path, blockContent) => {
      const arr = getValueByPath(data, String(path).trim());
      const content = String(blockContent);
      const parts = content.split(/{{\s*else\s*}}/);
      const loopTpl = parts[0] ?? "";
      const emptyTpl = parts[1] ?? "";
      if (!Array.isArray(arr) || arr.length === 0) return emptyTpl;
      return arr
        .map((item, idx) => {
          // Simple support: {{this}} and meta vars
          let rendered = String(loopTpl).replace(/{{\s*this\s*}}/g, String(item));
          rendered = rendered.replace(/{{\s*@index\s*}}/g, String(idx));
          rendered = rendered.replace(/{{\s*@first\s*}}/g, idx === 0 ? "true" : "");
          rendered = rendered.replace(/{{\s*@last\s*}}/g, idx === (arr.length - 1) ? "true" : "");
          // Render with context extended by `this`
          return this.render(rendered, { ...data, this: item });
        })
        .join("");
    });

    // Triple mustaches: {{{ expr }}} — never escape
    output = output.replace(/{{{\s*([^}]+)\s*}}}/g, (_m, inner) => {
      const raw = String(inner).trim();
      const segments = raw.split("|").map((s) => s.trim());
      const path = segments[0];
      const filters = segments.slice(1);
      let value = getValueByPath(data, path);
      if (filters.length > 0) value = this.applyFilters(value, filters);
      if (value === undefined || value === null) return "";
      return String(value);
    });

    // Variables + Filters: {{ expr | filter:arg }}
    output = output.replace(/{{\s*([^}]+)\s*}}/g, (_match, inner) => {
      const raw = String(inner).trim();

      // Skip block tags / partials (already processed)
      if (raw.startsWith("#") || raw.startsWith("/") || raw.startsWith(">")) {
        return "";
      }

      // Split by '|' for filters
      const segments = raw.split("|").map((s) => s.trim());
      const path = segments[0];
      const filters = segments.slice(1);

      let value = getValueByPath(data, path);

      if (filters.length > 0) {
        value = this.applyFilters(value, filters);
      }

      if (value === undefined || value === null) return "";
      const str = String(value);
      // If value is a SafeString or escape is disabled, return as is
      const isSafe = value instanceof SafeString;
      return this.options.escapeHtml && !isSafe ? escapeHtml(str) : str;
    });

    return output;
  }
}

export default TemplateEngine;
