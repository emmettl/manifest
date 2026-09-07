import { readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
const root = process.cwd()
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(`${directory}/${item.name}`) : [`${directory}/${item.name}`])
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
  if (/^(file:|link:|workspace:)|\.\.\//.test(version)) throw new Error(`Repository-local dependency: ${name}`)
  if (name.startsWith('@motionstudies/') && !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) throw new Error(`Unpinned shared package: ${name}`)
}
for (const path of walk('src').filter(path => /\.[cm]?[jt]sx?$/.test(path))) {
  const source = readFileSync(path, 'utf8')
  for (const [, imported] of source.matchAll(/(?:from\s*|import\s*\()?['"]([^'"]+)['"]/g)) {
    if (imported.startsWith('.') && !resolve(dirname(path), imported).startsWith(root + '/')) throw new Error(`Cross-repository source import: ${path}`)
  }
}
console.log('Edition boundary and exact Motion Studies package pins verified.')
