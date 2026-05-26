#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ARMEMENT EUSTRATIOU — Générateur de SUBSCRIPTION_CODE (interactif)
// Usage : node generate-subscription-code.js
// ─────────────────────────────────────────────────────────────────────────────

import readline from "readline";

// ─── Chiffrement (identique à src/db.ts) ──────────────────────────────────────

const CIPHER_KEY = "AE_MARITIME_2025_KEY";

function keyBytes(len) {
  const arr = [];
  for (let i = 0; i < len; i++) {
    arr.push(CIPHER_KEY.charCodeAt(i % CIPHER_KEY.length));
  }
  return arr;
}

function encrypt(data) {
  // UTF-8 encode
  const bytes = [];
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 2048) {
      bytes.push((code >> 6) | 192, (code & 63) | 128);
    } else {
      bytes.push(
        (code >> 12) | 224,
        ((code >> 6) & 63) | 128,
        (code & 63) | 128,
      );
    }
  }
  // XOR
  const key = keyBytes(bytes.length);
  const xored = bytes.map((b, i) => b ^ key[i]);
  return Buffer.from(xored).toString("base64");
}

function decrypt(encoded) {
  const buf = Buffer.from(encoded, "base64");
  const bytes = Array.from(buf);
  const key = keyBytes(bytes.length);
  const xored = bytes.map((b, i) => b ^ key[i]);
  // UTF-8 decode
  let result = "";
  let i = 0;
  while (i < xored.length) {
    const b = xored[i];
    if (b < 128) {
      result += String.fromCharCode(b);
      i++;
    } else if (b < 224) {
      result += String.fromCharCode(((b & 31) << 6) | (xored[i + 1] & 63));
      i += 2;
    } else {
      result += String.fromCharCode(
        ((b & 15) << 12) | ((xored[i + 1] & 63) << 6) | (xored[i + 2] & 63),
      );
      i += 3;
    }
  }
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeEndDate(start, duration) {
  const end = new Date(start);
  if (duration === "test") end.setMinutes(end.getMinutes() + 5);
  if (duration === "monthly") end.setMonth(end.getMonth() + 1);
  if (duration === "yearly") end.setFullYear(end.getFullYear() + 1);
  return end;
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function separator() {
  console.log("─".repeat(60));
}

const durationLabel = {
  test: "Test (5 minutes)",
  monthly: "1 mois",
  yearly: "1 an",
};

// ─── Programme principal ───────────────────────────────────────────────────────

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║     ARMEMENT EUSTRATIOU — Générateur d'abonnement        ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ── Étape 1 : Saisie du MACHINE_CODE ──────────────────────────────
  const machineCodeInput = (
    await ask(rl, "📋 Collez le MACHINE_CODE de l'utilisateur :\n> ")
  ).trim();

  if (!machineCodeInput) {
    console.error("\n✗ MACHINE_CODE vide.\n");
    rl.close();
    return;
  }

  // ── Étape 2 : Déchiffrement et affichage ──────────────────────────
  let machinePayload;
  try {
    const raw = decrypt(machineCodeInput);
    machinePayload = JSON.parse(raw);
  } catch {
    console.error(
      "\n✗ Impossible de déchiffrer le MACHINE_CODE. Vérifiez qu'il est copié intégralement.\n",
    );
    rl.close();
    return;
  }

  if (machinePayload.type !== "MACHINE_CODE") {
    console.error("\n✗ Ce code n'est pas un MACHINE_CODE valide.\n");
    rl.close();
    return;
  }

  separator();
  console.log(
    "✅ MACHINE_CODE déchiffré avec succès. Données de l'utilisateur :\n",
  );
  console.log(`  Email        : ${machinePayload.email}`);
  console.log(`  Device ID    : ${machinePayload.deviceId}`);
  console.log(`  Navigateur   : ${machinePayload.userAgent}`);
  console.log(`  Langue       : ${machinePayload.language}`);
  console.log(`  Fuseau       : ${machinePayload.timezone}`);
  console.log(`  CPU cores    : ${machinePayload.cores}`);
  console.log(
    `  Généré le    : ${new Date(machinePayload.timestamp).toLocaleString("fr-FR")}`,
  );
  separator();

  // ── Étape 3 : Confirmation ─────────────────────────────────────────
  const confirm = (
    await ask(rl, "\nCes données sont-elles correctes ? (o/n) > ")
  )
    .trim()
    .toLowerCase();
  if (confirm !== "o" && confirm !== "oui") {
    console.log("\nOpération annulée.\n");
    rl.close();
    return;
  }

  // ── Étape 4 : Choix de la durée ───────────────────────────────────
  console.log("\nDurées disponibles :");
  console.log("  1 → Test (5 minutes)");
  console.log("  2 → 1 mois");
  console.log("  3 → 1 an");

  let duration;
  while (!duration) {
    const choice = (await ask(rl, "\nChoisissez la durée (1/2/3) > ")).trim();
    if (choice === "1") duration = "test";
    else if (choice === "2") duration = "monthly";
    else if (choice === "3") duration = "yearly";
    else console.log("  Choix invalide. Entrez 1, 2 ou 3.");
  }

  // ── Étape 5 : Génération du SUBSCRIPTION_CODE ─────────────────────
  const startDate = new Date();
  const endDate = computeEndDate(startDate, duration);

  const subPayload = {
    type: "SUBSCRIPTION_CODE",
    deviceId: machinePayload.deviceId,
    email: machinePayload.email,
    userAgent: machinePayload.userAgent,
    language: machinePayload.language,
    timezone: machinePayload.timezone,
    cores: machinePayload.cores,
    machineTimestamp: machinePayload.timestamp,
    duration,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };

  const subscriptionCode = encrypt(JSON.stringify(subPayload));

  // ── Étape 6 : Affichage du résultat ───────────────────────────────
  separator();
  console.log("\n✅ SUBSCRIPTION_CODE généré :\n");
  console.log(`  Email        : ${machinePayload.email}`);
  console.log(`  Durée        : ${durationLabel[duration]}`);
  console.log(`  Début        : ${startDate.toLocaleString("fr-FR")}`);
  console.log(`  Fin          : ${endDate.toLocaleString("fr-FR")}`);
  console.log(
    "\n── CODE À TRANSMETTRE À L'UTILISATEUR ─────────────────────\n",
  );
  console.log(subscriptionCode);
  console.log("\n" + "─".repeat(60) + "\n");

  rl.close();
}

main().catch((err) => {
  console.error("\n✗ Erreur inattendue :", err.message, "\n");
  process.exit(1);
});
