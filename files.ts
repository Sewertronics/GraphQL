import { decode } from "https://deno.land/std/encoding/base64.ts";

const files = new Map<"schema.graphql", string>();
files.set("schema.graphql", new TextDecoder().decode(decode("dHlwZSBRdWVyeSB7CgkiIiIKCVJldHVybiBhY3R1YWwgdmVyc2lvbiBvZiB0aGUgYXBwbGljYXRpb24KCSIiIgoJdmVyc2lvbjogU3RyaW5nIQp9")));

export default files;