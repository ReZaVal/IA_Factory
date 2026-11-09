import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ruta = "skills/ia-factory/plantillas/revision/scripts/revision/dictamen.schema.json";
const schema = JSON.parse(readFileSync(ruta, "utf8"));

describe("dictamen.schema.json (D18)", () => {
  it("define los tres documentos y cada $ref existe", () => {
    const refs = [...JSON.stringify(schema).matchAll(/"\$ref":\s*"#\/\$defs\/(\w+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(schema.$defs[r], r).toBeDefined();
    expect(schema.oneOf).toHaveLength(3);
  });

  it("revisores y aprobador usan los veredictos del contrato", () => {
    expect(schema.$defs.dictamenRevisor.properties.veredicto.enum).toEqual(["SIN BLOQUEANTES", "CON BLOQUEANTES"]);
    expect(schema.$defs.dictamenAprobador.properties.veredicto.enum).toEqual(["APROBADO", "CAMBIOS REQUERIDOS", "BLOQUEADO"]);
  });

  it("el gatekeeper solo puede dar MERGE, PR o RECHAZADO según radio bajo o núcleo", () => {
    const g = schema.$defs.gatekeeper.properties;
    expect(g.resultado.enum).toEqual(["MERGE", "PR", "RECHAZADO"]);
    expect(g.radio.enum).toEqual(["bajo", "nucleo"]);
  });

  it("todo dictamen lleva el hash del informe y las severidades del formato", () => {
    expect(schema.$defs.base.required).toContain("hash_informe");
    expect(schema.$defs.base.properties.hallazgos.items.properties.severidad.enum).toEqual(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
  });
});
