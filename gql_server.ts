// deno-lint-ignore-file no-explicit-any

import { Application, Router, applyGraphQL, oakCors, killProcessOnPort, gql } from "./deps.ts";
import { SchemaAST } from "./gql_tools.ts";
import Query from "./resolvers/query.ts";
import Mutation from "./resolvers/mutation.ts";
import files from "./files.ts";

interface IConfig {
  Query?: any;
  Mutation?: any;
  logs?: (version: string, port: number) => void;
  middleware?: (ctx: any) => void;
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
  private app: any;
  private config: Config = {
    version: "0.0.0",
    port: 80,
    schema: files.get("schema.graphql") || "",
    logs: (version: string, port: number) => {
      console.log(`Version: v${version}`);
      console.log(`Server running 🚀 http://localhost:${port}/graphql`);
    },
    Query: Query(this),
    Mutation: Mutation(this)
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
      resolvers: getObject(this.config)
    });
    this.app.use(GraphQLService.routes(), GraphQLService.allowedMethods());
    this.app.use((ctx: any) => {
      if (this.config.middleware)
        this.config.middleware(ctx);
    });
    await killProcessOnPort(this.config.port);
    if (this.config.logs)
      this.config.logs(this.config.version, this.config.port);
    await this.app.listen({
      port: this.config.port,
      signal: (new AbortController()).signal
    });
  }
}