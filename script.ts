// deno-lint-ignore-file no-empty

import { Command } from "https://deno.land/x/cliffy@v0.19.5/command/mod.ts";
import config from "./config.ts";

const params = await new Command()
  .name("script")
  .version("1.0.0\n")
  .description("Auto creating tasks.json file in the .vscode catalog")
  .option("-p, --path [path]", "Set watched path.", { default: "." })
  .option("-d.r, --repository [repository]", "Set docker repository address with port.", { default: "217.98.81.87:5000" })
  .option("-d.u, --user [user]", "Set user name for the docker repository.", { default: "user" })
  .option("-d.p, --password [password]", "Set password for the docker repository.", { default: "password" })
  .option("--port <port:integer>", "Set port for the docker container.", { default: 3010 })
  .option("-a, --args <args:string[]>", "Set rest of params for the script.")
  .parse(Deno.args);

const { options: { path, repository, user, password, port, args } } = params;

const arg = args?.join(" ");
const arg2 = arg ? ` ${arg}` : "";

const dockerAuth = (cmd: string[]) => {
  cmd.unshift(`docker login ${repository} -u=${user} -p=${password}`);
  cmd.push(`docker logout`);
  return cmd;
};

const image = `${repository}/${config.appName}`;
const imageWithVerison = `${image}:${config.version}`;

interface Task {
  label: string;
  command: string[];
}

interface Task2 {
  type: string,
  command: string;
  label: string;
  detail: string;
}

interface Tasks {
  version: string;
  tasks: Task2[];
}

const cmd = new Map<string, Task>();

cmd.set("cache", {
  label: "Cache all dependencies",
  command: [
    `deno cache --lock=lock.json --lock-write --import-map=import_map.json --reload deps.ts`
  ]
});
cmd.set("build", {
  label: "Build the application",
  command: [
    `deno compile -A --import-map=import_map.json --lock=lock.json --lock-write --unstable -o app main.ts`,
    `chmod 111 app`
  ]
});
cmd.set("image", {
  label: "Build the image",
  command: [
    ...cmd.get(`build`)?.command || [],
    `docker build . -t ${image}`,
    `docker tag ${image} ${imageWithVerison}`,
    `rm app`
  ]
});
cmd.set("dev", {
  label: "Run the development server",
  command: [
    `deno run -A --import-map=import_map.json --lock=lock.json --lock-write --watch --unstable main.ts`
  ]
});
cmd.set("tree", {
  label: "Show all dependencies as tree (add --json flag to show as JSON object)",
  command: [
    `deno info --import-map=import_map.json main.ts`
  ]
});
cmd.set("start", {
  label: "Start the application",
  command: [
    `./app`
  ]
});
cmd.set("debug", {
  label: "Start debug session for development mode only",
  command: [
    `deno run -A --import-map=import_map.json --lock=lock.json --lock-write --inspect main.ts`
  ]
});
cmd.set("fmt", {
  label: "Format all the source files",
  command: [
    `deno fmt --watch main.*${arg2}`,
  ]
});
cmd.set("gitclear", {
  label: "Remove unused commits from the reflog",
  command: [
    `git reflog expire --expire-unreachable=now --all; git fsck --unreachable; git gc --prune=now`
  ]
});
cmd.set("test", {
  label: "Run tests",
  command: [
    `deno test -Aq --unstable --lock=lock.json --lock-write --watch${arg2}`
  ]
});
cmd.set("container", {
  label: "Run container with deployed application",
  command: dockerAuth([
    `docker run -d --name ${config.appName} -p ${port}:${config.port} ${imageWithVerison}`
  ])
});
cmd.set("push", {
  label: "Push application to the sewertronics docker repository",
  command: dockerAuth([
    `docker push ${imageWithVerison}`,
    `docker push ${image}`
  ])
});
cmd.set("prod", {
  label: "Runs all steps to deploy the application",
  command: [
    ...cmd.get(`image`)?.command || [],
    ...cmd.get(`push`)?.command || []
  ]
});

const tasks: Tasks = {
  version: "2.0.0",
  tasks: []
};
for (const [ key, { label, command } ] of cmd.entries()) {
  command.unshift(`cd ${path}`);
  tasks.tasks.push({
    type: "shell",
    command: command.join("; "),
    label,
    detail: key
  });
}

const tasksJson = `./.vscode/tasks.json`;

try {
  JSON.parse(new TextDecoder().decode(Deno.readFileSync(tasksJson))).tasks.forEach((input: Task2) => (Object.keys(input) as (keyof Task2)[]).forEach((key: keyof Task2) => {
    const r = tasks.tasks.find(({ detail, label }: Task2) => detail === input.label || label === input.label) as Task2;
    if (r)
      return r[key] = input[key];
    else tasks.tasks.unshift(input);
  }));
} catch {
} finally {
  Deno.writeFileSync(tasksJson, new TextEncoder().encode(JSON.stringify(tasks, null, 2)));
}