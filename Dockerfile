# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Встановлюємо bun
RUN npm install -g bun

# Копіюємо конфігураційні файли пакетів
COPY package.json bun.lock* ./

# Встановлюємо залежності
RUN bun install --frozen-lockfile

# Копіюємо всі файли проекту фронтенду
COPY . .

# Вказуємо внутрішню адресу бекенду для routeRules проксі, що вбудовуються під час збірки
ENV NUXT_API_BASE_INTERNAL=http://api:8000

# Збираємо додаток з лімітом пам'яті 4ГБ для запобігання Out of Memory
RUN NODE_OPTIONS="--max-old-space-size=4096" bun run build

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

# Копіюємо збірку з етапу builder
COPY --from=builder /app/.output ./.output

EXPOSE 3000

ENV PORT=3000 \
    HOST=0.0.0.0

CMD ["node", ".output/server/index.mjs"]
