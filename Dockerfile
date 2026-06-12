FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS final
COPY . .
EXPOSE 3000
ENV NODE_ENV=production

RUN apk add --no-cache curl && \
    curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh && \
    mv bin/arduino-cli /app/bin/arduino-cli && \
    /app/bin/arduino-cli core install arduino:avr esp32:esp8266

CMD ["node", "server.js"]
