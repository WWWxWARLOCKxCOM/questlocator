# QuestLocator (MVP) — на Supabase

Мобильное приложение на React Native + TypeScript: пользователи зарабатывают баллы/промокоды
за нахождение в заведениях (кафе, рестораны, музеи, магазины), подтверждённое QR-кодом и GPS.
Бэкенд — Supabase (Postgres + Auth + Storage + Realtime + Edge Functions).

## Структура проекта

```
QuestLocator/
├── App.tsx                  # корневой компонент
├── app.config.ts            # конфиг Expo (иконки, разрешения, .env -> extra)
├── package.json
├── tsconfig.json
├── .env.example              # шаблон переменных окружения клиента
├── src/
│   ├── config/supabase.ts    # инициализация Supabase-клиента
│   ├── types/                # общие TypeScript-типы
│   ├── context/AuthContext.tsx
│   ├── navigation/            # Root / Client (Drawer) / Admin (Tabs) навигаторы
│   ├── services/               # authService, placesService, questService,
│   │                            # sessionService (RPC), locationService, antiFraudService
│   ├── utils/distance.ts      # расчёт расстояния (гаверсинус, клиентское дублирование)
│   └── screens/
│       ├── auth/               # PhoneAuthScreen, AdminGateScreen (скрытый)
│       ├── client/              # Map, QRScanner, ActiveSession, Profile, History, PromoCodes, Settings
│       └── admin/               # Dashboard, Places, Quests, QRGenerator, PhotoModeration
└── supabase/
    ├── config.toml            # конфиг Supabase CLI (локальная разработка)
    ├── migrations/
    │   ├── 0001_init.sql       # схема таблиц + Row Level Security
    │   ├── 0002_functions.sql  # RPC-функции (start/pause/resume/end session, статистика)
    │   └── 0003_storage.sql    # бакеты Storage + политики доступа
    └── functions/
        ├── verify-admin-credentials/  # проверка админ-логина
        └── generate-place-qr/          # генерация QR-кода заведения
```

## Ключевые архитектурные решения

- **Разделение клиент/админ.** Флаг `is_admin` хранится в таблице `profiles` и НИКОГДА
  не выставляется клиентом напрямую (нет такой RLS-политики). Единственный путь его
  включить — Edge Function `verify-admin-credentials`, которая сверяет email/пароль
  с серверными секретами (`supabase secrets set ADMIN_EMAIL/ADMIN_PASSWORD`) и обновляет
  `profiles.is_admin` через service role ключ, обходящий RLS. Экран входа в админку скрыт:
  5 нажатий на логотип за 3 секунды на экране авторизации.
- **Защита от читерства с QR.** Проверка "существует ли заведение / активен ли квест /
  совпадают ли координаты (радиус 50 м)" выполняется в SQL-функции `start_session`
  (`SECURITY DEFINER`), а не на клиенте — подделать GPS на устройстве недостаточно.
- **Начисление баллов — только на сервере.** RPC-функции `end_session`/`force_end_session`
  пересчитывают время сессии из серверных временных меток (`started_at`,
  `accumulated_paused_ms`) и атомарно обновляют баланс пользователя в той же транзакции
  Postgres. У клиента нет прав на прямой `UPDATE` таблицы `sessions` — только через RPC.
- **Анти-фрод.** `AntiFraudMonitor` (клиент) следит за акселерометром: 45 минут
  неподвижности → push "Я здесь" → 5 минут на подтверждение → иначе `force_end_session`.
- **Realtime вместо onSnapshot.** Экраны карты, сессии, истории и модерации подписаны
  на `postgres_changes` каналы Supabase Realtime — сервисы делают начальный `select`,
  затем держат локальный кэш, обновляемый событиями INSERT/UPDATE/DELETE.

## Установка и запуск

### 1. Предварительные требования
- Node.js 20+, npm
- Supabase CLI (`npm install -g supabase`)
- Docker (для локального Supabase-стека через `supabase start`)
- Аккаунт на [supabase.com](https://supabase.com) для облачного проекта
- Google Cloud аккаунт с включённым Maps SDK (Android/iOS) для Google Maps API-ключа
- SMS-провайдер для Phone Auth (Twilio / MessageBird / Vonage) — обязателен для
  продакшн-входа по телефону

### 2. Установка зависимостей приложения

```bash
cd QuestLocator
npm install
```

### 3. Создание и настройка проекта Supabase

```bash
supabase login
supabase init            # если запускаете вне уже подготовленной папки supabase/
supabase link --project-ref <ваш-project-ref>
```

Примените миграции (создаст таблицы, RLS-политики, RPC-функции, бакеты Storage):

```bash
supabase db push
```

Локальная разработка без облака:

```bash
supabase start            # поднимет Postgres, Auth, Storage, Studio в Docker
supabase db reset          # применит все миграции с нуля
```

### 4. Настройка SMS-провайдера (Phone Auth)

В Dashboard → Authentication → Providers → Phone подключите Twilio (или другого
провайдера). Для локальной разработки в `supabase/config.toml` есть закомментированная
секция `[auth.sms.twilio]` — раскомментируйте и укажите свои переменные через
`supabase secrets set TWILIO_ACCOUNT_SID=...` и т.д.

### 5. Переменные окружения клиента

```bash
cp .env.example .env
```

Заполните `SUPABASE_URL` и `SUPABASE_ANON_KEY` (Project Settings → API в Dashboard,
либо выводятся в консоль после `supabase start` для локального стека) и
`GOOGLE_MAPS_API_KEY`.

### 6. Настройка серверных секретов админ-доступа

**Никогда не храните пароль администратора в клиентском коде или `.env` приложения.**

```bash
supabase secrets set ADMIN_EMAIL=admin@questlocator.com
supabase secrets set ADMIN_PASSWORD=SuperSecretKey2026!
```

### 7. Деплой Edge Functions

```bash
supabase functions deploy verify-admin-credentials
supabase functions deploy generate-place-qr
```

### 8. Запуск приложения

```bash
npx expo start
```

Для нативных модулей (камера, фоновая геолокация, карты) потребуется **development build**,
обычный Expo Go их не поддерживает:

```bash
npx expo prebuild
npx expo run:android   # или
npx expo run:ios
```

### 9. Первый администратор

1. Зарегистрируйтесь как обычный пользователь через вход по телефону (SMS-код).
2. На экране логина нажмите 5 раз на логотип в течение 3 секунд → откроется
   служебный экран входа.
3. Введите email/пароль, заданные в шаге 6 (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).
4. После успешной проверки вашей строке в `profiles` будет выставлено `is_admin = true`,
   и приложение переключится на админ-панель (перечитывание профиля происходит сразу,
   без необходимости обновлять токен — в отличие от JWT custom claims).

## Схема базы данных

| Таблица    | Аналог из ТЗ         | Комментарий |
|------------|----------------------|-------------|
| `profiles` | `users`              | 1:1 с `auth.users`, создаётся триггером `on_auth_user_created` |
| `places`   | `places`             | RLS: чтение активных всем, запись — только `is_admin()` |
| `quests`   | `quests`              | то же самое |
| `sessions` | `sessions`             | запись только через RPC-функции (нет клиентских INSERT/UPDATE политик) |
| `photos`   | `photos`               | INSERT только через RPC `submit_session_photo`, UPDATE статуса — только админ |

## Что не реализовано в MVP (см. ТЗ, раздел 8 — Backlog)

- Офлайн-режим и офлайн-карты
- AI-сравнение фото (Google Cloud Vision / CLIP) — сейчас все фото уходят на ручную
  модерацию; точка интеграции отмечена комментарием в `supabase/functions/generate-place-qr`
  можно добавить отдельную Edge Function `compare-photo` на триггере вставки в `photos`
- Рейтинг заведений, мультиязычность, поддержка умных часов
- Реальная загрузка PNG QR-кода в галерею устройства (сейчас — заглушка-Alert;
  для продакшена нужен `react-native-view-shot` + `expo-media-library`)
- Database Webhook на INSERT в `places`, вызывающий `generate-place-qr` автоматически
  (сейчас клиент вызывает функцию вручную сразу после создания записи)

## Технический стек

React Native (Expo) + TypeScript · React Navigation · react-native-maps (Google Maps) ·
react-native-vision-camera · react-native-background-geolocation · Supabase
(Postgres, Auth, Storage, Realtime, Edge Functions) · react-native-qrcode-svg
