"use strict";

const { globSync: findEntries, statSync } = require("node:fs");
const { isAbsolute, join, relative } = require("node:path");
const { globSync: findDirectories, isDynamicPattern } = require("tinyglobby");

// This is deliberately only the call used by Next 16.3.6's get-root-dirs.
// Reject a changed caller instead of silently emulating unsupported fast-glob APIs.
function globSync(pattern, options) {
  if (typeof pattern !== "string" || pattern.length === 0) {
    throw new TypeError("Patterns must be a string (non empty) or an array of strings");
  }
  if (!options || options.onlyDirectories !== true
    || Object.keys(options).some(key => key !== "onlyDirectories")) {
    throw new TypeError("Next ESLint glob adapter requires a nonempty string and { onlyDirectories: true }");
  }

  // Preserve literal root spelling, including ./ and a trailing slash. Do not
  // expand an existing directory into all its descendants.
  if (!isDynamicPattern(pattern)) {
    return statSync(pattern, { throwIfNoEntry: false })?.isDirectory() ? [pattern] : [];
  }

  const prefix = pattern.startsWith("./") ? "./" : "";
  // Fast-glob treats a terminal globstar as descendants-only. Tinyglobby also
  // returns each expanded base, so make that contract explicit before brace
  // expansion or matching occurs.
  const searchPattern = /(^|\/)\*\*\/?$/.test(pattern)
    ? `${pattern.replace(/\/$/, "")}/*`
    : pattern;
  const absolutePattern = isAbsolute(pattern);
  const directories = findDirectories(searchPattern, {
    onlyDirectories: true,
    expandDirectories: false,
    absolute: absolutePattern,
  }).map(directory => prefix + directory.replace(/\/$/, ""));

  // Tinyglobby traverses directory links but does not return the link entry
  // itself. Node's glob exposes matching links as Dirents, so supplement only
  // those entries whose targets are directories; ordinary glob results remain
  // entirely tinyglobby-owned.
  const linkedDirectories = findEntries(searchPattern, { withFileTypes: true })
    .filter(entry => entry.isSymbolicLink())
    .map(entry => join(entry.parentPath, entry.name))
    .filter(directory => statSync(directory, { throwIfNoEntry: false })?.isDirectory())
    .map(directory => !absolutePattern && isAbsolute(directory) ? relative(process.cwd(), directory) : directory)
    .map(directory => prefix + directory.replace(/\\/g, "/"));

  return [...new Set([...directories, ...linkedDirectories])];
}

module.exports = { globSync };
