# Use an official Node.js runtime as a parent image
FROM node:22-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies (only production dependencies)
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (default: 3000)
EXPOSE 3000

# Set the environment to production
ENV NODE_ENV=production

# Start the application using the server script defined in package.json
CMD ["npm", "run", "server"]
