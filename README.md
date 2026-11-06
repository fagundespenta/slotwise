# Slotwise

**Online booking for small businesses: barbershops, clinics, personal trainers.**
Customers pick a service and a free time slot, the calendar never double-books, and the owner gets a dashboard with upcoming appointments and revenue.

[![CI](https://github.com/fagundespenta/slotwise/actions/workflows/ci.yml/badge.svg)](https://github.com/fagundespenta/slotwise/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js_16-000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-149ECA?logo=react&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?logo=stripe&logoColor=white)
![Auth.js](https://img.shields.io/badge/Auth.js-7C3AED)
![Zod](https://img.shields.io/badge/Zod-3E67B1?logo=zod&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)

🇧🇷 [Leia em Português](#português)

![Public booking page](docs/screenshots/booking-page.png)

---

## Features

- **Business owner accounts**: sign up with email/password or Google (Auth.js). Every new business starts with sensible default hours.
- **Services**: name, description, duration and price. A service that already has bookings is hidden instead of deleted, so history stays intact.
- **Weekly availability**: several time ranges per day (for lunch breaks), plus blocked dates for holidays and vacations.
- **Public booking page** at `/b/[slug]`: a three-step wizard (service → date & time → details) that works on phones and with a keyboard.
- **Real slot calculation**: slots come from the business hours, minus blocked dates, existing bookings, minimum notice and the booking horizon.
- **No double booking**: the chosen slot is checked again inside a `SERIALIZABLE` PostgreSQL transaction, and a race between two customers fails cleanly.
- **Time zone aware**: hours are stored as local wall-clock time and bookings as UTC instants. DST gaps and overlaps are covered by tests.
- **Confirmation page with a private manage link**: customers can view the booking, download an `.ics` calendar file or cancel.
- **Optional Stripe deposit** (test mode only): charge a percentage of the price up front through Stripe Checkout. The slot is held for 30 minutes and confirmed by webhook, or by checking the session when the customer comes back.
- **Dashboard**: upcoming bookings, revenue this month, cancellation rate and a weekly revenue chart computed with SQL (`date_trunc` in the business time zone).
- **English and Portuguese** across the whole app, validation errors included, chosen from the browser language or a switcher.
- **Accessible and responsive**: semantic landmarks, labelled form controls, `aria-invalid` errors, radio-group pickers, skip link, visible focus, reduced-motion support and dark mode.

## Screenshots

| Dashboard | Dark mode |
| --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Dashboard dark](docs/screenshots/dashboard-dark.png) |
| **Availability editor** | **Bookings** |
| ![Availability](docs/screenshots/availability.png) | ![Bookings](docs/screenshots/bookings.png) |
| **Booking confirmed** | **Mobile** |
| ![Confirmed](docs/screenshots/booking-confirmed.png) | <img src="docs/screenshots/mobile-booking.png" width="260" alt="Mobile booking page"> |

## Architecture

```
src/
├─ lib/
│  ├─ slots.ts        ← pure slot engine (no I/O), fully unit-tested
│  ├─ time.ts         ← wall-clock ⇄ UTC conversion with DST detection
│  ├─ validation.ts   ← Zod schemas + localized error messages
│  └─ stripe.ts       ← Stripe client that refuses live keys
├─ server/
│  ├─ booking.ts      ← loads rules/bookings, serializable booking transaction
│  ├─ stats.ts        ← dashboard KPIs + raw SQL weekly revenue
│  └─ actions/        ← Server Actions (auth, dashboard, public booking)
├─ app/
│  ├─ b/[slug]/       ← public booking wizard
│  ├─ booking/[token] ← customer manage / cancel page
│  ├─ dashboard/      ← owner area (overview, bookings, services, availability, settings)
│  └─ api/            ← slots JSON, Stripe webhook, .ics export, Auth.js
├─ i18n/              ← typed en/pt dictionaries
prisma/               ← schema, migrations, demo seed
tests/                ← Vitest unit tests
```

**Key decisions**

1. **The slot engine is a pure function.** `getAvailableSlots()` takes rules, blocked dates, busy intervals and `now` as plain data and returns UTC instants. Because it never touches the database or the clock, the tricky cases (DST, split shifts, back-to-back bookings, minimum notice) are covered by fast unit tests.
2. **Two kinds of time.** Opening hours mean "09:00 where the shop is", so they are stored as minutes from local midnight plus an IANA time zone. Bookings are real moments, so they are stored in UTC. Converting between the two checks the result: a wall-clock time that doesn't exist (the DST spring-forward hour) is skipped instead of shifted.
3. **Double booking is prevented by the database.** The server action does not trust the slot the browser sent. It recomputes the free slots inside a `SERIALIZABLE` transaction, and PostgreSQL aborts one of two concurrent transactions (Prisma `P2034`). That one is retried and then gets a friendly "slot just taken" message.
4. **Payment holds expire.** A booking waiting for its deposit blocks the slot only until `holdExpiresAt`. An abandoned checkout releases the time on its own, with no cron job needed.
5. **Secrets stay out of the repo.** Configuration lives in `.env` (see `.env.example`), and Stripe keys that are not test keys are rejected at runtime.

## Getting started

Requirements: **Node.js 20.19+** (24 recommended).

```bash
git clone https://github.com/fagundespenta/slotwise.git
cd slotwise
npm install
cp .env.example .env
```

**1. Database.** Any PostgreSQL works. To get one locally with nothing to install, run:

```bash
npx prisma dev
```

Copy the `postgres://…` TCP URL it prints into `DATABASE_URL` in `.env`. You can also use a free [Neon](https://neon.tech) database.

**2. Secret.** Set `AUTH_SECRET` in `.env` (generate it with `npx auth secret`).

**3. Migrate, seed and run:**

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000.

- Demo login: `demo@slotwise.app` / `demo1234`
- Demo booking page: http://localhost:3000/b/studio-fade

### Optional: Google sign-in

Create OAuth credentials in Google Cloud with the redirect URI `http://localhost:3000/api/auth/callback/google`, then set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. The button only shows up when both are set.

### Optional: Stripe deposits (test mode)

1. Put your **test** secret key (`sk_test_…`) in `STRIPE_SECRET_KEY`.
2. Forward webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook` and copy the `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
3. Set a deposit percentage in **Dashboard → Settings**, then pay with card `4242 4242 4242 4242`.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run build` | Production build |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:seed` | Reset and load the demo business |

## Deploying (free tier)

**Vercel + Neon**: create a Neon Postgres database and import the repo in Vercel. Set `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` (and optionally Google/Stripe) as environment variables, and use `prisma migrate deploy && next build` as the build command.

## License

MIT, © Pedro Henrique Siqueira Fagundes

---

## Português

**Agendamento online para pequenos negócios: barbearias, clínicas, personal trainers.**
O cliente escolhe um serviço e um horário livre, a agenda nunca marca dois clientes no mesmo horário, e o dono tem um painel com os próximos atendimentos e o faturamento.

### Funcionalidades

- **Conta do negócio**: cadastro com e-mail/senha ou Google (Auth.js). Cada negócio novo já começa com um horário padrão.
- **Serviços**: nome, descrição, duração e preço. Serviços que já têm agendamentos são ocultados em vez de excluídos, para manter o histórico.
- **Disponibilidade semanal**: vários intervalos por dia (pausa para o almoço) e datas bloqueadas para feriados e férias.
- **Página pública** em `/b/[slug]`: assistente em três passos (serviço → data e horário → dados) que funciona no celular e pelo teclado.
- **Cálculo real de horários**: os horários livres vêm do expediente, descontando folgas, agendamentos existentes, antecedência mínima e o limite de dias à frente.
- **Sem conflito de horários**: o horário escolhido é conferido de novo dentro de uma transação `SERIALIZABLE` no PostgreSQL. Se dois clientes tentam o mesmo horário ao mesmo tempo, só um consegue, e o outro recebe uma mensagem clara.
- **Fuso horário correto**: o expediente é salvo no horário local e os agendamentos em UTC. Os casos de horário de verão têm testes.
- **Página de confirmação com link privado**: o cliente pode ver o agendamento, baixar o arquivo `.ics` ou cancelar.
- **Sinal opcional com Stripe** (só modo de teste): cobra uma porcentagem do preço antes, pelo Stripe Checkout. O horário fica reservado por 30 minutos e é confirmado pelo webhook ou na volta do cliente ao site.
- **Painel**: próximos agendamentos, faturamento do mês, taxa de cancelamento e um gráfico de faturamento semanal calculado em SQL.
- **Português e inglês** em todo o app, inclusive nas mensagens de validação.
- **Acessível e responsivo**: rótulos em todos os campos, erros com `aria-invalid`, navegação por teclado, link "pular para o conteúdo", foco visível e modo escuro.

### Decisões de arquitetura

1. **O motor de horários é uma função pura** (`src/lib/slots.ts`). Ele não acessa banco nem relógio, então os casos difíceis (horário de verão, pausas, agendamentos colados, antecedência mínima) são cobertos por testes unitários rápidos.
2. **Dois tipos de tempo.** O expediente ("abre às 09:00") é salvo em minutos desde a meia-noite local junto com o fuso IANA. Os agendamentos são momentos reais, salvos em UTC. Na conversão, um horário que não existe (a hora pulada no início do horário de verão) é descartado em vez de deslocado.
3. **Quem impede o conflito é o banco.** A action não confia no horário que o navegador enviou: ela recalcula os horários livres dentro de uma transação `SERIALIZABLE` e tenta de novo quando o PostgreSQL detecta uma corrida (`P2034`).
4. **Reservas aguardando pagamento expiram sozinhas** (`holdExpiresAt`), sem precisar de cron.
5. **Nenhum segredo no repositório**: tudo fica no `.env` (veja o `.env.example`), e chaves do Stripe que não são de teste são recusadas.

### Como rodar

```bash
git clone https://github.com/fagundespenta/slotwise.git
cd slotwise
npm install
cp .env.example .env
npx prisma dev            # Postgres local: copie a URL postgres:// para DATABASE_URL
npx auth secret           # gere o AUTH_SECRET
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Acesse http://localhost:3000. Login demo: `demo@slotwise.app` / `demo1234`. Página demo: `/b/studio-fade`.

Para o login com Google e o sinal com Stripe, veja as seções opcionais em inglês acima. Use o cartão de teste `4242 4242 4242 4242`.

### Testes e qualidade

`npm run lint`, `npm run typecheck`, `npm test` e `npm run build` rodam no GitHub Actions a cada push.

### Deploy gratuito

Vercel + Neon: crie um banco no Neon, importe o repositório na Vercel e configure `DATABASE_URL`, `AUTH_SECRET` e `APP_URL`.

---

Feito por **Pedro Henrique Siqueira Fagundes** · [GitHub](https://github.com/fagundespenta)
