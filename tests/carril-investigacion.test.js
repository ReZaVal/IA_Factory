// T4.1 (memoria.md D8): el carril investigación trae su constitución.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const INSTALAR = path.join(RAIZ, "instalar.sh");
const CONSTITUCION = path.join(RAIZ, "skills/ia-factory/carriles/investigacion/constitucion-investigacion.md");

describe("carril investigacion — constitución (T4.1)", () => {
  const texto = existsSync(CONSTITUCION) ? readFileSync(CONSTITUCION, "utf8") : "";

  it("existe y numera sus reglas duras C1…Cn sin repetir ids", () => {
    const ids = [...texto.matchAll(/^- \*\*(C\d+)\*\* —/gm)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each([
    ["estilo de cita APA/IEEE", /APA/i, /IEEE/i],
    ["corpus como única fuente citable", /research\/corpus\//],
    ["DOI verificado", /DOI/],
    ["prohibido inventar referencias", /inventa|fabric/i],
    ["afirmación con fuente", /afirmaci[oó]n/i],
    ["metodología antes de resultados", /metodolog[ií]a/i],
    ["reproducibilidad del análisis", /semilla|reproduc/i],
    ["sin datos personales ni secretos", /participante|personal/i],
    ["limitaciones declaradas", /limitaci[oó]n|limitaciones/i]
  ])("cubre: %s", (_n, ...patrones) => {
    for (const p of patrones) expect(texto).toMatch(p);
  });
});

describe("instalar.sh --carril investigacion (T4.1)", () => {
  it("copia constitucion-investigacion.md", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "inv-"));
    execFileSync(INSTALAR, [dir, "--carril", "investigacion"], { encoding: "utf8" });
    expect(existsSync(path.join(dir, "constitucion-investigacion.md"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
