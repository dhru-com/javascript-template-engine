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
- ✅ Mustache-compatible sections – `{{#name}}...{{/name}}` and inverted `{{^name}}...{{/name}}`
  - Arrays iterate, objects/truthy values set the inner context
  - Current item token `{{.}}` is supported (same as `{{this}}`)
  - Lambdas supported for variables and sections (see below)
  - Standalone line trimming and partial indentation semantics (Mustache-compatible)
 - ✅ Security & DX: hardened path lookup (blocks `__proto__/prototype/constructor`), customizable `escapeFn`, optional `strictVariables` errors
 - ✅ Performance: optional compile-result LRU cache (`cacheTemplates`, `cacheSize`)

Examples: from simple to advanced

One‑liners (copy/paste friendly)
```
// Variables
engine.render('Hi {{name}}', { name: 'Ada' }); // => "Hi Ada"

// Nested path
engine.render('User: {{user.name}}', { user: { name: 'Lin' } }); // => "User: Lin"

// Default filter
engine.render('Hello {{name | default:"friend"}}', {}); // => "Hello friend"

// HTML escaping by default
engine.render('Safe: {{html}}', { html: '<b>X</b>' }); // => "Safe: &lt;b&gt;X&lt;/b&gt;"

// Raw output
engine.render('Raw: {{{ html }}}', { html: '<i>Y</i>' }); // => "Raw: <i>Y</i>"

// Date formatting
engine.render('On {{d | date:"YYYY-MM-DD"}}', { d: new Date(2020,0,2) }); // => "On 2020-01-02"

// Join arrays
engine.render('{{ items | join:";" }}', { items: [1,2,3] }); // => "1;2;3"
```

Conditionals and loops
```
const tpl = '{{#if active}}ON{{else}}OFF{{/if}} | ' +
            '{{#each items}}[{{@index}} {{this}}]{{/each}}';

engine.render(tpl, { active: true, items: ['A','B','C'] });
// => "ON | [0 A][1 B][2 C]"

engine.render('{{#unless ok}}no{{else}}yes{{/unless}}', { ok: 0 });
// => "no"

engine.render('{{#each xs}}x{{else}}EMPTY{{/each}}', { xs: [] });
// => "EMPTY"
```

Partials (with and without context)
```
const engine = new TemplateEngine();
engine.registerPartial('card', '<div>{{title}} - {{this.name}}</div>');

// Without context: only title is available, this.name is empty
engine.render('{{> card}}', { title: 'Hello' });
// => "<div>Hello - </div>"

// With context: merge user into scope and set `this`
engine.render('{{> card user}}', { title: 'Hello', user: { name: 'Ada' } });
// => "<div>Hello - Ada</div>"

// Indentation semantics: partial lines get caller indentation
engine.registerPartial('lines', 'A\nB');
engine.render('Start\n  {{> lines}}\nEnd', {});
// => "Start\n  A\n  B\nEnd"
```

Mustache‑compatible sections and inverted sections
```
// Arrays iterate; {{.}} is current item
engine.render('{{#items}}<li>{{.}}</li>{{/items}}', { items: ['a','b'] });
// => "<li>a</li><li>b</li>"

// Truthy object sets inner context
engine.render('{{#user}}{{name}}{{/user}}', { user: { name: 'Ada' } });
// => "Ada"

// Inverted section renders when falsey/empty
engine.render('{{^items}}No items{{/items}}', { items: [] });
// => "No items"
```

Lambdas (Mustache style)
```
// Variable lambda
engine.render('{{greet}}, World!', { greet: () => 'Hello' });
// => "Hello, World!"

// Section lambda: receives unrendered text and a render() callback
const data = { wrap: (text, render) => '<b>' + render(text) + '</b>', name: 'Ada' };
engine.render('{{#wrap}}{{name}}{{/wrap}}', data);
// => "<b>Ada</b>"
```

Filters/helpers showcase
```
const engine = new TemplateEngine();
const d = new Date(2020,0,2,3,4,5);

engine.render([
  '{{"  hi  " | trim}}',                   // => "hi"
  '{{name | upper}}',                      // => "ADA"
  '{{ list | length }}',                   // => "3"
  '{{ list | join:"," }}',                // => "1,2,3"
  '{{ price | number:"en-US" }}',        // => "1,234"
  '{{ five | gt:three }}',                 // => "true"
  '{{ five | lt:three }}',                 // => ""
  '{{ d | date:"YYYY-MM-DD HH:mm:ss" }}'  // => "2020-01-02 03:04:05"
].join('\n'), { name: 'Ada', list:[1,2,3], price:1234, five:5, three:3, d });
```

Compile and cache for speed
```
const engine = new TemplateEngine({ cacheTemplates: true });
const tpl = 'Hi {{user.name}} — {{#each items}}[{{@index}} {{this}}]{{/each}}';
const render = engine.compile(tpl);

render({ user:{ name:'Ada' }, items:['A','B'] }); // => "Hi Ada — [0 A][1 B]"
render({ user:{ name:'Lin' }, items:['X'] });     // => "Hi Lin — [0 X]"
```

Strict variables and custom escaping
```
// Strict variables: throw when a path is missing
const strict = new TemplateEngine({ strictVariables: true });
// strict.render('Hi {{user.name}}', {}); // throws: Unknown variable or path: user.name

// Custom escape function
const esc = new TemplateEngine({ escapeHtml: true, escapeFn: s => s.replace(/</g,'[LT]').replace(/>/g,'[GT]') });
esc.render('{{html}}', { html: '<b>' }); // => "[LT]b[GT]"
```

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

Mustache compatibility and beyond
- Compatibility
  - Sections `{{#name}}...{{/name}}`, inverted `{{^name}}...{{/name}}`, dotted names, partials, `{{.}}`.
  - Lambda support:
    - Variable lambda: if a value is a function, it's invoked and its return value is rendered.
    - Section lambda: if a section value is a function, it's called as `fn(unrenderedText, render)` and the return is rendered.
  - Standalone line trimming: lines that contain only a tag are removed per spec; surrounding whitespace is handled.
  - Partial indentation: indentation before `{{> partial}}` is applied to each line of the partial.
- Extra power (beyond Mustache)
  - Handlebars-like `{{#if}}`, `{{#unless}}`, `{{else}}`, `{{#each}}` with `@index/@first/@last`.
  - Filters/helpers pipeline with arguments.
  - HTML escaping by default, with `{{{ ... }}}` and `| raw` to opt-out.

API
- `new TemplateEngine(options?)`
  - Options:
    - `escapeHtml` (default: true) – escape on `{{ ... }}`
    - `escapeFn` (default: HTML escaper) – provide a custom escaping function
    - `strict` (default: false) – throw on unknown helper/partial
    - `strictVariables` (default: false) – throw when a variable/path is missing
    - `cacheTemplates` (default: false) – cache compiled renderers by template string
    - `cacheSize` (default: 200) – max entries in the compile cache
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
- CommonJS (CJS): `const TemplateEngine = require('javascript-template-engine').default;`
- ESM/TypeScript: `import TemplateEngine from 'javascript-template-engine';`
  - Dual build available: CJS (`dist/index.js`) and ESM (`dist/esm/index.js`).

Testing
- Requirements: Node.js v18+ (for the built-in `node:test` runner)
- Run all tests:
  - `npm test`
- What it does:
  - Builds TypeScript to `dist/`
  - Runs tests in `tests/**/*.test.js` against the compiled output

Release notes
- v1.1.0
  - Security/DX: add `strictVariables`, customizable `escapeFn`, and guard prototype-pollution keys in path lookup.
  - Performance/Packaging: optional compile LRU cache (`cacheTemplates`, `cacheSize`), dual build (CJS + ESM), add `bench` script.
- v1.0.0
  - Add Mustache lambdas for variables and sections.
  - Implement standalone line trimming and partial indentation semantics.
  - Improve partial rendering with indentation, and bump package to 1.0.0.
- v0.3.0
  - Add Mustache-compatible sections: `{{#section}}...{{/section}}` and inverted `{{^section}}...{{/section}}`
  - Support `{{.}}` token for current item
  - Small performance tweaks (precompiled regexes, fewer RegExp allocations)
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
   - `author` (dhru.com), `repository.url`, `homepage`, `bugs.url`.
2) Build: `npm run build`
3) Login: `npm login` (enable 2FA if required)
4) Publish: `npm publish --access public`
   - If the name is taken, change `name` in `package.json` and re-publish.

License
MIT

Credits
- Developer & sponsor: https://dhru.com
- Repository: https://github.com/dhru-com/javascript-template-engine
