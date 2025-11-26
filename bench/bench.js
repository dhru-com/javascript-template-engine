// Simple benchmark for javascript-template-engine
// Run with: npm run bench

const { performance } = require('node:perf_hooks');
const TemplateEngine = require('../dist/index.js').default;

function bench(name, fn, iterations = 10000) {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const t1 = performance.now();
  const ops = (iterations / ((t1 - t0) / 1000)).toFixed(0);
  console.log(`${name}: ${ops} ops/sec (${iterations} iters in ${(t1 - t0).toFixed(1)}ms)`);
}

function main() {
  const engine = new TemplateEngine({ cacheTemplates: true });

  const data = {
    user: { name: 'Ada', isActive: true },
    items: Array.from({ length: 5 }, (_, i) => `Item-${i}`),
    created_at: new Date(2020, 0, 2, 3, 4, 5)
  };

  const tpl = `Hello {{user.name | upper}}!\n` +
              `{{#if user.isActive}}Active{{else}}Inactive{{/if}}\n` +
              `{{#each items}}- {{@index}}: {{this}}\n{{/each}}` +
              `{{ created_at | date:"YYYY-MM-DD HH:mm:ss" }}`;

  const render = engine.compile(tpl);

  // warmup
  for (let i = 0; i < 1000; i++) render(data);

  bench('render(template, data)', () => engine.render(tpl, data));
  bench('compile(template) then render(data)', () => render(data));
}

main();
