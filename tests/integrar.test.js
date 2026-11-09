// Integración (D4, T2.6): RECHAZADO no toca nada, PR abre un PR, MERGE espera al CI y mezcla.
// Git real (repo + remoto bare); `gh` simulado, sin red.
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { emitirRevisor, emitirAprobador } from "../skills/ia-factory/plantillas/revision/scripts/revision/dictamen.mjs";
import { integrar, ejecutar, tituloPr, cuerpoPr } from "../skills/ia-factory/plantillas/revision/scripts/revision/integrar.mjs";

const ENV = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", env: { ...process.env, ...ENV } });

let repo, remoto, llamadas;
const gate = (resultado, extra = {}) => ({ tarea: "T9.1", ronda: 1, resultado, radio: resultado === "RECHAZADO" ? "nucleo" : "bajo", motivos: ["motivo"], ...extra });
const conGate = (g) => async () => g;

/** `gh` simulado: registra cada llamada y responde según `respuestas`. */
function simulador(respuestas = {}) {
  return (cmd, args, { cwd }) => {
    if (cmd === "git") {
      const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...ENV } });
      llamadas.push(["git", ...args]);
      return { codigo: r.status ?? 1, salida: (r.stdout ?? "").trim(), error: (r.stderr ?? "").trim() };
    }
    llamadas.push(["gh", ...args]);
    const clave = args.slice(0, 2).join(" ");
    return respuestas[clave] ?? { codigo: 0, salida: "https://github.com/o/r/pull/7", error: "" };
  };
}
const ghs = () => llamadas.filter((l) => l[0] === "gh").map((l) => l.slice(1, 3).join(" "));

beforeEach(() => {
  llamadas = [];
  const dir = mkdtempSync(path.join(tmpdir(), "int-"));
  remoto = path.join(dir, "remoto.git");
  repo = path.join(dir, "repo");
  git(dir, "init", "-q", "--bare", "-b", "main", remoto);
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  writeFileSync(path.join(repo, ".gitignore"), ".revision/\n");
  writeFileSync(path.join(repo, "a.js"), "export const a = 1;\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  git(repo, "remote", "add", "origin", remoto);
  git(repo, "push", "-q", "-u", "origin", "main");
  git(repo, "checkout", "-q", "-b", "fabrica/T9.1");
  writeFileSync(path.join(repo, "a.js"), "export const a = 2;\n");
  git(repo, "commit", "-q", "-am", "cambio");
  mkdirSync(path.join(repo, ".revision/T9.1"), { recursive: true });
  writeFileSync(path.join(repo, ".revision/T9.1/veredicto.md"), "# Veredicto: APROBADO\n\nTodo cumple la spec.\n");
});

const base = (extra = {}) => ({ raiz: repo, tarea: "T9.1", ronda: 1, base: "main", run: simulador(), evaluarGate: conGate(gate("MERGE")), ...extra });

describe("integrar", () => {
  it("RECHAZADO: no sube la rama ni abre nada", async () => {
    const r = await integrar(base({ evaluarGate: conGate(gate("RECHAZADO", { motivos: ["suite roja"] })) }));
    expect(r).toMatchObject({ accion: "rechazado", motivos: ["suite roja"] });
    expect(ghs()).toEqual([]);
    expect(llamadas.some((l) => l.includes("push"))).toBe(false);
  });

  it("PR: sube la rama y abre el PR, sin esperar CI ni mezclar", async () => {
    const r = await integrar(base({ evaluarGate: conGate(gate("PR", { radio: "nucleo", motivos: ["toca el núcleo"] })) }));
    expect(r).toMatchObject({ accion: "pr", url: "https://github.com/o/r/pull/7" });
    expect(ghs()).toEqual(["pr create"]);
    expect(git(remoto, "branch", "--list", "fabrica/T9.1").trim()).toBe("fabrica/T9.1");
  });

  it("MERGE con CI en verde: abre el PR, espera los checks y mezcla", async () => {
    const r = await integrar(base());
    expect(r.accion).toBe("merge");
    expect(ghs()).toEqual(["pr create", "pr checks", "pr merge"]);
    expect(llamadas.find((l) => l[1] === "pr" && l[2] === "checks")).toContain("--watch");
  });

  it("MERGE con CI en rojo o sin checks: el PR queda abierto y no se mezcla", async () => {
    for (const ci of [{ codigo: 1, salida: "", error: "tests failed" }, { codigo: 1, salida: "", error: "no checks reported" }]) {
      llamadas = [];
      const r = await integrar(base({ run: simulador({ "pr checks": ci }) }));
      expect(r.accion).toBe("pr");
      expect(r.motivos.join()).toMatch(/CI no quedó en verde/);
      expect(ghs()).not.toContain("pr merge");
    }
  });

  it("los checks tardan en aparecer: reintenta «no checks reported» y luego mezcla", async () => {
    let n = 0;
    const base0 = simulador();
    const run = (cmd, args, o) => (cmd === "gh" && args[1] === "checks" && n++ < 2 ? (llamadas.push(["gh", ...args]), { codigo: 1, salida: "", error: "no checks reported on the 'x' branch" }) : base0(cmd, args, o));
    const pausas = [];
    const r = await integrar(base({ run, pausa: async (ms) => pausas.push(ms) }));
    expect(r.accion).toBe("merge");
    expect(pausas).toEqual([5000, 5000]);
    expect(ghs().filter((g) => g === "pr checks")).toHaveLength(3);
  });

  it("si los checks nunca aparecen, deja el PR abierto tras agotar la espera", async () => {
    const pausas = [];
    const r = await integrar(base({ run: simulador({ "pr checks": { codigo: 1, salida: "", error: "no checks reported" } }), pausa: async (ms) => pausas.push(ms), espera: { intentos: 3, cadaMs: 10 } }));
    expect(r.accion).toBe("pr");
    expect(pausas).toHaveLength(2);
    expect(ghs()).not.toContain("pr merge");
  });

  it("un CI en rojo no se reintenta", async () => {
    const pausas = [];
    await integrar(base({ run: simulador({ "pr checks": { codigo: 1, salida: "", error: "tests failed" } }), pausa: async (ms) => pausas.push(ms) }));
    expect(pausas).toEqual([]);
  });

  it("si la mezcla falla, el PR queda abierto", async () => {
    const r = await integrar(base({ run: simulador({ "pr merge": { codigo: 1, salida: "", error: "not mergeable" } }) }));
    expect(r).toMatchObject({ accion: "pr" });
    expect(r.motivos.join()).toMatch(/no se pudo mezclar/);
  });

  it("si el PR ya existe, lo reutiliza", async () => {
    const r = await integrar(base({ evaluarGate: conGate(gate("PR")), run: simulador({ "pr create": { codigo: 1, salida: "", error: "already exists" }, "pr list": { codigo: 0, salida: "https://github.com/o/r/pull/3", error: "" } }) }));
    expect(r.url).toBe("https://github.com/o/r/pull/3");
  });

  it("--dry-run no sube ni abre nada, pero escribe el veredicto del gatekeeper", async () => {
    const r = await integrar(base({ dryRun: true }));
    expect(r.accion).toBe("simulado");
    expect(r.motivos.join()).toMatch(/esperar el CI y mezclar/);
    expect(ghs()).toEqual([]);
    expect(JSON.parse(readFileSync(path.join(repo, ".revision/T9.1/gatekeeper.json"), "utf8")).resultado).toBe("MERGE");
  });

  it("se niega desde la base, con cambios sin confirmar o si git push falla", async () => {
    git(repo, "checkout", "-q", "main");
    await expect(integrar(base())).rejects.toThrow(/nunca desde la base/);
    git(repo, "checkout", "-q", "fabrica/T9.1");
    writeFileSync(path.join(repo, "a.js"), "export const a = 3;\n");
    await expect(integrar(base())).rejects.toThrow(/sin confirmar/);
    git(repo, "checkout", "-q", "--", "a.js");
    git(repo, "remote", "set-url", "origin", path.join(remoto, "no-existe"));
    await expect(integrar(base())).rejects.toThrow(/git push falló/);
  });

  it("pasa al gatekeeper la base remota, el comando de tests y el auto-merge", async () => {
    let visto;
    await integrar(base({ tests: "npm run t", automerge: true, dryRun: true, evaluarGate: async (a) => ((visto = a), gate("PR")) }));
    expect(visto).toMatchObject({ base: "origin/main", tests: "npm run t", automerge: true, tarea: "T9.1" });
  });
});

describe("textos del PR", () => {
  it("el título lleva la tarea y la primera línea útil del veredicto", () => {
    expect(tituloPr("T9.1", "# Veredicto: APROBADO\n\nTodo cumple la spec.\n")).toBe("T9.1: Todo cumple la spec.");
    expect(tituloPr("T9.1", "")).toMatch(/^T9\.1: /);
  });
  it("el cuerpo trae el veredicto del gatekeeper y sus motivos", () => {
    const c = cuerpoPr({ tarea: "T9.1", ronda: 2, veredicto: "# Veredicto: APROBADO", gate: gate("PR", { motivos: ["toca el núcleo"] }) });
    expect(c).toMatch(/Gatekeeper:\*\* PR · radio bajo/);
    expect(c).toMatch(/- toca el núcleo/);
  });
});

describe("ejecutar", () => {
  it("devuelve código, salida y error", () => {
    expect(ejecutar("node", ["-e", "console.log('hola')"], { cwd: tmpdir() })).toMatchObject({ codigo: 0, salida: "hola" });
    expect(ejecutar("node", ["-e", "process.exit(3)"], { cwd: tmpdir() }).codigo).toBe(3);
  });
});

// Punta a punta con el gatekeeper y el radio reales: solo `gh` está simulado (D4).
describe("de punta a punta", () => {
  const CONTRATO = "\n## Qué verifiqué\n- Leí el diff\n\n## Evidencia\n`evidencia/matriz.md`\n\n## Qué supuse\nNinguno\n\n## Qué no pude verificar\nNada\n";
  const SIN = `## Veredicto: SIN BLOQUEANTES\n\n## Hallazgos\n| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |\n|---|---|---|---|---|\n| — | — | — | Sin hallazgos | — |\n${CONTRATO}`;
  const JUICIO = { hallazgos_confirmados: [], hallazgos_descartados: [], criterios: [{ numero: 1, modo: "ejecutado", evidencia: "matriz.md" }], tests: { comando: "npm test", salida: 0, fecha: "2026-11-09T00:00:00Z" } };

  async function rondaAprobada() {
    const dir = path.join(repo, ".revision/T9.1");
    const roles = ["seguridad", "logica", "codigo"];
    writeFileSync(path.join(dir, "via.md"), "# Vía de T9.1: SDD\n- Revisores (paso 4): `seguridad`, `logica`, `codigo`\n");
    for (const rol of roles) {
      writeFileSync(path.join(dir, `${rol}.md`), SIN);
      await emitirRevisor({ raiz: repo, tarea: "T9.1", ronda: 1, rol });
    }
    writeFileSync(path.join(dir, "veredicto.md"), `# Veredicto: APROBADO\n${CONTRATO}`);
    writeFileSync(path.join(dir, "veredicto.juicio.json"), JSON.stringify(JUICIO));
    await emitirAprobador({ raiz: repo, tarea: "T9.1", ronda: 1, roles });
  }
  const real = (extra = {}) => ({ raiz: repo, tarea: "T9.1", ronda: 1, base: "main", tests: "node -e 0", run: simulador(), ...extra });

  it("bajo riesgo + auto-merge activo → mezcla tras el CI", async () => {
    await rondaAprobada();
    const r = await integrar(real({ automerge: true }));
    expect(r.accion).toBe("merge");
    expect(r.gate).toMatchObject({ resultado: "MERGE", radio: "bajo" });
    expect(ghs()).toEqual(["pr create", "pr checks", "pr merge"]);
  });

  it("bajo riesgo pero auto-merge apagado (D18) → solo PR", async () => {
    await rondaAprobada();
    const r = await integrar(real());
    expect(r.accion).toBe("pr");
    expect(ghs()).toEqual(["pr create"]);
  });

  it("toca el núcleo → PR aunque el auto-merge esté activo", async () => {
    writeFileSync(path.join(repo, "package.json"), "{}\n");
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "deps");
    await rondaAprobada();
    const r = await integrar(real({ automerge: true }));
    expect(r.accion).toBe("pr");
    expect(r.gate.radio).toBe("nucleo");
    expect(r.motivos.join()).toMatch(/package\.json/);
    expect(ghs()).toEqual(["pr create"]);
  });

  it("suite roja → RECHAZADO sin subir nada", async () => {
    await rondaAprobada();
    const r = await integrar(real({ automerge: true, tests: "node -e process.exit(1)" }));
    expect(r.accion).toBe("rechazado");
    expect(ghs()).toEqual([]);
  });
});
