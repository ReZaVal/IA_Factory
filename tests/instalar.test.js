// instalar.sh (T1.2-T1.3, memoria.md D8): el carril software reproduce 1.0 --con-revision + lo nuevo de 1.1.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, statSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const INSTALAR = path.resolve(import.meta.dirname, "../instalar.sh");

// Salida de `instalar.sh --con-revision` en 1.0.0 (commit 8b5f7db).
const ARCHIVOS_1_0 = [
  ".claude/agents/aprobador.md",
  ".claude/agents/constructor.md",
  ".claude/agents/planificador.md",
  ".claude/agents/revisor-codigo.md",
  ".gitignore",
  "AGENTS.md",
  "CLAUDE.md",
  "agente.md",
  "learn.md",
  "manager.md",
  "memoria.md",
  "planner.md",
  "revision.md",
  "scripts/revision/capturas.sh",
  "scripts/revision/gemini.mjs",
  "scripts/revision/roles/_contexto.md",
  "scripts/revision/roles/_formato.md",
  "scripts/revision/roles/logica.md",
  "scripts/revision/roles/seguridad.md",
  "scripts/revision/roles/ui.md"
];
// Lo que 1.1 añade: constitución del carril (T1.2) y auditor de spec (T1.3).
const NUEVOS_1_1 = ["constitucion-software.md", "scripts/revision/roles/spec.md", "scripts/revision/spec.mjs"];

function archivos(dir, base = dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? archivos(p, base) : [path.relative(base, p)];
  });
}

function instalar(...args) {
  const dir = mkdtempSync(path.join(tmpdir(), "ia-factory-"));
  try {
    const out = execFileSync(INSTALAR, [dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { out, lista: archivos(dir).sort(), dir };
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
}

describe("instalar.sh", () => {
  it("--carril software = 1.0 --con-revision + lo nuevo de 1.1", () => {
    const { lista, dir } = instalar("--carril", "software");
    expect(lista).toEqual([...ARCHIVOS_1_0, ...NUEVOS_1_1].sort());
    expect(statSync(path.join(dir, "scripts/revision/capturas.sh")).mode & 0o111).toBeTruthy();
    expect(readFileSync(path.join(dir, ".gitignore"), "utf8")).toMatch(/^\.revision\/$/m);
    rmSync(dir, { recursive: true, force: true });
  });

  it("--con-revision sigue funcionando (alias del carril software)", () => {
    const a = instalar("--con-revision");
    const b = instalar("--carril", "software");
    expect(a.lista).toEqual(b.lista);
    rmSync(a.dir, { recursive: true, force: true });
    rmSync(b.dir, { recursive: true, force: true });
  });

  it("sin opciones instala solo el núcleo del harness", () => {
    const { lista, dir } = instalar();
    expect(lista).toEqual(["AGENTS.md", "CLAUDE.md", "agente.md", "learn.md", "manager.md", "memoria.md", "planner.md"]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rechaza un carril que no existe", () => {
    expect(() => instalar("--carril", "cocina")).toThrow();
  });

  it("no sobrescribe: la segunda instalación copia 0", () => {
    const { dir } = instalar("--carril", "software");
    const out = execFileSync(INSTALAR, [dir, "--carril", "software"], { encoding: "utf8" });
    expect(out).toMatch(/Listo: 0 copiados/);
    rmSync(dir, { recursive: true, force: true });
  });
});
