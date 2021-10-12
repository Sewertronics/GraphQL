// deno-lint-ignore-file no-explicit-any

import { Application, Context, Router, applyGraphQL, oakCors, killProcessOnPort, gql } from "./deps.ts";
import { SchemaAST } from "./gql_tools.ts";
import Query from "./resolvers/query.ts";
import Mutation from "./resolvers/mutation.ts";
import files from "./files.ts";
import { Session, CookieStore } from "https://deno.land/x/oak_sessions@v3.1.2/mod.ts";

export { Context } from "./deps.ts";

interface IConfig {
  Query?: any;
  Mutation?: any;
  logs?: (version: string, port: number) => void;
  middleware?: (ctx: Context, next: any) => any;
  authorization?: (user: string, password: string) => Promise<boolean>;
  path?: string;
}

interface OptConfig extends IConfig {
  version?: string;
  port?: number;
  schema?: string;
}

interface Config extends IConfig {
  version: string;
  port: number;
  schema: string;
}

const getObject = (config: any) => {
  const obj = {
  };
  Object.keys(config).forEach((field: string) => {
    if (Object.keys(config[field]).length && typeof config[field] === "object")
      (obj as any)[field] = config[field];
  });
  return obj;
}

export class GraphQLServer {
  private app: Application;
  private config: Config = {
    version: "0.0.0",
    port: 80,
    schema: files.get("schema.graphql") || "",
    logs: (version: string, port: number) => {
      console.log(`Version: v${version}`);
      console.log(`Server running 🚀 http://localhost:${port}/graphql`);
    },
    Query: Query(this),
    Mutation: Mutation(this),
    middleware: async (_: Context, next: any) => await next(),
    authorization: async () => await true,
    path: "/graphql"
  };

  constructor(config?: OptConfig) {
    (Object.keys(this.config) as (keyof Config)[]).forEach((field: keyof Config) => {
      if (typeof this.config[field] === "object")
        Object.assign(this.config[field], config?.[field]);
      else if (field === "schema")
        this.config.schema = new SchemaAST([
          this.config.schema,
          config?.schema ?? ""
        ]).schema
      else if (config?.[field])
        (this.config[field] as any) = config?.[field];
    });
    this.app = new Application();
    this.app.use(oakCors());
  }

  async listen() {
    const GraphQLService = await applyGraphQL<Router>({
      Router,
      typeDefs: gql(this.config.schema),
      resolvers: getObject(this.config),
      path: this.config.path,
      settings: {
        "request.credentials": "include"
      }
    });
    const session = new Session(new CookieStore('very-secret-key'));
    this.app.use(session.initMiddleware(), async (ctx: Context, next: any) => {
      if (ctx.request.headers.get("Authorization"))
        await ctx.state.session.set("token", atob(ctx.request.headers.get("Authorization")?.split(" ")[1] || ""));
      const [ user, password ] = (await ctx.state.session.get("token"))?.split(":") || [];
      if (this.config.authorization && !await this.config.authorization(user, password)) {
        ctx.response.headers.set("WWW-Authenticate", "Basic");
        ctx.response.status = 401;
      } else await next();
    });
    this.app.use(async (context: Context, next: any) => {
      if (context.request.url.pathname === this.config.path)
        await next();
      else if (this.config.middleware)
        await this.config.middleware(context, next);
    });
    this.app.use(GraphQLService.routes(), GraphQLService.allowedMethods());
    await killProcessOnPort(this.config.port);
    if (this.config.logs)
      this.config.logs(this.config.version, this.config.port);
    await this.app.listen({
      port: this.config.port,
      signal: (new AbortController()).signal
    });
  }
}