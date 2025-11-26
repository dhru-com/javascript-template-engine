javascript-template-engine

A tiny, dependency-free TypeScript templating engine with variables, filters, partials, conditionals, loops, HTML-escaping, and more.

Install
- npm install javascript-template-engine

Quick usage (TypeScript)
```
import TemplateEngine from "javascript-template-engine";

const engine = new TemplateEngine();

engine.registerPartial("userCard", "<div>{{name | default:'Anonymous'}}</div>");
engine.registerHelper("upper", (v: any) => String(v ?? "").toUpperCase());

const template = `
  Hello {{user.name | default:'friend'}}!
  {{#if user.isActive}}Active{{else}}Inactive{{/if}}
  {{#each items}}
    - {{@index}}: {{this}}
  {{else}}
    No items
  {{/each}}
`;

const html = engine.render(template, { user: { name: "Ada", isActive: true }, items: ["A", "B"] });
console.log(html);
```

Key features
- ✅ Variables & nested paths – `{{id}}`, `{{field_values.ipn_url_secret_key}}`
- ✅ Filters with arguments – `{{ created_at | date:"YYYY-MM-DD" }}`
- ✅ Built-in filters/helpers – `default`, `json`, `date`, `upper`, `lower`, `capitalize`, `trim`, `length`, `join`, `number`, `eq/ne/gt/gte/lt/lte`, `raw`
- ✅ Conditionals – `{{#if ...}} ... {{/if}}`, `{{#unless ...}} ... {{/unless}}`, with `{{else}}`
- ✅ Loops – `{{#each items}} ... {{/each}}` (supports `{{this}}`, `{{@index}}`, `{{@first}}`, `{{@last}}`, and `{{else}}` for empty arrays)
- ✅ Custom helpers (filters) – register your own
- ✅ Partials – `{{> partialName}}` and `{{> partialName contextPath}}`
- ✅ Compile templates – `engine.compile(template)` returns a render function
- ✅ HTML escaping – safe by default for `{{ ... }}`; use `{{{ ... }}}` or `| raw` to output unescaped
- ✅ Comments – `{{! one line }}` and block `{{!-- ... --}}`

Syntax reference
- Variables
  - `{{ user.name }}` gets nested paths.
  - Missing values render as empty string.

- Escaping
  - By default `{{ ... }}` is HTML-escaped.
  - Use triple braces to bypass escaping: `{{{ html }}}`.
  - Or the helper: `{{ html | raw }}`.

- Filters (helpers)
  - Pipe syntax: `{{ value | helper:arg1,arg2 }}`.
  - Quoted args supported: `{{ created_at | date:"YYYY-MM-DD HH:mm" }}`.
  - Built-ins:
    - `default(value, fallback)`
    - `json(value, space?)`
    - `date(value, pattern)` – tokens: `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`
    - `upper`, `lower`, `capitalize`, `trim`
    - `length` (string/array/object), `join:sep`
    - `number:locale` – formats using `Intl.NumberFormat`
    - Comparisons: `eq`, `ne`, `gt`, `gte`, `lt`, `lte` (return "true" or empty)
    - `raw(value)` – mark as safe (skip escape)

- Conditionals
  - `{{#if cond}}Yes{{else}}No{{/if}}`
  - `{{#unless cond}}No{{else}}Yes{{/unless}}`

- Loops
  - `{{#each items}}Item: {{this}} ({{@index}}){{/each}}`
  - `{{#each items}}...{{else}}Empty list{{/each}}`
  - Meta variables: `@index`, `@first`, `@last`

- Partials
  - Register: `engine.registerPartial("card", "<div>{{title}}</div>");`
  - Use: `{{> card}}` (same context) or `{{> card user}}` (render with `user` merged into context and `this`)

- Comments
  - Line: `{{! ignore me }}`
  - Block: `{{!-- anything here is ignored --}}`

API
- `new TemplateEngine(options?)`
  - Options:
    - `escapeHtml` (default: true) – escape on `{{ ... }}`
    - `strict` (default: false) – throw on unknown helper/partial
- `setOptions(options)` – update options at runtime
- `registerHelper(name, fn)` – add custom filter/helper
- `registerPartial(name, template)` – add a partial template string
- `render(template, data)` – render once
- `compile(template) -> (data) => string` – precompile, then render many times

TypeScript
```
import TemplateEngine, { TemplateEngine as EngineClass, TemplateOptions, HelperFn } from "javascript-template-engine";
```
`TemplateOptions` and `HelperFn` types are exported.

Examples
```
const tpl = `
  {{#each users}}
    <li class="{{#if @first}}first{{/if}}">{{name | upper}}</li>
  {{else}}<li>None</li>{{/each}}
`;
engine.render(tpl, { users: [{ name: "Ada" }, { name: "Lin" }] });
```

Node / bundlers
- CommonJS: `const TemplateEngine = require('javascript-template-engine').default;`
- ESM/TypeScript: `import TemplateEngine from 'javascript-template-engine';`

Testing
- Requirements: Node.js v18+ (for the built-in `node:test` runner)
- Run all tests:
  - `npm test`
- What it does:
  - Builds TypeScript to `dist/`
  - Runs tests in `tests/**/*.test.js` against the compiled output

Release notes
- v0.2.0
  - Add HTML escaping by default and `{{{ ... }}}`/`raw` to opt-out
  - Add comments (`{{! ... }}`, `{{!-- ... --}}`)
  - `if`/`unless` with `else`
  - `each` with `else` and meta vars `@index`, `@first`, `@last`
  - Partials with context: `{{> name ctx}}`
  - New helpers: `upper`, `lower`, `capitalize`, `trim`, `length`, `join`, `number`, comparisons
  - Engine options: `escapeHtml`, `strict`

Publish checklist
1) Update `package.json` fields:
   - `author`, `repository.url`, `homepage`, `bugs.url`.
2) Build: `npm run build`
3) Login: `npm login` (enable 2FA if required)
4) Publish: `npm publish --access public`
   - If the name is taken, change `name` in `package.json` and re-publish.

License
MIT
