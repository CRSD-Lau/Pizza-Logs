"use strict";

// minimatch 11 exposes its matcher as a named export. Older ESLint plugins
// still call CommonJS `require("minimatch")` directly, so retain that callable
// contract while using the patched implementation everywhere.
const implementation = require("minimatch-v11");
const callable = implementation.minimatch;

Object.assign(callable, implementation);

module.exports = callable;
