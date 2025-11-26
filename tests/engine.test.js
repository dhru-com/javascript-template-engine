// Tests for javascript-template-engine using Node's built-in test runner
// Run with: npm test

const test = require('node:test');
const assert = require('node:assert/strict');

// Import compiled dist
const TemplateEngine = require('../dist/index.js').default;

test('variables and nested paths', () => {
  const engine = new TemplateEngine();
  const tpl = 'ID: {{id}}, Secret: {{field_values.ipn_url_secret_key}}';
  const out = engine.render(tpl, { id: 42, field_values: { ipn_url_secret_key: 'abc' } });
  assert.equal(out, 'ID: 42, Secret: abc');
});

test('missing values render empty', () => {
  const engine = new TemplateEngine();
  const tpl = 'Hello {{user.name}}!';
  const out = engine.render(tpl, {});
  assert.equal(out, 'Hello !');
});

test('filters: default, json, date', () => {
  const engine = new TemplateEngine();
  const d = new Date(2020, 0, 2, 3, 4, 5); // local time to avoid TZ issues
  const tpl = '{{missing | default:"x"}}|{{ obj | json:2 }}|{{ d | date:"YYYY-MM-DD HH:mm:ss" }}';
  const out = engine.render(tpl, { obj: { a: 1 }, d });
  // JSON spacing of 2 turns into newlines/spaces; collapse spaces for assertion
  const parts = out.split('|');
  assert.equal(parts[0], 'x');
  assert.match(parts[1], /\{\n\s+"a":\s+1\n\}/);
  assert.equal(parts[2], '2020-01-02 03:04:05');
});

test('string helpers: upper, lower, capitalize, trim', () => {
  const engine = new TemplateEngine();
  const tpl = '{{ a | upper }}|{{ a | lower }}|{{ b | capitalize }}|{{ c | trim }}';
  const out = engine.render(tpl, { a: 'MiXeD', b: 'hello', c: '  spaced  ' });
  assert.equal(out, 'MIXED|mixed|Hello|spaced');
});

test('collection helpers: length, join', () => {
  const engine = new TemplateEngine();
  const tpl = '{{ arr | length }}|{{ obj | length }}|{{ arr | join:";" }}';
  const out = engine.render(tpl, { arr: [1, 2, 3], obj: { a: 1, b: 2 } });
  assert.equal(out, '3|2|1;2;3');
});

test('number formatting and comparisons', () => {
  const engine = new TemplateEngine();
  const tpl = '{{ n | number:"en-US" }}|{{ five | gt:three }}|{{ five | lt:three }}|{{ five | eq:five }}|{{ five | ne:six }}';
  const out = engine.render(tpl, { n: 1234.0, five: 5, three: 3, six: 6 });
  const [formatted, gt, lt, eq, ne] = out.split('|');
  // US locale should have comma
  assert.ok(/1,234/.test(formatted));
  assert.equal(gt, 'true');
  assert.equal(lt, '');
  assert.equal(eq, 'true');
  assert.equal(ne, 'true');
});

test('HTML escaping and raw output', () => {
  const engine = new TemplateEngine();
  const tpl = '{{ html }}|{{{ html }}}|{{ html | raw }}';
  const out = engine.render(tpl, { html: '<b>X</b>' });
  assert.equal(out, '&lt;b&gt;X&lt;/b&gt;|<b>X</b>|<b>X</b>');
});

test('comments are ignored', () => {
  const engine = new TemplateEngine();
  const tpl = 'A {{! comment }}B {{!-- block \n comment --}}C';
  const out = engine.render(tpl, {});
  assert.equal(out, 'A B C');
});

test('conditionals: if/unless with else', () => {
  const engine = new TemplateEngine();
  const tpl = '{{#if ok}}Y{{else}}N{{/if}}|{{#unless ok}}N{{else}}Y{{/unless}}';
  const out1 = engine.render(tpl, { ok: true });
  const out2 = engine.render(tpl, { ok: false });
  assert.equal(out1, 'Y|Y');
  assert.equal(out2, 'N|N');
});

test('each with meta vars and else', () => {
  const engine = new TemplateEngine();
  const tpl = '{{#each items}}[{{@index}}:{{@first}}:{{@last}}:{{this}}]{{/each}}';
  const out = engine.render(tpl, { items: ['a', 'b', 'c'] });
  assert.equal(out, '[0:true::a][1:::b][2::true:c]');
  // Also test else branch
  const tpl2 = '{{#each items}}x{{else}}EMPTY{{/each}}';
  const out2 = engine.render(tpl2, { items: [] });
  assert.equal(out2, 'EMPTY');
});

test('Mustache sections (#) with arrays and objects', () => {
  const engine = new TemplateEngine();
  // Array context with {{.}}
  const tpl1 = '{{#items}}(<{{.}}>){{/items}}';
  const out1 = engine.render(tpl1, { items: ['a', 'b'] });
  assert.equal(out1, '(<a>)(<b>)');

  // Truthy object context merges and exposes fields
  const tpl2 = '{{#user}}{{name}}-{{this.name}}{{/user}}';
  const out2 = engine.render(tpl2, { user: { name: 'Ada' } });
  // name becomes available and this.name equals it
  assert.equal(out2, 'Ada-Ada');
});

test('Mustache inverted sections (^) render on falsey or empty)', () => {
  const engine = new TemplateEngine();
  const tpl1 = '{{^items}}NO ITEMS{{/items}}';
  const out1 = engine.render(tpl1, { items: [] });
  assert.equal(out1, 'NO ITEMS');

  const tpl2 = '{{^ok}}no{{/ok}}';
  const out2 = engine.render(tpl2, { ok: 0 });
  assert.equal(out2, 'no');
});

test('partials without and with context', () => {
  const engine = new TemplateEngine();
  engine.registerPartial('card', 'P: {{title}} {{this.name}}');
  const out1 = engine.render('{{> card}}', { title: 'T', name: 'N' });
  assert.equal(out1, 'P: T '); // this.name is empty in root context
  const out2 = engine.render('{{> card user}}', { title: 'T', user: { name: 'User' } });
  assert.equal(out2, 'P: T User');
});

test('partial indentation semantics', () => {
  const engine = new TemplateEngine();
  engine.registerPartial('item', 'Line1\nLine2');
  const tpl = 'A\n  {{> item}}\nB';
  const out = engine.render(tpl, {});
  assert.equal(out, 'A\n  Line1\n  Line2\nB');
});

test('standalone line trimming for sections and partials', () => {
  const engine = new TemplateEngine();
  engine.registerPartial('p', 'X');
  const tpl = 'A\n{{#ok}}\nY\n{{/ok}}\n{{> p}}\nB';
  const out = engine.render(tpl, { ok: true });
  // Lines containing only tags should be trimmed
  assert.equal(out, 'A\nY\nX\nB');
});

test('Mustache variable lambda', () => {
  const engine = new TemplateEngine();
  const data = {
    greeting: function() { return 'Hello'; }
  };
  const out = engine.render('{{greeting}}, World!', data);
  assert.equal(out, 'Hello, World!');
});

test('Mustache section lambda', () => {
  const engine = new TemplateEngine();
  const data = {
    wrap: function(text, render) {
      // text is unrendered block, render callback renders it
      return '<b>' + render(text) + '</b>';
    },
    name: 'Ada'
  };
  const out = engine.render('{{#wrap}}{{name}}{{/wrap}}', data);
  assert.equal(out, '<b>Ada</b>');
});

test('compile returns a reusable renderer', () => {
  const engine = new TemplateEngine();
  const fn = engine.compile('Hi {{name}}');
  assert.equal(fn({ name: 'Ada' }), 'Hi Ada');
  assert.equal(fn({ name: 'Lin' }), 'Hi Lin');
});

test('strict mode throws on unknown helper and partial', () => {
  const engine = new TemplateEngine({ strict: true });
  // Unknown helper used as filter
  assert.throws(() => engine.render('{{ x | noSuch }}', { x: 1 }), /Unknown helper/);
  // Unknown partial
  assert.throws(() => engine.render('{{> nope}}', {}), /Unknown partial/);
});

test('strictVariables throws on missing variable/path', () => {
  const engine = new TemplateEngine({ strictVariables: true });
  assert.throws(() => engine.render('Hi {{user.name}}', {}), /Unknown variable or path/);
});

test('custom escapeFn is used when escapeHtml is true', () => {
  const engine = new TemplateEngine({ escapeHtml: true, escapeFn: (s) => s.replace(/</g, '[LT]').replace(/>/g, '[GT]') });
  const out = engine.render('{{ html }}', { html: '<b>' });
  assert.equal(out, '[LT]b[GT]');
});
