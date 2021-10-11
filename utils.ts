// deno-lint-ignore-file no-explicit-any

import { exec, OutputMode } from "https://deno.land/x/exec@0.0.5/mod.ts";

export const catchAndReturn = async (
  func: () => any,
  def: any = undefined,
): Promise<any> => {
  try {
    return await func();
  } catch {
    return await def;
  }
};

export const run = async (cmd: string, output = OutputMode.Capture) => await exec(cmd, {
  output
});

export const getEnv = (env: string, def: any = "") => Deno.env.get(env) ?? def;