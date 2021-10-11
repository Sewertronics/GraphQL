// deno-lint-ignore-file no-explicit-any

import { gql, ASTNode, BooleanValueNode, DirectiveDefinitionNode, DocumentNode, EnumTypeDefinitionNode, EnumValueDefinitionNode, FieldDefinitionNode, FloatValueNode, InputObjectTypeDefinitionNode, InputValueDefinitionNode, InterfaceTypeDefinitionNode, IntValueNode, ListTypeNode, ListValueNode, NamedTypeNode, NameNode, NonNullTypeNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, ScalarTypeDefinitionNode, StringValueNode, UnionTypeDefinitionNode } from "./deps.ts";

export class SchemaAST {
  private _schema!: string;
  private _AST!: DocumentNode;

  constructor(schema: string[]) {
    this.schema = schema.reduce((schema1: string, schema2: string, index: number) => {
      try {
        if (index === 0)
          return schema2;
        const schemaAST = gql(schema2);
        gql(schema1).definitions.forEach((obj: any) => {
          try {
            (schemaAST.definitions.filter(({ kind }: any) => kind === obj.kind).find((obj2: any) => obj2.name.value === obj.name.value) as any).fields.unshift(...obj.fields);
          } catch {
            (schemaAST.definitions as any).unshift(obj);
          }
          });
        return SchemaAST.ASTToSchema(schemaAST as any);
      } catch {
        return schema1;
      }
    }, schema[0]);
  }

  private static tab = (text: string) => text.split("\n").map((line: string) => `\t${line}`).join("\n");

  static readonly Functions: {
    [x: string]: (obj: any) => string;
  } = {
    DirectiveDefinition: (obj: DirectiveDefinitionNode) => `${this.ASTToSchema(obj?.description)}directive @${this.ASTToSchema(obj.name)}${obj?.arguments?.length ? `(\n${obj?.arguments?.map(this.ASTToSchema).join("\n")}\n)` : ""}${obj?.repeatable ? " repeatable" : ""} on ${obj?.locations?.map(this.ASTToSchema).join(" | ")}`,
    InterfaceTypeDefinition: (obj: InterfaceTypeDefinitionNode) => `interface ${this.ASTToSchema(obj?.name)} {\n${obj?.fields?.map(this.ASTToSchema).join("\n")}\n}`,
    InputObjectTypeDefinition: (obj: InputObjectTypeDefinitionNode) => `input ${this.ASTToSchema(obj?.name)} {\n${obj?.fields?.map(this.ASTToSchema).join("\n")}\n}`,
    ObjectTypeDefinition: (obj: ObjectTypeDefinitionNode) => `type ${this.ASTToSchema(obj?.name)}${obj?.interfaces?.length ? ` implements ${obj.interfaces?.map(this.ASTToSchema).join(" & ")}` : ""} {\n${obj?.fields?.map(this.ASTToSchema).join("\n")}\n}`,
    EnumTypeDefinition : (obj: EnumTypeDefinitionNode) => `enum ${this.ASTToSchema(obj?.name)} {\n${obj.values?.map((obj: EnumValueDefinitionNode) => this.ASTToSchema(obj)).join("\n")}\n}`,
    ScalarTypeDefinition : (obj: ScalarTypeDefinitionNode) => `scalar ${this.ASTToSchema(obj?.name)}`,
    UnionTypeDefinition: (obj: UnionTypeDefinitionNode) => `union ${this.ASTToSchema(obj?.name)}${obj.types?.length ? ` = ${obj.types?.map(this.ASTToSchema).join(" | ")}` : ""}`,
    ListType: (obj: ListTypeNode) => `[${this.ASTToSchema(obj?.type)}]`,
    NonNullType: (obj: NonNullTypeNode) => `${this.ASTToSchema(obj?.type)}!`,
    NamedType: (obj: NamedTypeNode) => this.ASTToSchema(obj.name),
    Name: (obj: NameNode) => obj?.value ?? "",
    FieldDefinition: (obj: FieldDefinitionNode) => this.tab(`${this.ASTToSchema(obj?.description)}${this.ASTToSchema(obj?.name)}${obj?.arguments?.length ? `(\n${obj?.arguments?.map(this.ASTToSchema).join("\n")}\n)` : ""}: ${this.ASTToSchema(obj?.type)}`),
    InputValueDefinition: (obj: InputValueDefinitionNode) => this.tab(`${this.ASTToSchema(obj?.description)}${obj?.description?.value && !obj?.description?.block ? " " : ""}${this.ASTToSchema(obj?.name)}: ${this.ASTToSchema(obj?.type)}${obj?.defaultValue ? ` = ${this.ASTToSchema(obj?.defaultValue)}` : ""}` || ""),
    EnumValueDefinition: (obj: EnumValueDefinitionNode) => this.tab(`${this.ASTToSchema(obj?.description)}${this.ASTToSchema(obj.name)}`),
    StringValue: (obj: StringValueNode) => obj?.value ? obj?.block ? `"""\n${obj.value}\n"""\n` : `"${obj.value}"` : "",
    IntValue: (obj: IntValueNode) => obj?.value || "",
    BooleanValue: (obj: BooleanValueNode) => obj?.value as unknown as string ?? "",
    FloatValue: (obj: FloatValueNode) => obj?.value || "",
    ListValue: (obj: ListValueNode) => `[${obj?.values?.map(this.ASTToSchema).join(", ")}]`,
    Document: (obj: DocumentNode) => obj.definitions.map(this.ASTToSchema).join("\n\n"),
    ObjectTypeExtension: (obj: ObjectTypeExtensionNode) => `extend type ${this.ASTToSchema(obj?.name)}${obj?.interfaces?.length ? ` implements ${obj.interfaces?.map(this.ASTToSchema).join(" & ")}` : ""} {\n${obj?.fields?.map(this.ASTToSchema).join("\n")}\n}`
  };

  private static ASTToSchema = (definition?: ASTNode): string => definition ? this.Functions[definition.kind](definition) : "";

  get schema() {
    return this._schema;
  }

  set schema(schema: string) {
    this._schema = schema;
    this.AST = gql(this._schema);
  }

  get AST() {
    return this._AST;
  }

  set AST(AST: DocumentNode) {
    this._AST = AST;
  }
}