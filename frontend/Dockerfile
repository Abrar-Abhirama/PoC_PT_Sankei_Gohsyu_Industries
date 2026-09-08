# ─────────────────────────────────────────────────────────────
# Frontend — Development (Vite dev server with hot reload)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app

# Install dependencies first (layer cache optimization)
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
