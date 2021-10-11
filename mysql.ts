// deno-lint-ignore-file no-inferrable-types

import { Client, ClientConfig, configLogger } from "https://deno.land/x/mysql/mod.ts";
import { Query, Where } from "https://deno.land/x/sql_builder/mod.ts";
import { catchAndReturn } from "./utils.ts";

export class Mysql {
  private client?: Client;

  constructor(private config: ClientConfig) {
  }

  async connect() {
    this.client = await new Client().connect(this.config);
    await configLogger({
      enable: false
    });
    return this;
  }

  async get(table: string, field: string = "*") {
    return await catchAndReturn(async () =>
      await this.client?.query(
        (new Query()).table(table).select(field).build().trim(),
      )
    );
  }

  async delete(table: string, field: string, data: string) {
    return await catchAndReturn(async () =>
      await this.client?.query(
        (new Query()).table(table).where(Where.field(field).eq(data)).delete()
          .build().trim(),
      )
    );
  }

  async update(table: string, field: string, data: string, value: string) {
    return await catchAndReturn(async () =>
      !!(await this.client?.query(
        (new Query()).table(table).where(Where.field(field).eq(data)).update({
          value,
        }).build().trim(),
      ))
    );
  }

  async create(table: string, data: { [x: string]: string }) {
    return await catchAndReturn(async () =>
      await this.client?.query(
        (new Query()).table(table).insert(data).build().trim(),
      )
    );
  }
}