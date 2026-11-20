import { spawnSync } from 'node:child_process'
const result = spawnSync(
  process.execPath,
  ['node_modules/@rspack/cli/bin/rspack.js', 'build', '-c', 'rspack.config.ts'],
  {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  }
)
process.exitCode = result.status ?? 1
