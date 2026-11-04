#!/usr/bin/env node
// Spike T1.9: comprueba que los escenarios y la suite detectan bugs sembrados en una copia.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { correr } from "./correr.mjs";

const MUTANTES = [
  { id: "M0", titulo: "Control: copia sin cambios", archivo: "src/cupon.js", de: "const MS_POR_DIA", a: "const MS_POR_DIA" },
  { id: "M1", titulo: "IVA antes del descuento", archivo: "src/precio.js", de: "const monto = aplicarCupon(subtotal(lineas), cupon, hoy);\n  return Math.round(monto * (1 + tasa) * 100) / 100;", a: "return aplicarCupon(subtotal(lineas) * (1 + tasa), cupon, hoy);" },
  { id: "M2", titulo: "Sin tope en 0", archivo: "src/cupon.js", de: "Math.max(monto, 0)", a: "monto" },
  { id: "M3", titulo: "El cupón no sirve el día que vence", archivo: "src/cupon.js", de: "diaUtc(hoy) > diaUtc(cupon.vence)", a: "diaUtc(hoy) >= diaUtc(cupon.vence)" },
  { id: "M4", titulo: "Compara por hora, no por día", archivo: "src/cupon.js", de: "diaUtc(hoy) > diaUtc(cupon.vence)", a: "hoy.getTime() > cupon.vence.getTime()" },
  { id: "M5", titulo: "aplicarCupon no redondea", archivo: "src/cupon.js", de: "return Math.round(Math.max(monto, 0) * 100) / 100;", a: "return Math.max(monto, 0);" },
  { id: "M6", titulo: "Días en hora local, no en UTC", archivo: "src/cupon.js", de: "Math.floor(fecha.getTime() / MS_POR_DIA)", a: "Math.floor((fecha.getTime() - fecha.getTimezoneOffset() * 60000) / MS_POR_DIA)" },
];

const [proyecto, rutaEscenarios, rutaSalida, base] = process.argv.slice(2);
const origen = resolve(proyecto);
const escenarios = JSON.parse(readFileSync(rutaEscenarios, "utf8"));
const zonas = ["UTC", "America/Lima", "Asia/Tokyo"];

const resultados = MUTANTES.map((m) => {
  const dir = mkdtempSync(join(base, `${m.id}-`));
  try {
    for (const x of ["src", "tests", "specs", "package.json"]) cpSync(join(origen, x), join(dir, x), { recursive: true });
    symlinkSync(join(origen, "node_modules"), join(dir, "node_modules"));
    const ruta = join(dir, m.archivo);
    const texto = readFileSync(ruta, "utf8");
    if (!texto.includes(m.de)) throw new Error(`${m.id}: no encontré el texto a mutar`);
    writeFileSync(ruta, texto.replace(m.de, m.a));
    const r = correr({ proyecto: dir, escenarios, zonas, soloLlamadas: true });
    const suite = (tz) => spawnSync("npx", ["vitest", "run"], { cwd: dir, encoding: "utf8", timeout: 120_000, env: { ...process.env, TZ: tz } }).status !== 0;
    return {
      id: m.id, titulo: m.titulo,
      escenariosQueLoDetectan: r.resultados.filter((x) => x.fallos.length).map((x) => x.id),
      suiteLima: suite("America/Lima"), suiteUtc: suite("UTC"),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
writeFileSync(rutaSalida, `${JSON.stringify(resultados, null, 2)}\n`);
resultados.forEach((r) => console.log(r.id, r.titulo, "| escenarios:", r.escenariosQueLoDetectan.length, "| suite Lima:", r.suiteLima, "| suite UTC:", r.suiteUtc));
