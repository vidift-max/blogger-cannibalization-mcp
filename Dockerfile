FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p data
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/index.js"]