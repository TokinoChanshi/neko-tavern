import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const cscCandidates = [
  'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
  'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
]

const csc = cscCandidates.find((p) => existsSync(p))
if (!csc) {
  console.error('未找到 Windows .NET C# 编译器 (csc.exe)。')
  process.exit(1)
}

const src = resolve(root, 'client', 'NekoTavernClient.cs')
const ico = resolve(root, 'client', 'app.ico')

const targets = [
  {
    label: '桌面宽屏客户端',
    out: resolve(root, '猫猫酒馆客户端.exe'),
    defines: [],
  },
  {
    label: '手机 APP 独立小窗端',
    out: resolve(root, '猫猫酒馆·手机APP模式.exe'),
    defines: ['/define:DEFAULT_MOBILE'],
  },
]

for (const item of targets) {
  const args = [
    '/nologo',
    '/codepage:65001',
    '/target:winexe',
    '/optimize+',
    ...item.defines,
    `/win32icon:${ico}`,
    `/out:${item.out}`,
    '/r:System.dll',
    '/r:System.Core.dll',
    '/r:System.Drawing.dll',
    '/r:System.Windows.Forms.dll',
    src,
  ]

  const res = spawnSync(csc, args, { stdio: 'inherit', cwd: root })
  if (res.status !== 0) {
    process.exit(res.status ?? 1)
  }
  const sizeKb = (statSync(item.out).size / 1024).toFixed(1)
  console.log(`✓ 已生成 ${item.label}：${item.out} (${sizeKb} KB)`)
}
