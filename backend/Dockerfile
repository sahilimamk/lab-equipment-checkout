FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["sh", "-c", "node scripts/migrate.js && node scripts/seed.js && node dist/index.js"]
