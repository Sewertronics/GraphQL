import { encode, basename } from "./deps.ts";

const [ p = "./", outFile = "files.ts", ...filesExt ] = Deno.args;

const reg = new RegExp(`^.+\.(${filesExt.join("|")})$`, "i");

interface Files {
  [x: string]: string;
}

const template = (files: Files) => `import { decode } from "https://deno.land/std/encoding/base64.ts";

const files = new Map<${Object.keys(files).map((file: string) => `"${file}"`).join(" | ")}, string>();
${Object.keys(files).map((file: string) => `files.set("${file}", new TextDecoder().decode(decode("${files[file]}")));`).join("\n")}

export default files;`;

const watcher = Deno.watchFs(p);
for await (const _obj of watcher) {
  if (basename(_obj.paths[0]) === outFile)
    continue;
  const filesMap: Files = {
  };
  for await (const { name } of Deno.readDir(p))
    if (reg.test(name))
      filesMap[name] = encode(new TextDecoder().decode(Deno.readFileSync(name)));
  Deno.writeFileSync(outFile, new TextEncoder().encode(template(filesMap)));
}