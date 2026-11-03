// Puente a los revisores Gemini (revision.md ## 3, memoria.md D15).
import { describe, it, expect } from "vitest";
import {
  parseArgs,
  forbiddenPaths,
  loadConfig,
  buildPrompt,
  buildSystem,
  clasificarError,
  pedirConReintentos,
  argsAgy,
  mensajeAgy,
  interpretarAgy,
  cumpleFormato
} from "../skills/ia-factory/plantillas/revision/scripts/revision/gemini.mjs";

describe("parseArgs", () => {
  it("lee rol, tarea y base", () => {
    expect(parseArgs(["logica", "--tarea", "T2.5", "--base", "main~1"])).toEqual({ rol: "logica", tarea: "T2.5", base: "main~1", carril: "software", modelos: false });
  });

  it("UI ya no pasa por aquí: lo revisa el agente revisor-ui (D13)", () => {
    expect(() => parseArgs(["ui", "--tarea", "T2.5"])).toThrow(/rol/);
    expect(() => parseArgs(["logica", "--tarea", "T2.5", "--imagen", "a.png"])).toThrow(/desconocido/);
  });

  it("carril por defecto software; --carril lo cambia", () => {
    expect(parseArgs(["logica", "--tarea", "T1.2"]).carril).toBe("software");
    expect(parseArgs(["logica", "--tarea", "T1.2", "--carril", "ml"]).carril).toBe("ml");
  });

  it("rechaza un carril que no es un nombre simple (no sale de la raíz)", () => {
    expect(() => parseArgs(["logica", "--tarea", "T1.2", "--carril", "../x"])).toThrow(/carril/);
  });

  it("base por defecto HEAD y modo listar modelos", () => {
    expect(parseArgs(["--modelos"])).toMatchObject({ rol: undefined, base: "HEAD", modelos: true });
  });

  it("rechaza un rol desconocido", () => {
    expect(() => parseArgs(["estilo", "--tarea", "T2.5"])).toThrow(/rol/);
  });

  it("exige --tarea salvo en modo --modelos", () => {
    expect(() => parseArgs(["seguridad"])).toThrow(/--tarea/);
  });
});

describe("forbiddenPaths", () => {
  it("detecta datos reales y secretos que nunca salen a la API", () => {
    expect(
      forbiddenPaths(["js/main.js", "local_privado/insp.csv", ".env.local", "sub/.env", "specs/T2.5.md"])
    ).toEqual(["local_privado/insp.csv", ".env.local", "sub/.env"]);
  });
});

describe("loadConfig", () => {
  it("por defecto usa agy con el modelo de D13, sin clave", () => {
    expect(loadConfig({}, "")).toEqual({ motor: "agy", agy: "agy", model: "gemini-4-argon-medium", apiKey: "" });
  });

  it("AGY_MODEL y AGY_BIN cambian el modelo y el ejecutable; GEMINI_MODEL no aplica a agy", () => {
    expect(loadConfig({ AGY_BIN: "/x/agy" }, "AGY_MODEL=gemini-3.8-flash-medium\nGEMINI_MODEL=gemini-3.5-flash\n")).toMatchObject({ agy: "/x/agy", model: "gemini-3.8-flash-medium" });
  });

  it("GEMINI_MOTOR=api usa clave y modelo de la API; el entorno manda sobre .env.local", () => {
    const env = { GEMINI_MOTOR: "api", GEMINI_API_KEY: "k-env", GEMINI_MODEL: "m-env" };
    expect(loadConfig(env, "GEMINI_API_KEY=k-file\nGEMINI_MODEL=m-file")).toMatchObject({ motor: "api", apiKey: "k-env", model: "m-env" });
  });

  it("cae a .env.local, ignorando comentarios y comillas", () => {
    expect(loadConfig({}, '# clave\nGEMINI_MOTOR=api\nGEMINI_API_KEY="k-file"\nGEMINI_MODEL=m-file\n')).toMatchObject({ motor: "api", apiKey: "k-file", model: "m-file" });
  });

  it("rechaza un motor desconocido", () => {
    expect(() => loadConfig({ GEMINI_MOTOR: "otro" }, "")).toThrow(/GEMINI_MOTOR/);
  });
});

describe("buildPrompt", () => {
  it("incluye tarea, spec y diff, y avisa si falta la spec", () => {
    const p = buildPrompt({ tarea: "T2.5", spec: "", diff: "+ cambio" });
    expect(p).toContain("T2.5");
    expect(p).toContain("+ cambio");
    expect(p).toMatch(/no hay spec/i);
  });
});

describe("buildSystem", () => {
  const partes = { contexto: "CTX", rol: "ROL", formato: "FMT" };

  it("envía la constitución del carril entre el contexto y el rol", () => {
    const s = buildSystem({ ...partes, carril: "software", constitucion: "C1 nunca datos reales" });
    expect(s).toContain("C1 nunca datos reales");
    expect(s).toContain("constitucion-software.md");
    expect(s.indexOf("CTX")).toBeLessThan(s.indexOf("C1 nunca"));
    expect(s.indexOf("C1 nunca")).toBeLessThan(s.indexOf("ROL"));
    expect(s.indexOf("ROL")).toBeLessThan(s.indexOf("FMT"));
  });

  it("sin constitución (proyecto 1.0) queda contexto + rol + formato", () => {
    expect(buildSystem({ ...partes, carril: "software", constitucion: "" })).toBe("CTX\n\nROL\n\nFMT");
  });
});

const RETRY_34S = { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "34s" };
const cuota = (quotaId) => ({ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId }] });
const fallo = (status, error = {}) => ({ ok: false, status, body: { error } });
const exito = { ok: true, status: 200, body: { candidates: [] } };

describe("clasificarError", () => {
  it("503 es transitorio", () => {
    expect(clasificarError(503, { message: "high demand" }).reintentar).toBe(true);
  });

  it("429 por minuto es transitorio y trae la espera del servidor", () => {
    const error = { message: "Quota exceeded, limit: 20", details: [cuota("GenerateRequestsPerMinutePerProjectPerModel-FreeTier"), RETRY_34S] };
    expect(clasificarError(429, error)).toMatchObject({ reintentar: true, esperaMs: 34_000 });
  });

  it("429 con limit: 0 es permanente y dice qué hacer", () => {
    const c = clasificarError(429, { message: "Quota exceeded for metric: x, limit: 0, model: y", details: [RETRY_34S] });
    expect(c.reintentar).toBe(false);
    expect(c.ayuda).toMatch(/facturación/);
  });

  it("429 de cuota diaria no se reintenta", () => {
    const c = clasificarError(429, { message: "Quota exceeded, limit: 20", details: [cuota("GenerateRequestsPerDayPerProjectPerModel-FreeTier"), RETRY_34S] });
    expect(c.reintentar).toBe(false);
    expect(c.ayuda).toMatch(/diaria/);
  });

  it("429 que pide esperar más que el tope no se reintenta", () => {
    const error = { message: "Quota exceeded", details: [{ ...RETRY_34S, retryDelay: "3600s" }] };
    expect(clasificarError(429, error).reintentar).toBe(false);
  });

  it("404 es permanente y apunta a --modelos", () => {
    const c = clasificarError(404, { message: "not found" });
    expect(c.reintentar).toBe(false);
    expect(c.ayuda).toMatch(/--modelos/);
  });

  it("ignora un retryDelay ilegible", () => {
    expect(clasificarError(503, { details: [{ retryDelay: "pronto" }] }).esperaMs).toBeNull();
  });

  it("otros errores no se reintentan", () => {
    expect(clasificarError(400, { message: "bad request" }).reintentar).toBe(false);
  });
});

describe("pedirConReintentos", () => {
  /** Responde en orden y anota cuántas veces se llamó y cuánto durmió. */
  function escenario(respuestas, azar = () => 0) {
    const r = { llamadas: 0, esperas: [], avisos: [] };
    r.opciones = { dormir: async (ms) => r.esperas.push(ms), azar, avisar: (m) => r.avisos.push(m) };
    r.hacer = async () => respuestas[Math.min(r.llamadas++, respuestas.length - 1)];
    return r;
  }

  it("devuelve el cuerpo sin esperar si la primera llamada sale bien", async () => {
    const e = escenario([exito]);
    await expect(pedirConReintentos(e.hacer, e.opciones)).resolves.toBe(exito.body);
    expect(e.llamadas).toBe(1);
    expect(e.esperas).toEqual([]);
  });

  it("se recupera de un 503 y avisa del reintento", async () => {
    const e = escenario([fallo(503), fallo(503), exito]);
    await expect(pedirConReintentos(e.hacer, e.opciones)).resolves.toBe(exito.body);
    expect(e.llamadas).toBe(3);
    expect(e.avisos).toHaveLength(2);
  });

  it("el backoff crece y el jitter lo varía dentro de un rango", async () => {
    const sinAzar = escenario([fallo(503)], () => 0);
    const conAzar = escenario([fallo(503)], () => 1);
    await pedirConReintentos(sinAzar.hacer, sinAzar.opciones).catch(() => {});
    await pedirConReintentos(conAzar.hacer, conAzar.opciones).catch(() => {});
    expect(sinAzar.esperas).toEqual([1000, 2000, 4000]);
    expect(conAzar.esperas).toEqual([2000, 4000, 8000]);
  });

  it("respeta la espera que pide el servidor", async () => {
    const e = escenario([fallo(429, { message: "Quota exceeded", details: [RETRY_34S] }), exito]);
    await pedirConReintentos(e.hacer, e.opciones);
    expect(e.esperas).toEqual([34_000]);
  });

  it("se rinde tras 3 reintentos con el error de la API", async () => {
    const e = escenario([fallo(503, { message: "high demand" })]);
    await expect(pedirConReintentos(e.hacer, e.opciones)).rejects.toThrow(/503: high demand.*3 reintentos/s);
    expect(e.llamadas).toBe(4);
  });

  it("falla a la primera con un error permanente, con la ayuda en el mensaje", async () => {
    const e = escenario([fallo(429, { message: "Quota exceeded, limit: 0" })]);
    await expect(pedirConReintentos(e.hacer, e.opciones)).rejects.toThrow(/429.*facturación/s);
    expect(e.llamadas).toBe(1);
    expect(e.esperas).toEqual([]);
  });
});

const INFORME = "## Veredicto: SIN BLOQUEANTES\n\n## Hallazgos\n";
const resultado = (r) => `{"event":"init"}\n${JSON.stringify({ event: "result", result: r })}\n`;

describe("argsAgy: revisor sin herramientas de escritura (learn.md L8)", () => {
  const args = argsAgy("gemini-4-argon-medium");

  it("siempre en modo plan, con el modelo fijado y sin saltarse permisos", () => {
    expect(args[args.indexOf("--mode") + 1]).toBe("plan");
    expect(args[args.indexOf("--model") + 1]).toBe("gemini-4-argon-medium");
    expect(args).not.toContain("--dangerously-skip-permissions");
  });

  it("el prompt va por stdin en stream-json (un argumento tope en 128 KB)", () => {
    expect(args[0]).toBe("--print=");
    expect(args[args.indexOf("--input-format") + 1]).toBe("stream-json");
    expect(args[args.indexOf("--output-format") + 1]).toBe("stream-json");
  });
});

describe("mensajeAgy", () => {
  it("una línea NDJSON con system y prompt en el contenido", () => {
    const linea = mensajeAgy("SISTEMA", "PROMPT\ncon saltos");
    expect(linea.trim().split("\n")).toHaveLength(1);
    const m = JSON.parse(linea);
    expect(m.event).toBe("user");
    expect(m.message.role).toBe("user");
    expect(m.message.content).toMatch(/SISTEMA[\s\S]*PROMPT\ncon saltos/);
  });
});

describe("cumpleFormato", () => {
  it("exige la cabecera de veredicto de _formato.md", () => {
    expect(cumpleFormato("x\n## Veredicto: CON BLOQUEANTES\n")).toBe(true);
    expect(cumpleFormato(INFORME)).toBe(true);
    expect(cumpleFormato("Para hacer un scraper en Python usa requests")).toBe(false);
    expect(cumpleFormato("## Veredicto: **CON BLOQUEANTES**")).toBe(false);
  });
});

describe("interpretarAgy", () => {
  const leer = (salida, codigo = 0, error = "") => interpretarAgy({ codigo, salida, error });

  it("informe válido → ok con el texto", () => {
    expect(leer(resultado({ status: "SUCCESS", response: INFORME }))).toEqual({ ok: true, status: 200, body: { texto: INFORME } });
  });

  it("SUCCESS vacío no es éxito: se reintenta y conserva stderr", () => {
    const r = leer(resultado({ status: "SUCCESS", response: "" }), 0, "no output produced");
    expect(r.ok).toBe(false);
    expect(r.body.error.reintentar).toBe(true);
    expect(r.body.error.message).toMatch(/no output produced/);
  });

  it("respuesta fuera de formato se reintenta", () => {
    const r = leer(resultado({ status: "SUCCESS", response: "un scraper en Python" }));
    expect(r.ok).toBe(false);
    expect(r.body.error.reintentar).toBe(true);
    expect(r.body.error.message).toMatch(/_formato\.md/);
  });

  it("saturación se reintenta; modelo inválido y cuota fallan a la primera", () => {
    expect(leer(resultado({ status: "ERROR", error: "503 model overloaded" }), 1).body.error.reintentar).toBe(true);
    expect(leer(resultado({ status: "ERROR", error: "model nope is not recognized" }), 1).body.error.reintentar).toBe(false);
    const cuota = leer(resultado({ status: "ERROR", error: "RESOURCE_EXHAUSTED: quota exceeded" }), 1);
    expect(cuota.body.error.reintentar).toBe(false);
    expect(cuota.body.error.message).toMatch(/[Cc]uota/);
  });

  it("sin evento result usa stderr y no revienta con líneas que no son JSON", () => {
    const r = leer("basura\n", 2, "sesión expirada");
    expect(r.ok).toBe(false);
    expect(r.body.error.message).toMatch(/sesión expirada/);
  });
});

describe("pedirConReintentos con errores sin código HTTP (agy)", () => {
  const sinCodigo = (reintentar) => ({ ok: false, status: 0, body: { error: { message: "agy: fallo X", reintentar } } });
  const opciones = { dormir: async () => {}, azar: () => 0, avisar: () => {} };

  it("reintenta los transitorios y no los presenta como respuesta HTTP", async () => {
    let n = 0;
    await expect(pedirConReintentos(async () => (n++, sinCodigo(true)), opciones)).rejects.toThrow(/^agy: fallo X\nSigue fallando/);
    expect(n).toBe(4);
  });

  it("falla a la primera con los permanentes", async () => {
    let n = 0;
    await expect(pedirConReintentos(async () => (n++, sinCodigo(false)), opciones)).rejects.toThrow(/^agy: fallo X/);
    expect(n).toBe(1);
  });
});
