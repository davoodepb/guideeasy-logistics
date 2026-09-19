# Prudêncio — Gestão de Guias de Transporte

PWA para gestão de guias de transporte e obras. A aplicação usa Firebase como backend.

## Serviços Firebase

- Firebase Authentication para login, logout e persistência de sessão.
- Cloud Firestore para obras, checklists, perfis e histórico.
- Firebase Storage para ficheiros quando o fluxo de ficheiros estiver ativo.

## Configuração local

1. Instale as dependências:

   ```powershell
   npm install
   ```

2. Copie `.env.example` para `.env.local`.

3. Preencha os valores da aplicação Web Firebase no `.env.local`.

4. No Firebase Console, inicialize **Storage** em Storage > Get started.

5. No Firebase Console, ative o fornecedor **Email/Password** em Authentication.

6. Crie o primeiro utilizador em Authentication. Depois crie o documento
   `users/{uid}` no Firestore com `name` e `role` (`admin` ou `operator`).

7. Inicie a aplicação:

   ```powershell
   npm run dev
   ```

A aplicação fica disponível em `http://127.0.0.1:8433`.

Não coloque palavras-passe, tokens, chaves privadas ou ficheiros de Service Account no repositório.

## Diagnóstico Firebase

Abra `/firebase-test` depois de iniciar sessão. A página verifica:

- configuração do Firebase Web SDK;
- inicialização do Firebase Authentication;
- escrita, leitura e remoção de um documento temporário no Firestore;
- upload, download e remoção de um ficheiro temporário no Storage.

Os testes de dados precisam de uma sessão Firebase válida. Os artefactos de teste são removidos no fim.

## Desenvolvimento e validação

```powershell
npm run lint
npm run build
```

Para publicar as regras depois de autenticar a Firebase CLI:

```powershell
firebase deploy --only firestore:rules,storage
```

## Stack

| Camada               | Tecnologia                                  |
| -------------------- | ------------------------------------------- |
| Interface            | React 19 + TanStack Router + Tailwind CSS 4 |
| Backend de aplicação | TanStack Start + Nitro                      |
| Base de dados        | Cloud Firestore                             |
| Autenticação         | Firebase Authentication                     |
| Ficheiros            | Firebase Storage                            |
| Build                | Vite 7                                      |
