import { apply as applyBash } from '@deepseek-ai/dsh-tool-bash';

export const name = 'deep-ptc-zsh-tool';
export const inject = ['tools', 'shell', 'systemPrompt', 'shellEnv', 'workingDirectory'];

// Keep the official execution, jobs and approval implementation; adapt its public dialect.
export function apply(ctx) {
  const dialect = text => text.replace(/\bbash\b/gu, 'zsh').replace(/\bBash\b/gu, 'Zsh');
  const tools = new Proxy(ctx.tools, {
    get(target, key) {
      if (key === 'register') return definition => target.register({
        ...definition, name: definition.name === 'bash' ? 'zsh' : definition.name,
        description: dialect(definition.description),
      });
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const systemPrompt = new Proxy(ctx.systemPrompt, {
    get(target, key) {
      if (key === 'section') return section => target.section({ ...section,
        name: section.name === 'tool:bash' ? 'tool:zsh' : section.name, text: dialect(section.text) });
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  // A proxy preserves the real Cordis context for inject/effects, changing only the registry face.
  const adapted = new Proxy(ctx, {
    get(target, key) {
      if (key === 'tools') return tools;
      if (key === 'systemPrompt') return systemPrompt;
      const value = Reflect.get(target, key, target);
      if (key === 'inject') return (dependencies, callback) => target.inject(dependencies, child => {
        const wrapped = new Proxy(child, { get(c, k) { return k === 'tools' ? tools : Reflect.get(c, k, c); } });
        return callback(wrapped);
      });
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  applyBash(adapted);
}
