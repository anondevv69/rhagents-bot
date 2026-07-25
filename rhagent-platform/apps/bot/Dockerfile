FROM node:20-slim AS base

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/bot/package.json ./apps/bot/

RUN npm install --workspace=@rhagent/shared --workspace=@rhagent/bot

# Build shared
COPY packages/shared/ ./packages/shared/
RUN npm -w packages/shared run build

# Build bot
COPY apps/bot/ ./apps/bot/
RUN npm -w apps/bot run build

# Runtime
FROM node:20-slim
WORKDIR /app
COPY --from=base /app .

EXPOSE 8090
CMD ["npm", "-w", "apps/bot", "run", "start"]
