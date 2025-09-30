FROM node:18-alpine
WORKDIR /app
COPY . .
WORKDIR /app/backend
RUN npm install
CMD ["npm", "run", "dev"]
