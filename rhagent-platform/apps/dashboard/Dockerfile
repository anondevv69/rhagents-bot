FROM node:20-slim AS base

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/dashboard/package.json ./apps/dashboard/

RUN npm install --workspace=@rhagent/shared --workspace=@rhagent/dashboard

# Build shared
COPY packages/shared/ ./packages/shared/
RUN npm -w packages/shared run build

# Build dashboard
COPY apps/dashboard/ ./apps/dashboard/
RUN npm -w apps/dashboard run build

# Runtime
FROM node:20-slim
WORKDIR /app
COPY --from=base /app .

EXPOSE 3000
CMD ["npm", "-w", "apps/dashboard", "run", "start"]
