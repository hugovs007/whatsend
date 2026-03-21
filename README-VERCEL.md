# WhatSend (whatsend fork) - Deploy em Vercel + Supabase (opcional)

Este arquivo explica como preparar, rodar e fazer deploy do seu projeto whatsend na Vercel (Frontend) e em host backend compatível.

## 1) Estrutura do projeto

- `backend/`: API Node.js + Express + Sequelize + WhatsApp bot
- `frontend/`: React + Vite + Material UI
- `.env.example` em `backend` com todas as variáveis de ambiente
- `docker-compose.yaml` com MySQL + phpMyAdmin + browserless

## 2) Requisitos locais

- Node.js 18+ (recomendado 18 ou 20)
- npm 9+ (ou yarn)
- Docker (para mysql/local dev) ou banco MySQL/PostgreSQL
- git

## 3) Instalação local

**Backend**

```powershell
cd c:\pxxope\whatsend\backend
npm install
copy .env.example .env
```

Edite `backend/.env` com:

- `DB_DIALECT=mysql` (default) ou `postgres`
- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_NAME=whatsend`
- `DB_USER=root`
- `DB_PASS=...`
- `BACKEND_URL=http://localhost:8080`
- `FRONTEND_URL=http://localhost:3000`
- `JWT_SECRET`/`JWT_REFRESH_SECRET`

**Banco**

```powershell
# via docker-compose local
cd c:\pxxope\whatsend
docker-compose up -d mysql

# migrar + seed
cd backend
npx sequelize db:migrate
npx sequelize db:seed:all
```

**Start**

```powershell
cd backend
npm run dev
```

**Frontend**

```powershell
cd c:\pxxope\whatsend\frontend
npm install
# configurar environment variable da URL do backend:
# em .env:
# REACT_APP_BACKEND_URL=http://localhost:8080/
npm run dev
```

## 4) Deploy na Vercel (frontend)

### 4.1 Configuração Vercel

- Projeto: apontar para `frontend/`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment Variables (Production):
  - `REACT_APP_BACKEND_URL=https://api.suaaplicacao.com/` (backend real)

### 4.2 Back-end

Vercel não é adequado para backend stateful (Websocket + WhatsApp bot + long-lived process). Podem usar:

- Render (service continuo)
- Railway
- DigitalOcean App
- VPS/EC2 + Docker

Backend deploy:

- `cd backend`
- `npm install`
- `npm run build`
- `npx sequelize db:migrate`
- `npx sequelize db:seed:all`
- `npm start` (ou pm2/dockers)

Defina `BACKEND_URL` e `FRONTEND_URL` em `.env` para produção.

## 5) Supabase (opcional)

Se quiser usar como Postgres:

- Crie projeto Supabase e pegue credenciais SQL
- Em `backend/.env`:
  - `DB_DIALECT=postgres`
  - `DB_HOST=<host.supabase.co>`
  - `DB_PORT=5432`
  - `DB_NAME=postgres` (ou conforme seu schema)
  - `DB_USER=<username>`
  - `DB_PASS=<password>`
  - `DB_SSL=true` (se necessário adicionar em db config)

- No `backend/src/config/database.ts`, se necessário:
  - adicionar `dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }` para Supabase

- Rodar:
  - `npx sequelize db:migrate`
  - `npx sequelize db:seed:all`

**Nota**: Supabase só fornece DB. Para WhatsApp/Websocket/Redis, continue com o seu backend separado.

## 6) Docker (opcional)

`docker-compose.yaml` já inclui `mysql`, `phpmyadmin`, `browserless`.

## 7) Checklist de ambiente para Vercel + backend remoto

- [x] Frontend no Vercel
- [x] Backend em servidor próprio (não serverless)
- [x] DB MySQL local ou Supabase (Postgres)
- [x] CORS: FRONTEND_URL e BACKEND_URL configurados
- [x] QR code e sessão WhatsApp funcionando

---

## 8) Observação importante

Se usar `whatsapp-web.js`, precisa sessão mantida e isolar processo de bot (não serverless). A conexão ao WhatsApp deve ser preservada e requer usar um host com disco persistente.
