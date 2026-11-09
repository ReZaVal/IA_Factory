#!/usr/bin/env node
// Medición de revisores con defectos sembrados (T2.7, D12/D13). Monta un repo temporal con la
// fábrica instalada y el fixture sin commitear, corre Seguridad y Lógica con cada modelo y puntúa
// los informes contra claves.json.
// Uso: node medir.mjs [--modelos argon,flash,claude] [--roles seguridad,logica] [--variante noejecutar] [--solo-puntuar]
//   --variante noejecutar: añade al rol, solo en el repo temporal, «no tienes herramientas, no ejecutes nada» (L14)
//   --roles: repite solo esos roles y conserva el resto de resultados/<modelo>/meta.json
//   argon = agy/gemini-4-argon-medium · flash = agy/gemini-3.8-flash-medium · claude = claude -p (Sonnet, sin herramientas)
//   --solo-puntuar: no llama a ningún modelo; puntúa lo que ya hay en resultados/<modelo>/
import { readFile, writeFile, mkdir, mkdtemp, copyFile, cp, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { puntuarModelo, tablaMarkdown } from "./puntuar.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(AQUI, "../../../..");
const PRODUCTO = path.join(REPO, "skills/ia-factory/plantillas/revision/scripts/revision");
const ROLES = ["seguridad", "logica"];
const TAREA = "T9.1";
const MODELOS = {
  argon: { motor: "agy", id: "gemini-4-argon-medium" },
  flash: { motor: "agy", id: "gemini-3.8-flash-medium" },
  claude: { motor: "claude", id: "claude-sonnet-5-5" }
};
const VARIANTES = {
  noejecutar: "\n\n## Importante\nNo tienes herramientas: no puedes ejecutar comandos, tests ni leer archivos. Razona solo con la spec y el diff que recibes y responde directamente con el informe.\n"
};
const CONTEXTO = `# Contexto del proyecto (común a todos los revisores)

Revisas cambios de un cuaderno personal de notas (texto libre de la persona usuaria, datos solo en el navegador).

Stack: JavaScript (módulos ES) sin dependencias; tests con node:assert.

Recibes la **spec** de la tarea y el **diff**. Revisa solo tu especialidad; no repitas hallazgos de otras áreas salvo que sean CRITICAL. No inventes código que no está en el diff.
`;

const sh = (cmd, args, cwd, env = {}) => execFileSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", ...env } });

/** Repo temporal: fábrica instalada y confirmada; el fixture queda sin commitear, como lo dejaría el constructor. */
async function prepararRepo(variante) {
  const dir = await mkdtemp(path.join(tmpdir(), "t27-"));
  sh("git", ["init", "-q", "-b", "main"], dir);
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "medicion", type: "module", scripts: { test: "node tests/notas.test.js" } }, null, 2));
  sh(path.join(REPO, "instalar.sh"), [dir, "--carril", "software"], REPO);
  await writeFile(path.join(dir, "scripts/revision/roles/_contexto.md"), CONTEXTO + (VARIANTES[variante] ?? ""));
  sh("git", ["add", "-A"], dir);
  sh("git", ["commit", "-q", "-m", "base"], dir);
  await cp(path.join(AQUI, "fixture"), dir, { recursive: true });
  return dir;
}

/** Diff como lo arma gemini.mjs: todo es archivo nuevo sin seguimiento. */
async function diffNuevos(dir) {
  const nuevos = sh("git", ["ls-files", "--others", "--exclude-standard"], dir).split("\n").filter(Boolean);
  const partes = await Promise.all(nuevos.map(async (f) => `--- /dev/null\n+++ b/${f} (archivo nuevo)\n${(await readFile(path.join(dir, f), "utf8")).split("\n").map((l) => `+${l}`).join("\n")}`));
  return partes.join("\n");
}

async function conAgy(dir, rol, modelo) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ["scripts/revision/gemini.mjs", rol, "--tarea", TAREA], { cwd: dir, encoding: "utf8", env: { ...process.env, AGY_MODEL: modelo.id }, timeout: 1_500_000 });
  if (r.status !== 0) throw new Error(`${rol}/${modelo.id}: ${r.stderr.trim().slice(0, 400)}`);
  return { informe: await readFile(path.join(dir, ".revision", TAREA, `${rol}.md`), "utf8"), segundos: (Date.now() - t0) / 1000, costo: 0 };
}

async function conClaude(dir, rol, modelo) {
  const { buildSystem, buildPrompt, informeValido } = await import(path.join(PRODUCTO, "gemini.mjs"));
  const { validarInforme } = await import(path.join(PRODUCTO, "evidencia.mjs"));
  const roles = path.join(dir, "scripts/revision/roles");
  const rolTexto = [await readFile(path.join(roles, `${rol}.md`), "utf8"), await readFile(path.join(roles, "_sondas.md"), "utf8")].join("\n\n");
  const system = buildSystem({
    contexto: await readFile(path.join(roles, "_contexto.md"), "utf8"), carril: "software",
    constitucion: await readFile(path.join(dir, "constitucion-software.md"), "utf8"), rol: rolTexto, formato: await readFile(path.join(roles, "_formato.md"), "utf8")
  });
  const prompt = buildPrompt({ tarea: TAREA, spec: await readFile(path.join(dir, "specs", `${TAREA}.md`), "utf8"), diff: await diffNuevos(dir) });
  let costo = 0;
  const t0 = Date.now();
  const pedir = async (texto) => {
    const r = spawnSync("claude", ["-p", "--model", modelo.id, "--system-prompt", system, "--tools", "", "--output-format", "json", "--no-session-persistence"], { cwd: dir, input: texto, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 900_000 });
    const salida = JSON.parse(r.stdout || "{}");
    costo += salida.total_cost_usd ?? 0;
    if (r.status !== 0 || salida.is_error || !salida.result) throw new Error(`claude/${rol}: ${(salida.result ?? r.stderr).slice(0, 300)}`);
    return salida.result;
  };
  const spec = await readFile(path.join(dir, "specs", `${TAREA}.md`), "utf8");
  const opciones = { specConSupuestos: false, rol, existe: () => true };
  void spec;
  const informe = await informeValido(pedir, prompt, (t) => validarInforme(t, opciones).problemas);
  return { informe, segundos: (Date.now() - t0) / 1000, costo };
}

async function correr(nombre, roles, variante) {
  const modelo = MODELOS[nombre];
  const dir = await prepararRepo(variante);
  const salida = path.join(AQUI, "resultados", nombre);
  await mkdir(salida, { recursive: true });
  const previo = existsSync(path.join(salida, "meta.json")) ? JSON.parse(await readFile(path.join(salida, "meta.json"), "utf8")) : null;
  const meta = { modelo: modelo.id, motor: modelo.motor, roles: previo?.roles ?? {}, variantes: { ...(previo?.variantes ?? {}), ...(variante ? Object.fromEntries(roles.map((r) => [r, variante])) : {}) } };
  for (const rol of roles) {
    try {
      const r = await (modelo.motor === "agy" ? conAgy : conClaude)(dir, rol, modelo);
      await writeFile(path.join(salida, `${rol}.md`), r.informe);
      meta.roles[rol] = { ok: true, segundos: r.segundos, costo: r.costo };
    } catch (err) {
      meta.roles[rol] = { ok: false, error: err.message };
      process.stderr.write(`✗ ${nombre}/${rol}: ${err.message}\n`);
    }
  }
  await writeFile(path.join(salida, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
}

async function puntuar() {
  const claves = JSON.parse(await readFile(path.join(AQUI, "claves.json"), "utf8"));
  const fuente = await readFile(path.join(AQUI, "fixture/src/notas.js"), "utf8");
  const base = path.join(AQUI, "resultados");
  const porModelo = {};
  const extra = {};
  for (const nombre of existsSync(base) ? await readdir(base) : []) {
    const meta = JSON.parse(await readFile(path.join(base, nombre, "meta.json"), "utf8"));
    const informes = [];
    for (const rol of ROLES) if (meta.roles[rol]?.ok) informes.push({ rol, informe: await readFile(path.join(base, nombre, `${rol}.md`), "utf8") });
    if (!informes.length) { extra[nombre] = "sin datos"; continue; }
    porModelo[nombre] = { ...puntuarModelo(informes, claves, fuente), rolesCompletos: informes.length };
    const seg = Object.values(meta.roles).reduce((n, r) => n + (r.segundos ?? 0), 0);
    const costo = Object.values(meta.roles).reduce((n, r) => n + (r.costo ?? 0), 0);
    extra[nombre] = `${Math.round(seg)} s${costo ? ` · US$ ${costo.toFixed(2)}` : " · agy"}${informes.length < ROLES.length ? ` · ⚠ ${informes.length}/${ROLES.length} roles` : ""}`;
  }
  await writeFile(path.join(AQUI, "resultados.json"), `${JSON.stringify(porModelo, null, 2)}\n`);
  const tabla = tablaMarkdown(porModelo, claves, extra);
  await writeFile(path.join(AQUI, "tabla.md"), `${tabla}\n`);
  process.stdout.write(`${tabla}\n`);
}

const args = process.argv.slice(2);
const roles = args.includes("--roles") ? args[args.indexOf("--roles") + 1].split(",") : ROLES;
const pedidos = (args.includes("--modelos") ? args[args.indexOf("--modelos") + 1] : "argon,flash,claude").split(",");
if (!args.includes("--solo-puntuar")) for (const n of pedidos) {
  if (!MODELOS[n]) throw new Error(`modelo desconocido ${n}`);
  process.stderr.write(`→ ${n}\n`);
  await correr(n, roles, args.includes("--variante") ? args[args.indexOf("--variante") + 1] : undefined);
}
await puntuar();
