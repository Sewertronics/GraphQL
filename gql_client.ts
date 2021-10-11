import axiod from "https://deno.land/x/axiod/mod.ts";

export class GraphQLClient {
  constructor(private location: { hostname: string, port: number, protocol: string }, private portOffset: number = 1) {
  }

  private graphql = async (
    type: "query" | "mutation",
    name: string,
    query = "",
  ) => {
    try {
      const result = async (devMode = false) => (await axiod.post(`${this.location.protocol}//${this.location.hostname}:${parseInt(this.location.port as unknown as string) + (devMode as unknown as number) * this.portOffset}/graphql`, {
        query: `
          ${type} {
            ${name}${query}
          }
        `,
      })).data.data[name];
      try {
        return await result();
      } catch {
        return await result(true);
      }
    } catch {
      return undefined;
    }
  };

  query = async (name: string, query = "") => await this.graphql("query", name, query);

  mutation = async (name: string, query = "") => await this.graphql("mutation", name, query);
}