FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4000
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm start"]
