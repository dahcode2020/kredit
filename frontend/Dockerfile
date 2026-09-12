FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
FROM node:22-alpine
WORKDIR /app
# Posé explicitement parce que `distDir` en dépend (`.next` en production, `.next-dev` en dev, voir
# next.config.js). Mesuré: `next start` force déjà production tout seul (`env -u NODE_ENV next start`
# -> GET /fr 200), donc cette ligne n'est pas ce qui fait marcher l'image — c'est ce qui fait qu'un
# changement de CLI ne la casse pas en silence. Ancre: tests/unit/prod-dist-dir.spec.ts.
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]
