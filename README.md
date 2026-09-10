# Prudêncio — Sistema de Gestão de Guias de Transporte (PWA)

Aplicação **PWA** completa para gestão de guias de transporte e obras, com suporte a upload de PDFs, extração OCR/QR Code, exportação para Excel e controlo de checklists.

---

## 🔥 Backend: Firebase Firestore

O projeto utiliza exclusivamente o **Firebase Firestore** como base de dados. Toda a persistência de dados (obras, checklists, utilizadores) é feita através do Firebase.

### Arquitetura:
- **Firebase Client SDK** — CRUD de dados (obras, checklists) diretamente via Firestore
- **Firestore REST API** — Autenticação server-side (leitura de utilizadores)
- **JWT + Cookies HTTP-only** — Gestão de sessões
- **bcryptjs** — Hash de passwords

---

## 📋 Variáveis de Ambiente

Crie um ficheiro `.env` baseado no `.env.example`:

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `JWT_SECRET` | Chave secreta para tokens JWT | ✅ Sim |
| `ADMIN_EMAIL` | Email do administrador (padrão: `admin@prudencio.pt`) | ✅ Sim |
| `ADMIN_PASSWORD` | Password do administrador (padrão: `Rpavg5n`) | ✅ Sim |
| `ADMIN_NAME` | Nome do administrador (padrão: `Administrador`) | Não |
| `FIREBASE_SERVICE_ACCOUNT` | JSON da Service Account (para acesso server-side avançado) | Não |

---

## 💻 Desenvolvimento Local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com os valores corretos

# 3. Iniciar servidor de desenvolvimento
npm run dev

# 4. Aceder à aplicação
# http://localhost:8433
```

### Credenciais de Login:
- **Email:** `admin@prudencio.pt`
- **Password:** `Rpavg5n`

---

## 🚀 Deploy na Vercel

1. Push para o GitHub
2. Criar projeto na Vercel e importar o repositório
3. Configurar variáveis de ambiente (`JWT_SECRET`, credenciais admin)
4. Deploy automático — build em ~40 segundos

---

## 📱 PWA

A aplicação é uma Progressive Web App instalável:
- **Manifest** configurado com ícones e shortcuts
- **Service Worker** com estratégia network-first e cache fallback
- **Modo standalone** para experiência nativa
- **Suporte offline** para conteúdo em cache

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TanStack Router + shadcn/ui + Tailwind CSS 4 |
| Backend | TanStack Start (SSR) + Nitro |
| Base de Dados | Firebase Firestore |
| Autenticação | JWT customizado + bcryptjs |
| Build | Vite 7 |
| Deploy | Vercel |
