# Діловод · dms-dir (web)

Вебфронт системи електронного документообігу **ДСТУ 4163:2020**. Nuxt 4 + Nuxt UI 4
(Vue 3), підпис КЕП у браузері через EUSign (ІІТ). Підмодуль головного репозиторію
[dstu_4163_2020](../../) — ходить на REST API порталу `portal/` (FastAPI, порт 8000).

> Це клієнтська частина. Доменне ядро (генерація/валідація PDF/DOCX, правила ДСТУ),
> серверний підпис UAPKI і бекенд — у головному репозиторії. Докладніше — у
> кореневому `README.md`.

## Що це

Дашборд документообігу: картка документа у вигляді майстра (stepper), список
документів із фільтрами/папками/календарем, погодження, завдання, контрагенти,
користувачі, процеси, доставка (Ф-107). Підпис — на клієнті: приватний ключ
ДСТУ 4145 не покидає браузер (Закон 2155-VIII).

## Стек

- **Nuxt 4.4** + **Nuxt UI 4.8** (TailwindCSS 4, `@nuxt/content` 3 для docs/blog)
- **Аутентифікація:** Bearer-токен у `localStorage` (`dilovod_token`), SSR-safe через `useState`;
  два шляхи — `login(email, password)` і `loginWithKep(sigB64, challenge)`
- **КЕП:** EUSign WASM (`euscpfactory`) для файлового ключа + iframe-віджет ІІТ для
  апаратного токена; CAdES_X_Long, ДСТУ 4145 / GOST 34.311
- **Менеджер пакетів:** `bun@1.1.27`

## Запуск

```bash
bun install
bun run dev       # http://localhost:3000  (потребує api на :8000)
```

Змінні оточення (через `.env` або `NUXT_PUBLIC_API_BASE`):

| Env | Призначення | Типово |
|---|---|---|
| `NUXT_PUBLIC_API_BASE` | публічна адреса API (браузер) | `http://localhost:8000` |
| `NUXT_API_BASE_INTERNAL` | внутрішня адреса для SSR-проксі (Docker) | = public |
| `NUXT_PUBLIC_SITE_URL` | канонічний URL для OG-image | (порожньо) |

### У контексті всього проєкту

З кореня репозиторію:

```bash
./manage.sh frontend-dev      # bun run dev :3000
./manage.sh frontend-build    # production build (bun run build)
./manage.sh frontend-check    # typecheck (bun run typecheck)
./manage.sh up                # Docker: api:8000 + web:3000
```

Docker-збірка — `Dockerfile` (двоступенева: `node:22-alpine` builder → runner,
запуск `node .output/server/index.mjs`). Дев-режим у `docker-compose` ходить на
`target: builder` з volume-mount і HMR через Vite на порті `24678` (`CHOKIDAR_USEPOLLING`
для macOS/Windows). Внутрішня адреса бекенду для проксі вбудовується на етапі build
через `NUXT_API_BASE_INTERNAL=http://api:8000`.

## Архітектура

### Сторінки (`app/pages/`)

- `/dashboard` — основний модуль, захищений `middleware/auth`, `layout: dashboard`,
  `ssr: false` (бо EUSign/live-API на клієнті)
- `/login`, `/signup` — аутентифікація (`ssr: false`)
- `/`, `/pricing`, `/blog`, `/changelog`, `/docs/[...slug]` — контент із `@nuxt/content`

### Проксі (`nuxt.config.ts`, routeRules)

- `/api/eusign/**` → бекенд — EUSign WASM, щоб dynamic import не блокувався CORS
- `/signdata/**` → бекенд — `CAs.json` та ресурси signdata для `euscpfactory`

### Дашборд-store (`app/composables/dashboard/`)

`createDashboardStore()` у `useDashboard.ts` склеює **18 composables** у один store і
публікує через `provide/inject` (символ `DASHBOARD_KEY`); дочірні компоненти читають
його через `useDashboard()`. Спільні примітиви (`docs`, `activeCategory`,
`searchQuery`) створюються в корені, щоб уникнути циклічних залежностей між
`documents ↔ folders ↔ calendar`.

| Composable | Призначення |
|---|---|
| `useDocuments` | CRUD, фільтри, архів, вибір, масове видалення |
| `useDocForm` | форма-картка, кроки майстра (stepper) |
| `useEuSign` | підпис КЕП (manifest → CAdES → `/sign`) |
| `useFolders` | папки, переміщення документів |
| `useCalendar` | календар документів за датами |
| `useDocViewer` | перегляд PDF/HTML |
| `useScanUpload` | завантаження сканів |
| `useArchiveExport` | експорт архіву за періодом |
| `useCounterparties` | контрагенти |
| `useDelivery` | доставка, Ф-107, етикетки |
| `useJournals` | журнали реєстрації |
| `useUsers` | керування користувачами |
| `useProcesses` | бізнес-процеси |
| `useApprovals` | погодження (послідовні/паралельні) |
| `useTasks` | завдання та резолюції |
| `useFavorites` | обране (localStorage) |
| `useImport` | імпорт/експорт документів |
| `useAuth` | токен, user, `apiFetch` з авто-logout при 401 |

### Життєвий цикл документа

Картка документа — це `UStepper` з кроками (компоненти `app/components/dashboard/Step*.vue`):

```
StepDocument → StepValidation → StepApproval → StepSigning → StepResolutions → StepDelivery
```

Статуси: `draft` → `pending_approval` → `pending_signatures` →
`signed`/`published` | `rejected` | `deleted`. Просроченими вважаються документи,
що висять у `pending_*` понад 7 днів від `created_at`.

### Потік підпису КЕП (`useEuSign.signCurrent`)

1. `GET /documents/{id}/manifest` — маніфест для підпису
2. Підпис CAdES_X_Long у браузері (файловий ключ через `euscpfactory` або токен через віджет)
3. `POST /documents/{id}/sign` із `signature_b64` → сервер приймає готовий p7s

`bootstrap()` динамічно інжектить `/eusign.js` і робить `import('/api/eusign/modules/euscpfactory.js')`
через `new Function` (обхід статичного аналізу Vite — файл не існує локально).

## Скрипти

```bash
bun run dev        # дев-сервер
bun run build      # production-збірка
bun run preview    # локальний превʼю збірки
bun run lint       # ESLint
bun run typecheck  # vue-tsc
```

## Ліцензія

MIT (як і кореневий репозиторій).
