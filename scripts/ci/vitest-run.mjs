// ============================================================
// scripts/ci/vitest-run.mjs — vitest avec timeout mur (garde-fou CI)
// ------------------------------------------------------------
// REDIS-TEST-CLEANUP-V1 / diagnostic : lance `vitest run --reporter=verbose`
// avec un TIMEOUT GLOBAL en temps réel. Si la suite ne se termine pas (test
// bloqué, handle ouvert empêchant la sortie, boucle native synchrone…), on
// tue vitest et on sort en 124 — la tâche turbo se TERMINE alors (au lieu de
// tourner des heures) et ses logs sont flushés. Le reporter verbose montre
// le dernier test passé : le blocage est juste après.
//
// Réglable via VITEST_HARD_TIMEOUT_MS (défaut 90 s). Args supplémentaires
// transmis à vitest (ex. un fichier de test précis).
// ============================================================

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const HARD_MS = Number(process.env["VITEST_HARD_TIMEOUT_MS"] ?? 90000);
const vitestBin = resolve(process.cwd(), "node_modules/vitest/vitest.mjs");
const args = ["run", "--reporter=verbose", ...process.argv.slice(2)];

const child = spawn(process.execPath, [vitestBin, ...args], { stdio: "inherit" });

const timer = setTimeout(() => {
  console.error(
    `\n[vitest-run] HARD TIMEOUT après ${HARD_MS}ms — vitest ne s'est pas ` +
    `terminé (test bloqué ou handle ouvert). On le tue.`,
  );
  try { child.kill("SIGKILL"); } catch { /* ignore */ }
  setTimeout(() => process.exit(124), 1500);
}, HARD_MS);
timer.unref?.();

child.on("exit", (code, signal) => {
  clearTimeout(timer);
  process.exit(code ?? (signal ? 1 : 0));
});
