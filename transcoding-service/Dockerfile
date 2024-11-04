# Use an official Node.js runtime as the base image
FROM node:lts-alpine

RUN apk add --no-cache ffmpeg

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the application dependencies
RUN npm install

# Copy the application code to the working directory
COPY . .

# Expose the port the app runs on
EXPOSE 3002

# Define the command to run the application
CMD ["node", "app.js"]
