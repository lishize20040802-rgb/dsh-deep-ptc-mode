import z from '@deepseek-ai/schemastery';
import { environmentText } from './model.mjs';
export const name = 'deep-ptc-execution-instructions';
export const inject = ['systemPrompt'];
export const Config = z.object({
  environment: z.union(['wsl', 'powershell', 'zsh', 'bash']).required(),
  wslDistribution: z.string().default(''),
  shellNote: z.string().default(''),
  // SSH guidance for this environment (lib/ssh.mjs); empty omits the section.
  ssh: z.string().default(''),
});
export function apply(ctx, config) {
  ctx.systemPrompt.section({
    name: 'deep-ptc:execution-environment', order: 10190,
    text: environmentText(config.environment, config.wslDistribution, config.shellNote),
  });
  if (config.ssh) ctx.systemPrompt.section({ name: 'deep-ptc:ssh', order: 10191, text: config.ssh });
}
