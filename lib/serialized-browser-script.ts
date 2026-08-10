export function serializeBrowserFunction(script: () => unknown): string {
  const source = script.toString();
  if (!source.includes("__name(")) return source;

  const bodyStart = source.indexOf("{");
  if (bodyStart === -1) return source;

  // esbuild/tsx may annotate named functions with its module-scoped __name
  // helper. A function serialized with toString() does not carry that helper,
  // so provide the no-op equivalent inside the generated browser script.
  return `${source.slice(0, bodyStart + 1)}const __name=(target)=>target;${source.slice(bodyStart + 1)}`;
}
