// T4.4: roles del carril investigación (citas y metodología), mismos nombres que software/ml.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { rutaRol } from "../skills/ia-factory/plantillas/revision/scripts/revision/gemini.mjs";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ROLES = path.join(RAIZ, "skills/ia-factory/carriles/investigacion/revision/scripts/revision/roles/investigacion");
const leer = (n) => (existsSync(path.join(ROLES, n)) ? readFileSync(path.join(ROLES, n), "utf8") : "");

describe("roles investigación (T4.4)", () => {
  it.each([
    ["seguridad.md", [/cita/i, /corpus/i, /DOI/, /Superficie de entrada/, /## Sondas/, /POR VERIFICAR/, /no (cites|escribas|nombres).*local_privado/i,
      /verificar-doi/, /memoria/i]],
    ["logica.md", [/metodolog[ií]a/i, /hip[oó]tesis|pregunta/i, /## Sondas/, /limitaci/i, /causa|correlaci[oó]n/i, /reproduc|semilla/i, /fuente/i]]
  ])("%s trae su especialidad y lo que exige el contrato", (archivo, patrones) => {
    const t = leer(archivo);
    expect(t).toMatch(/^# Rol:/);
    for (const p of patrones) expect(t).toMatch(p);
  });

  it("cada rol cita reglas de la constitución del carril", () => {
    for (const a of ["seguridad.md", "logica.md"]) expect(leer(a)).toMatch(/\bC(1|2|3|5|6|7|8|9|10)\b/);
  });

  it("seguridad dice que el DOI lo verifica el script, no el modelo", () => {
    expect(leer("seguridad.md")).toMatch(/no (afirmes|asumas|des por).*DOI|DOI.*(lo verifica|verifica el script)/is);
  });

  it("rutaRol resuelve el rol del carril investigacion", () => {
    expect(rutaRol(path.dirname(ROLES), "investigacion", "logica")).toBe(path.join(ROLES, "logica.md"));
  });

  it("--carril investigacion instala los roles en roles/investigacion/ sin pisar los comunes", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "inv-"));
    execFileSync(path.join(RAIZ, "instalar.sh"), [dir, "--carril", "investigacion"], { encoding: "utf8" });
    for (const r of ["seguridad", "logica"]) expect(existsSync(path.join(dir, `scripts/revision/roles/investigacion/${r}.md`))).toBe(true);
    expect(existsSync(path.join(dir, "scripts/revision/roles/logica.md"))).toBe(false);
    expect(existsSync(path.join(dir, "scripts/revision/gemini.mjs"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
