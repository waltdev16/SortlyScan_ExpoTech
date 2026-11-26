// Pruebas de navegador de SortlyScan Interactive Demo (Chrome real con Playwright).
//
// Uso:  1) npm run dev   (o npm run build && npm start)   2) npm run test:setup   3) npm run test:demo
// Variables: BASE_URL (por defecto http://localhost:3000), CHROME_PATH, OUT (archivo de resultados).
//
// Cada paso se registra como «aprobado» o «falló» con el detalle. Nada se marca como aprobado sin
// haberse ejecutado. Se usa un contexto de navegador nuevo: la demostración empieza con sus datos iniciales.
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "fflate";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = process.env.OUT ?? join(here, "..", "..", "docs", "resultados", "pruebas-demo.json");
const SHOTS = join(here, "capturas");
mkdirSync(SHOTS, { recursive: true });
const content = JSON.parse(readFileSync(join(here, "..", "..", "frontend", "src", "data", "demo-content.json"), "utf8"));
const LEGEND = "Datos de demostración — SortlyScan Interactive Demo.";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  // Cámara simulada de Chrome: permite probar el flujo de cámara sin hardware.
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, permissions: ["camera"] });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on("dialog", (d) => d.accept());

const results = [];
let metalBefore = null;
async function step(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ prueba: name, resultado: "aprobado", detalle: detail ?? null, ms: Date.now() - started });
    console.log(`✔ ${name}${detail ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  } catch (e) {
    const shot = join(SHOTS, `fallo-${results.length + 1}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined);
    results.push({ prueba: name, resultado: "falló", detalle: String(e?.message ?? e).slice(0, 600), captura: shot, ms: Date.now() - started });
    console.log(`✘ ${name} — ${String(e?.message ?? e).slice(0, 300)}`);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const db = (p = page) => p.evaluate(() => JSON.parse(localStorage.getItem("sortlyscan-demo-db") ?? "null"));
const pointsOf = (data, inst, user) => data.institutions[inst].ledger.filter((t) => t.user === user).reduce((n, t) => n + t.delta, 0);
const PILOT = "centro-escolar-piloto";
const settle = (p = page) => p.waitForTimeout(700);

/** Cambia de perfil con el selector discreto del panel. */
async function switchProfile(roleLabel, person, p = page) {
  await p.getByRole("button", { name: "Cambiar perfil" }).first().click();
  const panel = p.getByRole("dialog", { name: "Cambiar perfil" });
  await panel.getByLabel(roleLabel, { exact: true }).check();
  if (person) {
    const select = panel.getByLabel("Persona ficticia");
    const value = await select.evaluate((el, name) => [...el.options].find((o) => o.textContent.startsWith(name))?.value, person);
    expect(value, `No aparece ${person} en el selector`);
    await select.selectOption(value);
  }
  await panel.getByRole("button", { name: /^Entrar como/ }).click();
  await p.waitForURL(/\/panel\//);
  await settle(p);
}

async function download(locator) {
  const [file] = await Promise.all([page.waitForEvent("download"), locator.click()]);
  const path = await file.path();
  return { name: file.suggestedFilename(), bytes: readFileSync(path) };
}

// ------------------------------------------------------------------ Inicio y selector
await step("Landing: «Explorar plataforma» y «Probar demostración» reemplazan el acceso", async () => {
  await page.goto(`${BASE}/`);
  await page.getByRole("link", { name: "Explorar plataforma" }).first().waitFor();
  await page.getByRole("link", { name: /Probar demostración/ }).first().waitFor();
  const text = await page.locator("header").first().innerText();
  expect(!/Iniciar sesión|Registrarse/.test(text), "Aún aparece «Iniciar sesión» o «Registrarse» en la cabecera");
});

await step("Selector de perfiles con los textos aprobados y puntos reales del historial", async () => {
  await page.goto(`${BASE}/acceso`);
  await page.getByRole("heading", { name: "Tu espacio para aprender." }).waitFor();
  await page.locator(".profile-card").first().waitFor();
  const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  for (const t of [
    "Explora cómo SortlyScan transforma la educación ambiental desde diferentes perspectivas.",
    "Aprende a reciclar, escanea residuos, completa actividades y gana puntos.",
    "Gestiona grupos, asigna actividades y supervisa el aprendizaje.",
    "Administra la institución y consulta sus resultados educativos y ambientales.",
    "Explora la gestión general de instituciones y contenidos educativos.",
  ]) expect(body.includes(t), `Falta el texto: ${t}`);
  const options = await page.locator("#perfil-student select option").allInnerTexts();
  expect(options.length === 30, `Se esperaban 30 estudiantes, hay ${options.length}`);
  const diego = options.find((o) => o.startsWith("Diego M."));
  expect(diego && !/ 0 pts/.test(diego), `Diego no muestra puntos: ${diego}`);
  const data = await db();
  const inst = data.institutions[PILOT];
  expect(inst.staff.filter((s) => s.role === "teacher").length === 3 && inst.staff.filter((s) => s.role === "director").length === 1, "Personal inicial incorrecto");
  expect(inst.groups.length === 3, "Se esperaban 3 grupos");
  return `30 estudiantes, 3 grupos, 3 docentes, 1 dirección; ${diego}`;
});

await step("Solicitud institucional ficticia guardada localmente", async () => {
  await page.goto(`${BASE}/solicitud`);
  await page.fill("#inst-institution_name", "Escuela de Prueba Automatizada (ficticia)");
  await page.selectOption("#inst-department", "La Paz");
  await page.fill("#inst-district", "Zacatecoluca");
  await page.fill("#inst-representative_name", "Persona Ficticia");
  await page.fill("#inst-representative_position", "Directora");
  await page.check("#inst-accepts_privacy");
  await page.getByRole("button", { name: /Guardar solicitud ficticia/ }).click();
  await page.getByText("Solicitud ficticia guardada.").waitFor();
  await page.getByText("No se envió a SortlyScan").waitFor();
  const data = await db();
  expect(data.applications.some((a) => a.institution_name.startsWith("Escuela de Prueba Automatizada") && a.status === "pending"), "La solicitud no quedó guardada");
});

// ------------------------------------------------------------------ Docente
await step("Docente: entrar desde el selector (Carlos Mejía, 7.º A)", async () => {
  await page.goto(`${BASE}/acceso`);
  await page.locator("#perfil-teacher select").selectOption("t-1");
  await page.locator("#perfil-teacher .profile-enter").click();
  await page.waitForURL(/\/panel\/docente\/?$/);
  await page.getByText("Carlos Mejía").first().waitFor();
});

const ACTIVITY_TITLE = "Latas limpias (prueba automatizada)";
await step("Docente: asignar una lección al grupo", async () => {
  await page.goto(`${BASE}/panel/docente/actividades`);
  await page.getByRole("button", { name: "Nueva actividad" }).first().click();
  const panel = page.getByRole("dialog", { name: "Nueva actividad" });
  await panel.getByLabel("Lección").selectOption("metal-basico");
  await panel.getByLabel("Título").fill(ACTIVITY_TITLE);
  await panel.getByRole("button", { name: "Asignar actividad" }).click();
  const card = page.locator("article").filter({ hasText: ACTIVITY_TITLE }).first();
  const text = await card.getByText(/\d+ de \d+ completaron/).first().innerText();
  metalBefore = Number(text.split(" ")[0]);
  return text;
});

const CHALLENGE_TITLE = "Reto de prueba: dos cuestionarios";
await step("Docente: crear un reto de grupo", async () => {
  await page.goto(`${BASE}/panel/docente/retos`);
  await page.getByRole("button", { name: "Nuevo reto" }).first().click();
  const panel = page.getByRole("dialog", { name: /Nuevo reto/ });
  await panel.getByLabel("Título").fill(CHALLENGE_TITLE);
  await panel.getByLabel("Tipo de reto").selectOption("quiz");
  await panel.getByLabel("Meta (cantidad)").fill("2");
  await panel.getByRole("button", { name: "Crear reto" }).click();
  await page.getByRole("heading", { name: CHALLENGE_TITLE }).waitFor();
});

await step("Docente: aprobar una actividad ambiental (otorga puntos una sola vez)", async () => {
  const before = pointsOf(await db(), PILOT, "s-0-2");
  await page.goto(`${BASE}/panel/docente/verificacion`);
  await page.getByRole("row", { name: /Valeria S\./ }).getByRole("button", { name: "Revisar actividad" }).click();
  await page.getByRole("dialog", { name: "Revisar actividad" }).getByRole("button", { name: "Aprobar" }).click();
  await page.getByText(/Aprobada\. \+\d+ puntos/).waitFor();
  await settle();
  const data = await db();
  const after = pointsOf(data, PILOT, "s-0-2");
  const grant = data.institutions[PILOT].ledger.filter((t) => t.user === "s-0-2" && t.source === "action:ea-3");
  expect(grant.length === 1 && grant[0].delta === 50, `Otorgamiento: ${JSON.stringify(grant)}`);
  return `Valeria S.: ${before} → ${after} puntos (50 por la actividad verificada; el resto, retos/logros cumplidos)`;
});

// ------------------------------------------------------------------ Estudiante
let camilaBefore = 0;
let camilaSources = new Set();
await step("Cambio de perfil dentro del panel: docente → estudiante (Camila R.)", async () => {
  const d0 = await db();
  camilaBefore = pointsOf(d0, PILOT, "s-0-0");
  camilaSources = new Set(d0.institutions[PILOT].ledger.filter((t) => t.user === "s-0-0").map((t) => t.source));
  await switchProfile("Estudiante", "Camila R.");
  await page.waitForURL(/\/panel\/estudiante\/?$/);
  await page.getByRole("heading", { name: /Hola, Camila/ }).waitFor();
});

await step("Sincronización: la estudiante recibe la notificación de la actividad asignada", async () => {
  const bell = page.locator(".nt-bell");
  await bell.waitFor();
  const label = await bell.getAttribute("aria-label");
  expect(/sin leer/.test(label ?? ""), `La campana no muestra notificaciones sin leer: ${label}`);
  await bell.click();
  await page.getByText(`Nueva actividad: ${ACTIVITY_TITLE}`).first().waitFor();
  await page.keyboard.press("Escape");
});

await step("Estudiante: completar la actividad pendiente de «papel» completa la lección (+15)", async () => {
  await page.goto(`${BASE}/panel/estudiante/aprender/papel-basico`);
  await page.getByRole("button", { name: /^Actividad 3/ }).click();
  await page.getByLabel("Verdadero").check();
  await page.getByRole("button", { name: "Comprobar" }).click();
  await page.getByText("Completaste la lección.").waitFor();
  await settle();
  const data = await db();
  const after = pointsOf(data, PILOT, "s-0-0");
  const lessonGrant = data.institutions[PILOT].ledger.filter((t) => t.user === "s-0-0" && t.source === "lesson:papel-basico");
  expect(lessonGrant.length === 1 && lessonGrant[0].delta === 15, `Otorgamiento de lección: ${JSON.stringify(lessonGrant)}`);
  const extra = data.institutions[PILOT].ledger.filter((t) => t.user === "s-0-0" && !camilaSources.has(t.source) && t.source !== "lesson:papel-basico").map((t) => `${t.reason} (+${t.delta})`);
  return `${camilaBefore} → ${after} puntos · +15 lección${extra.length ? ` · ${extra.join(", ")}` : ""}`;
});

async function solveLesson(slug) {
  const lesson = content.lessons.find((l) => l.slug === slug);
  await page.goto(`${BASE}/panel/estudiante/aprender/${slug}`);
  for (const [i, a] of lesson.activities.entries()) {
    await page.getByRole("button", { name: new RegExp(`^Actividad ${i + 1}`) }).click();
    const stage = page.locator(".lesson-stage");
    if (a.kind === "truefalse") await stage.getByLabel(a.answer ? "Verdadero" : "Falso").check();
    else if (a.kind === "choice") await stage.getByLabel(a.options[a.answer], { exact: true }).check();
    else if (a.kind === "image") await stage.locator(".image-option input").nth(a.answer).check();
    else if (a.kind === "sort") {
      for (const [k, item] of a.items.entries()) await stage.getByRole("radiogroup", { name: `¿Dónde va «${item}»?` }).getByLabel(a.bins[a.answer[k]], { exact: true }).check();
    } else if (a.kind === "match") {
      for (const [k] of a.left.entries()) await stage.locator(".match-list select").nth(k).selectOption(String(a.answer[k]));
    }
    await stage.getByRole("button", { name: "Comprobar" }).click();
    await stage.getByText("¡Correcto!").waitFor();
  }
  return lesson;
}
async function answerQuiz(lesson, correct = true) {
  await page.getByRole("button", { name: /^Cuestionario final/ }).click();
  const stage = page.locator(".lesson-stage");
  for (const [i, q] of lesson.quiz.questions.entries()) {
    const pick = correct ? q.correct : (q.correct + 1) % q.options.length;
    await stage.getByText(q.prompt).waitFor();
    await stage.getByLabel(q.options[pick], { exact: true }).check();
    if (i < lesson.quiz.questions.length - 1) await stage.getByRole("button", { name: "Siguiente" }).click();
  }
  await stage.getByRole("button", { name: "Enviar respuestas" }).click();
}

await step("Estudiante: actividades y cuestionario de «metal» → lección completada y cuestionario aprobado (+15 +25)", async () => {
  const before = pointsOf(await db(), PILOT, "s-0-0");
  const lesson = await solveLesson("metal-basico");
  await answerQuiz(lesson, true);
  await page.getByText(/Aprobaste|aprobado/i).first().waitFor();
  await settle();
  const data = await db();
  const after = pointsOf(data, PILOT, "s-0-0");
  const ledger = data.institutions[PILOT].ledger.filter((t) => t.user === "s-0-0");
  const quiz = ledger.filter((t) => t.source === "quiz:metal-basico");
  const done = ledger.filter((t) => t.source === "lesson:metal-basico");
  expect(quiz.length === 1 && quiz[0].delta === 25 && done.length === 1 && done[0].delta === 15, `Otorgamientos: ${JSON.stringify([...quiz, ...done])}`);
  return `${before} → ${after} puntos (+25 cuestionario, +15 lección${after - before > 40 ? ", más retos cumplidos" : ""})`;
});

await step("Reglas: repetir y aprobar otra vez el mismo cuestionario no vuelve a sumar puntos", async () => {
  const before = pointsOf(await db(), PILOT, "s-0-0");
  await page.reload();
  await answerQuiz(content.lessons.find((l) => l.slug === "metal-basico"), true);
  await page.waitForTimeout(1500);
  const data = await db();
  const after = pointsOf(data, PILOT, "s-0-0");
  const grants = data.institutions[PILOT].ledger.filter((t) => t.user === "s-0-0" && t.source === "quiz:metal-basico").length;
  expect(after === before && grants === 1, `Puntos ${before} → ${after}, otorgamientos ${grants}`);
  return `sin puntos extra (${after})`;
});

await step("Persistencia: los puntos siguen después de recargar", async () => {
  const before = pointsOf(await db(), PILOT, "s-0-0");
  await page.goto(`${BASE}/panel/estudiante/progreso`);
  await page.reload();
  await settle();
  const after = pointsOf(await db(), PILOT, "s-0-0");
  expect(before === after && after > camilaBefore, `Antes ${before}, después ${after}`);
  await page.getByText(new RegExp(String(after))).first().waitFor();
  return `${after} puntos tras recargar`;
});

await step("Niveles, logros y ranking visibles para el estudiante", async () => {
  await page.goto(`${BASE}/panel/estudiante/progreso`);
  await page.getByText(/Semilla|Brote|Explorador|Guardián|Embajador/).first().waitFor();
  await page.goto(`${BASE}/panel/estudiante/ranking`);
  await page.getByText("Camila R.").first().waitFor();
  await page.goto(`${BASE}/panel/estudiante/retos`);
  await page.getByText(CHALLENGE_TITLE).first().waitFor();
});

await step("Sincronización: el docente ve el avance de la estudiante en la actividad asignada", async () => {
  await switchProfile("Docente", "Carlos Mejía");
  await page.goto(`${BASE}/panel/docente/actividades`);
  const card = page.locator("article").filter({ hasText: ACTIVITY_TITLE }).first();
  await card.getByText(new RegExp(`^${metalBefore + 1} de \\d+ completaron`)).first().waitFor();
  return `${metalBefore} → ${metalBefore + 1} completaron`;
});

// ------------------------------------------------------------------ Escaneo con IA real
await step("Vision real: subir una foto identifica «plástico» con el modelo en el navegador y registra el escaneo", async () => {
  await switchProfile("Estudiante", "Diego M.");
  await page.goto(`${BASE}/panel/estudiante/escanear`);
  await page.getByText(/Modelo sortlyscan-vision-v1/).waitFor();
  await page.locator('input[type="file"]').setInputFiles(join(here, "fixtures", "plastic_plastic101.jpg"));
  await page.locator(".ui-scan-result").getByText(/Plástico/).first().waitFor({ timeout: 60000 });
  const meta = await page.locator(".ui-scan-meta").innerText();
  expect(/analizado en este navegador/.test(meta), `Meta inesperada: ${meta}`);
  const data = await db();
  const scan = data.institutions[PILOT].scans.find((s) => s.user === "s-0-1");
  expect(scan && scan.category === "plastic" && scan.confidence > 0.5, `Escaneo no registrado: ${JSON.stringify(scan)}`);
  return `plastic, confianza ${scan.confidence.toFixed(4)} · ${meta}`;
});

await step("Vision: la pregunta posterior al escaneo se califica una sola vez y suma puntos", async () => {
  const before = pointsOf(await db(), PILOT, "s-0-1");
  const q = page.locator(".ui-quick-q");
  const prompt = await q.locator(".ui-quick-q-prompt").innerText();
  const item = content.scanQuestions.plastic.find((x) => x.prompt === prompt);
  expect(item, `Pregunta desconocida: ${prompt}`);
  await q.getByRole("button", { name: item.options[item.correct], exact: true }).click();
  await q.getByText("¡Correcto!").waitFor();
  await settle();
  const after = pointsOf(await db(), PILOT, "s-0-1");
  expect(after - before === 10, `Puntos ${before} → ${after}`);
  expect(await q.locator("button").first().isDisabled(), "La pregunta se puede volver a responder");
  return `${before} → ${after}`;
});

await step("Vision: cámara (dispositivo simulado de Chrome) → captura → decisión del modelo", async () => {
  await page.goto(`${BASE}/panel/estudiante/escanear`);
  await page.getByText(/Modelo sortlyscan-vision-v1/).waitFor();
  await page.getByRole("button", { name: /Activar cámara/ }).click();
  await page.getByRole("button", { name: /Capturar y analizar/ }).click();
  const panel = page.locator(".ui-scan-result");
  await panel.locator(".ui-scan-meta, .ui-scan-uncertain, [data-status]").first().waitFor({ timeout: 60000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const text = await panel.innerText();
  expect(!/No se pudo cargar el modelo/.test(text), "El modelo no cargó");
  expect(text.trim().length > 20, "Sin resultado");
  return text.split("\n").slice(0, 3).join(" · ");
});

// ------------------------------------------------------------------ Dirección
await step("Dirección: registrar docente, crear grupo y asignarlo (sin invitaciones ni contraseñas)", async () => {
  await switchProfile("Dirección", "Marta Elena Cruz");
  await page.goto(`${BASE}/panel/director/docentes`);
  await page.getByRole("button", { name: "Registrar docente" }).first().click();
  const panel = page.getByRole("dialog", { name: "Registrar docente" });
  await panel.getByLabel("Nombre del docente").fill("Profa. Prueba Automatizada");
  await panel.getByRole("button", { name: "Registrar docente" }).click();
  await panel.getByText("Docente registrado").waitFor();
  await page.keyboard.press("Escape");
  await page.goto(`${BASE}/panel/director/grupos`);
  await page.getByRole("button", { name: "Nuevo grupo" }).click();
  const g = page.getByRole("dialog", { name: "Nuevo grupo" });
  await g.getByLabel("Grado").selectOption("8");
  await g.getByLabel("Sección o nombre").fill("C");
  await g.getByRole("button", { name: "Crear grupo" }).click();
  await page.getByRole("row", { name: /8\.º grado · C/ }).waitFor();
  await page.getByRole("row", { name: /8\.º grado · C/ }).locator("button.dt-open").click();
  const m = page.getByRole("dialog", { name: /Docentes de/ });
  const value = await m.getByLabel("Asignar docente").evaluate((el) => [...el.options].find((o) => o.textContent === "Profa. Prueba Automatizada")?.value);
  await m.getByLabel("Asignar docente").selectOption(value);
  await m.getByText("Profa. Prueba Automatizada").first().waitFor();
  await settle(); // la base se guarda unos milisegundos después de cada acción
  const inst = (await db()).institutions[PILOT];
  const group = inst.groups.find((x) => x.grade_level_id === 8 && x.name === "C");
  expect(group && group.teachers.length === 1, "El docente no quedó asignado");
  expect(!JSON.stringify(inst.staff).includes("@"), "Se guardó un correo para el personal");
});

await step("Dirección: registrar estudiantes por nombre y transferir uno de grupo", async () => {
  await page.goto(`${BASE}/panel/director/estudiantes`);
  await page.getByRole("button", { name: "Agregar estudiantes" }).click();
  const panel = page.getByRole("dialog", { name: "Agregar estudiantes" });
  const groupValue = await panel.getByLabel("Grupo").evaluate((el) => [...el.options].find((o) => o.textContent.includes("8.º grado · C"))?.value);
  await panel.getByLabel("Grupo").selectOption(groupValue);
  await panel.locator("textarea").fill("Estudiante Prueba A.\nEstudiante Prueba B.");
  await panel.getByRole("button", { name: /Agregar|Registrar/ }).last().click();
  await panel.getByText("2 estudiantes registrados").waitFor();
  const text = await panel.innerText();
  expect(!/código|contraseña/i.test(text.replace(/no hay usuarios, contraseñas ni códigos/i, "")), "Se muestran credenciales");
  await page.keyboard.press("Escape");
  await page.goto(`${BASE}/panel/director/grupos`);
  await page.getByRole("button", { name: /Transferir estudiantes/ }).click();
  const t = page.getByRole("dialog", { name: "Transferir estudiantes" });
  await t.getByLabel("Desde").selectOption(groupValue);
  await t.getByLabel("Hacia").selectOption("g-8b");
  await t.getByLabel("Estudiante Prueba B.").uncheck();
  await t.getByRole("button", { name: /Mover|Transferir/ }).last().click();
  await t.getByText("1 estudiantes movidos.").waitFor();
  await settle();
  const inst = (await db()).institutions[PILOT];
  const a = inst.students.find((s) => s.name === "Estudiante Prueba A.");
  expect(a?.group === "g-8b", "La transferencia no se guardó");
});

await step("Estadísticas de la dirección reflejan la actividad nueva (Camila completó 2 lecciones más)", async () => {
  await page.goto(`${BASE}/panel/director`);
  await page.getByText(/Lecciones completadas/).first().waitFor();
  await page.goto(`${BASE}/panel/director/estudiantes`);
  await page.getByRole("searchbox").first().fill("Camila");
  await page.getByRole("row", { name: /Camila R\./ }).getByText("3/6").waitFor();
});

for (const [format, check] of [
  ["CSV", (b) => b.toString("utf8").includes(LEGEND)],
  ["Excel", (b) => { const files = unzipSync(new Uint8Array(b)); return strFromU8(files["xl/worksheets/sheet1.xml"]).includes(LEGEND); }],
  ["PDF", (b) => b.subarray(0, 5).toString() === "%PDF-" && b.toString("latin1").includes("SortlyScan Interactive Demo")],
]) {
  await step(`Reportes: «Resumen institucional» en ${format} con la leyenda de demostración`, async () => {
    await page.goto(`${BASE}/panel/director/reportes`);
    const file = await download(page.getByRole("button", { name: `Descargar Resumen institucional en ${format}` }));
    expect(check(file.bytes), `El archivo ${file.name} no contiene la leyenda`);
    writeFileSync(join(SHOTS, file.name), file.bytes);
    return `${file.name} (${file.bytes.length} bytes)`;
  });
}

// ------------------------------------------------------------------ Superadministración
await step("Superadministración: aprobar una solicitud y entrar como su dirección", async () => {
  await switchProfile("Superadministración");
  await page.waitForURL(/\/panel\/admin\/?$/);
  await page.getByRole("listitem").filter({ hasText: "Complejo Educativo Las Brisas" }).getByRole("button", { name: "Aprobar" }).click();
  await page.getByText(/Institución creada: Complejo Educativo Las Brisas/).waitFor();
  await page.getByRole("button", { name: "Entrar como Rosa Amaya" }).click();
  await page.waitForURL(/\/panel\/director\/?$/);
  await page.getByText("Complejo Educativo Las Brisas (ficticio)").first().waitFor();
});

await step("Institución nueva: su dirección crea un grupo y registra un estudiante que aparece en el selector", async () => {
  await page.goto(`${BASE}/panel/director/grupos`);
  await page.getByRole("button", { name: "Nuevo grupo" }).click();
  const g = page.getByRole("dialog", { name: "Nuevo grupo" });
  await g.getByLabel("Sección o nombre").fill("A");
  await g.getByRole("button", { name: "Crear grupo" }).click();
  await page.getByRole("row", { name: /7\.º grado · A/ }).waitFor();
  await page.goto(`${BASE}/panel/director/estudiantes`);
  await page.getByRole("button", { name: "Agregar estudiantes" }).click();
  const panel = page.getByRole("dialog", { name: "Agregar estudiantes" });
  await panel.locator("textarea").fill("Nuevo Estudiante B.");
  await panel.getByRole("button", { name: /Agregar|Registrar/ }).last().click();
  await panel.getByText("Estudiante registrado").waitFor();
  await page.goto(`${BASE}/acceso`);
  const instValue = await page.getByLabel("Institución ficticia").evaluate((el) => [...el.options].find((o) => o.textContent.startsWith("Complejo Educativo Las Brisas"))?.value);
  await page.getByLabel("Institución ficticia").selectOption(instValue);
  const options = await page.locator("#perfil-student select option").allInnerTexts();
  expect(options.some((o) => o.startsWith("Nuevo Estudiante B.")), "El estudiante nuevo no aparece en el selector");
});

await step("Superadministración: suspender y reactivar una institución", async () => {
  await page.goto(`${BASE}/acceso`);
  await page.locator("#perfil-admin .profile-enter").click();
  await page.waitForURL(/\/panel\/admin\/?$/);
  await page.goto(`${BASE}/panel/admin/instituciones`);
  const row = page.getByRole("row", { name: /Complejo Educativo Las Brisas/ });
  await row.getByRole("button", { name: /^Acciones/ }).click();
  await page.getByRole("menuitem", { name: "Suspender" }).click();
  await row.getByText("Suspendida").waitFor();
  await settle();
  expect(Object.values((await db()).institutions).find((i) => i.institution.name.startsWith("Complejo")).institution.status === "suspended", "No quedó suspendida");
  await row.getByRole("button", { name: /^Acciones/ }).click();
  await page.getByRole("menuitem", { name: "Reactivar" }).click();
  await row.getByText("Activa").waitFor();
});

await step("Superadministración: auditoría local y listado de personas ficticias", async () => {
  await page.goto(`${BASE}/panel/admin/auditoria`);
  await page.getByText(/application\.approve|Aprobó|aprob/i).first().waitFor();
  await page.goto(`${BASE}/panel/admin/personas`);
  await page.getByRole("searchbox").first().fill("Rosa");
  await page.getByRole("row", { name: /Rosa Amaya/ }).waitFor();
});

await step("Superadministración: crear una lección (borrador) desde el editor de contenidos", async () => {
  await page.goto(`${BASE}/panel/admin/contenidos`);
  await page.getByRole("button", { name: "Nueva lección" }).click();
  const panel = page.getByRole("dialog", { name: "Nueva lección" });
  await panel.getByLabel("Identificador").fill("latas-avanzado");
  await panel.getByLabel("Título").fill("Latas: nivel avanzado");
  await panel.getByLabel("Resumen").fill("Lección de prueba creada por la superadministración.");
  await panel.getByLabel("¿Qué es?").fill("Una lección de prueba sobre latas de aluminio.");
  await panel.getByLabel("Cómo identificarlo").fill("Es liviana\nSe puede aplastar");
  await panel.getByLabel("Cómo prepararlo").fill("Enjuágala\nAplástala");
  await panel.getByLabel("Errores frecuentes").fill("Dejar restos de bebida");
  await panel.getByRole("button", { name: "Crear borrador" }).click();
  await page.waitForTimeout(800);
  const lesson = (await db()).content.lessons.find((l) => l.slug === "latas-avanzado");
  expect(lesson && lesson.status === "draft", "La lección no se creó como borrador");
});

await step("Lección publicada durante la demo se abre por URL directa (respaldo 404 en hosting estático)", async () => {
  // Se publica con una pregunta directamente en la base local (equivale a usar el editor de preguntas).
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("sortlyscan-demo-db"));
    const l = d.content.lessons.find((x) => x.slug === "latas-avanzado");
    l.quiz.questions.push({ prompt: "¿Qué haces con una lata?", options: ["La enjuago", "La quemo"], correct: 0, explanation: "Limpia se recicla mejor." });
    l.status = "published";
    localStorage.setItem("sortlyscan-demo-db", JSON.stringify(d));
    const a = JSON.stringify({ role: "student", personId: "s-0-0", institutionId: "centro-escolar-piloto" });
    sessionStorage.setItem("sortlyscan-demo-actor", a);
  });
  await page.goto(`${BASE}/panel/estudiante/aprender/latas-avanzado/`);
  await page.getByRole("heading", { name: "Latas: nivel avanzado" }).waitFor();
});

// ------------------------------------------------------------------ Sincronización entre pestañas
await step("Dos pestañas: un reto creado por el docente aparece en la pestaña del estudiante sin recargar", async () => {
  await page.goto(`${BASE}/acceso`);
  await page.locator("#perfil-student select").selectOption("s-0-0");
  await page.locator("#perfil-student .profile-enter").click();
  await page.waitForURL(/\/panel\/estudiante\/?$/);
  await page.goto(`${BASE}/panel/estudiante/retos`);
  const teacher = await context.newPage();
  await teacher.goto(`${BASE}/acceso`);
  await teacher.locator("#perfil-teacher select").selectOption("t-1");
  await teacher.locator("#perfil-teacher .profile-enter").click();
  await teacher.waitForURL(/\/panel\/docente\/?$/);
  await teacher.goto(`${BASE}/panel/docente/retos`);
  await teacher.getByRole("button", { name: "Nuevo reto" }).first().click();
  const panel = teacher.getByRole("dialog", { name: /Nuevo reto/ });
  await panel.getByLabel("Título").fill("Reto creado en otra pestaña");
  await panel.getByLabel("Tipo de reto").selectOption("identification");
  await panel.getByLabel("Meta (cantidad)").fill("5");
  await panel.getByRole("button", { name: "Crear reto" }).click();
  await teacher.getByRole("heading", { name: "Reto creado en otra pestaña" }).waitFor();
  await page.getByText("Reto creado en otra pestaña").first().waitFor({ timeout: 10000 });
  await teacher.close();
});

// ------------------------------------------------------------------ Restablecer
await step("Restablecer demostración con confirmación vuelve a los datos iniciales", async () => {
  await page.goto(`${BASE}/acceso`);
  await page.getByRole("button", { name: "Restablecer demostración" }).click();
  const dialog = page.getByRole("dialog", { name: "¿Restablecer la demostración?" });
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  expect(Object.keys((await db()).institutions).length === 2, "Cancelar no debería borrar nada");
  await page.getByRole("button", { name: "Restablecer demostración" }).click();
  await page.getByRole("dialog", { name: "¿Restablecer la demostración?" }).getByRole("button", { name: "Sí, restablecer" }).click();
  await page.waitForTimeout(800);
  const data = await db();
  expect(Object.keys(data.institutions).length === 1, "La institución creada sigue existiendo");
  expect(data.applications.every((a) => !a.institution_name.startsWith("Escuela de Prueba")), "La solicitud de prueba sigue existiendo");
  return `${Object.keys(data.institutions).length} institución, ${data.applications.length} solicitudes iniciales`;
});

// ------------------------------------------------------------------ Responsividad y accesibilidad
const axeSource = readFileSync(join(here, "..", "node_modules", "axe-core", "axe.min.js"), "utf8");
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const phone = await mobile.newPage();
await phone.goto(`${BASE}/acceso`);
await phone.locator("#perfil-student .profile-enter").click();
await phone.waitForURL(/\/panel\/estudiante\/?$/);
for (const path of ["/", "/acceso", "/solicitud", "/panel/estudiante", "/panel/estudiante/escanear", "/panel/estudiante/aprender/plastico-basico"]) {
  await step(`Responsividad 390 px sin desbordamiento horizontal: ${path}`, async () => {
    await phone.goto(`${BASE}${path}`);
    await phone.waitForTimeout(1200);
    const { scroll, width } = await phone.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
    await phone.screenshot({ path: join(SHOTS, `movil${path.replaceAll("/", "_") || "_inicio"}.png`) });
    expect(scroll <= width + 1, `scrollWidth ${scroll} > ${width}`);
  });
}
await mobile.close();

const a11yPages = ["/", "/acceso", "/solicitud", "/panel/estudiante", "/panel/estudiante/escanear", "/panel/docente", "/panel/director", "/panel/director/reportes", "/panel/admin"];
for (const path of a11yPages) {
  await step(`Accesibilidad (axe-core, WCAG 2.1 AA) sin fallas graves ni críticas: ${path}`, async () => {
    const role = path.split("/")[2];
    if (role) {
      const select = { estudiante: ["student", "s-0-0"], docente: ["teacher", "t-1"], director: ["director", "d-1"], admin: ["admin", "admin-1"] }[role];
      await page.evaluate(([r, p]) => { const a = JSON.stringify({ role: r, personId: p, institutionId: "centro-escolar-piloto" }); sessionStorage.setItem("sortlyscan-demo-actor", a); localStorage.setItem("sortlyscan-demo-actor", a); }, select);
    }
    await page.goto(`${BASE}${path}`);
    await page.waitForTimeout(1500);
    await page.addScriptTag({ content: axeSource });
    const res = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
    const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.length === 0, bad.map((v) => `${v.id} (${v.nodes.length})`).join(", "));
    return `${res.violations.length} avisos menores`;
  });
}

await browser.close();
const passed = results.filter((r) => r.resultado === "aprobado").length;
const summary = {
  fecha: new Date().toISOString(), base: BASE, navegador: "Google Chrome (Playwright)", aprobadas: passed, fallidas: results.length - passed,
  errores_de_consola: consoleErrors.slice(0, 20), pruebas: results
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(summary, null, 2));
console.log(`\n${passed}/${results.length} pruebas aprobadas · ${consoleErrors.length} errores de consola · resultados en ${OUT}`);
process.exit(passed === results.length ? 0 : 1);
