FROM node:18-slim

# Java install karo
RUN apt-get update && \
    apt-get install -y default-jre-headless && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .
RUN npm install

COPY server.js .
COPY uber-apk-signer.jar .

EXPOSE 3000

CMD ["node", "server.js"]
