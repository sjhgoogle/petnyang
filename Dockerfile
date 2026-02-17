# Use an official Node.js image as the base image
FROM node:18-bullseye

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install the Node.js dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose port 3000 to the outside world
EXPOSE 3000

# Command to run your application
# CMD ["npm", "start"]
CMD ["node", "src/app.js"]

# docker build -t petnyang .
# docker tag petnyang siha159159/petnyang
# docker push siha159159/petnyang
