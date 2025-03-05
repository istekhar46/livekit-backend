#!/bin/bash

# Check if arguments are provided
if [ $# -ne 3 ]; then
  echo "Usage: $0 <folder_name> <commit_hash> <env>"
  exit 1
fi

FOLDER_NAME=$1
COMMIT_HASH=$2
IMAGE_NAME=$1:$COMMIT_HASH
CONTAINER_NAME=$1
ENV=$3
ENVPATH="${HOME}/envs/livekit-call-tmp"
# Check if the folder already exists
if [ ! -d "$FOLDER_NAME" ]; then
  # Clone the repository into the specified folder
  git clone git@gitlab.rapidinnovation.tech:root/livekit-call-tmp.git -b $ENV "$FOLDER_NAME"
  cd "$FOLDER_NAME"
else
  # Navigate into the specified folder
  cd "$FOLDER_NAME" || exit 1
  # Pull the latest changes from the repository
  git pull origin $ENV
fi

# Check if the previous operation was successful
if [ $? -eq 0 ]; then
  # Docker build using folder name as image name
  docker build --build-arg ENV="$ENV" -t "$IMAGE_NAME" .
  # Check if Docker build was successful
  if [ $? -eq 0 ]; then
    # Docker stop old instance
    if docker ps -a --format '{{.Names}}' | grep -Eq "^$CONTAINER_NAME$"; then
      echo "Stopping existing container: $CONTAINER_NAME"
      docker stop "$CONTAINER_NAME" || true
      echo "Removing existing container: $CONTAINER_NAME"
      docker rm "$CONTAINER_NAME" || true
    else
      echo "docker container stop failed or container not exists"
    fi  
  else
    echo "Docker build failed."
    exit 1
  fi
else
  echo "Git operation failed."
  exit 1
fi
  docker run -d -p 3000:3000 --network=livekit --env-file "$ENVPATH" --name "$CONTAINER_NAME" "$IMAGE_NAME"
  docker images prune -a  || true

