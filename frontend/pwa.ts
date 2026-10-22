import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

/** Content-derived version includes HTML, scripts, styles, fonts, icons and worker logic. */
export function buildWorker(directory: string, template: string): string {
  function files(prefix = ''): string[] {
    return readdirSync(resolve(directory, prefix), {
      withFileTypes: true,
    }).flatMap((entry) => {
      const name = prefix + entry.name;
      return entry.isDirectory() ? files(name + '/') : [name];
    });
  }
  const shell = files()
    .filter(
      (name) =>
        name !== 'sw.js' &&
        !/^(api|files)(\/|$)/.test(name) &&
        /\.(html|js|css|woff2?|png|svg|webmanifest)$/.test(name),
    )
    .sort();
  const hash = createHash('sha256').update(template);
  for (const path of shell)
    hash.update(path).update(readFileSync(resolve(directory, path)));
  return template
    .replace(
      "'__BUILD_CACHE__'",
      JSON.stringify(`planer-shell-${hash.digest('hex').slice(0, 20)}`),
    )
    .replace(
      'const SHELL = [];',
      `const SHELL = ${JSON.stringify(shell.map((path) => '/' + path))};`,
    );
}
export function pwa(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'planer-pwa',
    apply: 'build',
    configResolved(value) {
      config = value;
    },
    writeBundle() {
      const directory = resolve(config.root, config.build.outDir);
      writeFileSync(
        resolve(directory, 'sw.js'),
        buildWorker(
          directory,
          readFileSync(resolve(config.root, 'worker/sw.js'), 'utf8'),
        ),
      );
    },
  };
}
