# Imagem Node + Chrome pronta para Puppeteer
FROM zenika/alpine-chrome:with-node

# Diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependência
COPY package*.json ./

# Evita que o Puppeteer baixe outro Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Instalar dependências
RUN npm ci --only=production

# Copiar o restante do código
COPY . .

# Porta da aplicação
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]
