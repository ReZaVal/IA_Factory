// El rol Lógica del carril software acota la severidad de los hallazgos sobre tests (D20, T2.7).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rol = readFileSync("skills/ia-factory/carriles/software/revision/scripts/revision/roles/logica.md", "utf8");

describe("rol logica (software)", () => {
  it("limita a MEDIUM los hallazgos sobre tests débiles o ausentes", () => {
    expect(rol).toMatch(/test d[eé]bil[^.]*m[aá]ximo \*\*MEDIUM\*\*/i);
    expect(rol).toMatch(/no lo marques\s+HIGH ni CRITICAL/i);
  });
  it("sigue pidiendo tests que fallen si el código se rompe y casos borde", () => {
    expect(rol).toMatch(/no tautol[oó]gicos/);
    expect(rol).toMatch(/listas vac[ií]as/);
  });
});
