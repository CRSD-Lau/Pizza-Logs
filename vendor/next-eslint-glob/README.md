---
author: Neil Mitchell
last_modified_by: Neil Mitchell
---

# Next ESLint directory adapter

This private development package replaces only the `fast-glob` dependency of
`@next/eslint-plugin-next@16.3.6`. The root development dependency named
`fast-glob` points to this local package, whose own name remains
`@pizza-logs/next-eslint-glob`; npm's `$fast-glob` override reuses that same
dependency for the exact plugin version. It supports that plugin's
`globSync(string, { onlyDirectories: true })` call, not the general fast-glob API.
Unsupported options throw so an upstream caller change cannot silently weaken linting.

The original dependency reaches unpatched `braces` 3.0.3
([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)).
Pinned tinyglobby replaces that dependency without an audit exception or install-time
patch. Literal paths preserve their spelling. Dynamic paths disable directory
expansion and retain absolute/relative output, `./` prefixes and directory filtering.

The real installed Next helper is covered by `tests/next-eslint-root-dirs.test.ts`.
On a Next plugin upgrade, inspect its consumer and update the exact-version override
only after compatibility tests and the dependency audit pass. Remove this package
when upstream provides a compatible dependency chain without the advisory.

Both Docker dependency stages copy this package before `npm ci`; the builder also
copies the installed adapter from the dependency stage so linked package
dependencies are retained. It is a development dependency and is omitted
from the final production dependency tree.
