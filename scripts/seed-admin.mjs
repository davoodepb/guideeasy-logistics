#!/usr/bin/env node
/**
 * Script para criar o utilizador admin diretamente no Firestore
 * via REST API (sem necessitar de Service Account).
 */

import { createHash, randomUUID } from "crypto";

// Carregar bcryptjs
const bcrypt = (await import("bcryptjs")).default;

const FIREBASE_API_KEY = "AIzaSyClBw569jLYXKWL6lr5hYl-3ppCT7_PzJg";
const PROJECT_ID = "n8n-prudencio";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const ADMIN_EMAIL = "admin@prudencio.pt";
const ADMIN_PASSWORD = "Rpavg5n";
const ADMIN_NAME = "Administrador";

console.log("🔐 A criar hash da password...");
const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
console.log("✅ Hash criado.");

const adminId = randomUUID();

// Criar documento no Firestore via REST API
const url = `${FIRESTORE_BASE}/users/${adminId}?key=${FIREBASE_API_KEY}`;

const body = {
  fields: {
    id: { stringValue: adminId },
    email: { stringValue: ADMIN_EMAIL },
    password_hash: { stringValue: passwordHash },
    name: { stringValue: ADMIN_NAME },
    role: { stringValue: "admin" },
    created_at: { integerValue: Date.now().toString() },
  },
};

console.log(`\n📝 A criar utilizador admin no Firestore...`);
console.log(`   URL: ${url}`);

try {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.ok) {
    const result = await response.json();
    console.log("\n✅ Utilizador admin criado com sucesso!");
    console.log(`   📧 Email: ${ADMIN_EMAIL}`);
    console.log(`   🔑 Password: ${ADMIN_PASSWORD}`);
    console.log(`   👤 Nome: ${ADMIN_NAME}`);
    console.log(`   🆔 ID: ${adminId}`);
    console.log(`   📄 Documento: ${result.name}`);
  } else {
    const errText = await response.text();
    console.error(`\n❌ Falha ao criar utilizador (HTTP ${response.status}):`);
    console.error(errText);
    
    if (response.status === 403 || response.status === 400) {
      console.log("\n⚠️  As regras do Firestore estão a bloquear a escrita.");
      console.log("   Vai à Firebase Console → Firestore → Rules e muda a regra de 'users' para:");
      console.log('   match /users/{userId} { allow read, write: if true; }');
      console.log("   Depois volta a executar este script.");
    }
  }
} catch (err) {
  console.error("\n❌ Erro de rede:", err.message);
}
