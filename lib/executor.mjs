import z from '@deepseek-ai/schemastery';
import { LocalBashExecutor } from '@deepseek-ai/dsh-bash-local';
import { SandboxBashExecutor } from '@deepseek-ai/dsh-bash-sandbox';
import { assertExecutionPolicy, shellArgv } from './model.mjs';

// Uses the host's process handles, output retention, cancellation, jobs and sandbox.
export default class MappedShellExecutor extends SandboxBashExecutor {
  static Config = z.object({
    environment: z.union(['wsl', 'zsh']).required(),
    wslDistribution: z.string().default(''),
    cwd: z.string().volatile(),
    timeoutMs: z.number().min(1).default(120000).volatile(),
    maxTimeoutMs: z.number().min(1).default(600000).volatile(),
    maxOutputBytes: z.number().min(1).default(64000).volatile(),
    maxSpillBytes: z.number().min(1).default(67108864).volatile(),
    graceMs: z.number().min(1).default(3000).volatile(),
  });

  async execute(spec) {
    assertExecutionPolicy(this.config.environment, spec.sandboxPolicy);
    if (spec.sandboxPolicy.mode !== 'danger-full-access') return super.execute(spec);
    const process = await LocalBashExecutor.prototype.executeArgv.call(this, spec,
      shellArgv(this.config.environment, spec, this.config.wslDistribution));
    return SandboxBashExecutor.decorateResult(process, result => ({
      ...result, sandbox: { mode: spec.sandboxPolicy.mode, denied: false },
    }));
  }

  confine(command, policy, signal) {
    assertExecutionPolicy(this.config.environment, policy);
    return this.ctx.sandbox.confine(shellArgv(this.config.environment,
      { command, workdir: policy.workspaceRoot }, this.config.wslDistribution), policy, signal);
  }
}
