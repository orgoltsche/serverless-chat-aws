FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose dev server port
EXPOSE 3000

# Default command for dev
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
