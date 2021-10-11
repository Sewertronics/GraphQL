// deno-lint-ignore-file no-explicit-any

export default (obj: any) => ({
  version: () => obj.config.version
});