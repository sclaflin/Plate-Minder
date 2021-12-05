FROM ubuntu:18.04

LABEL description="Connects an RTSP feed to OpenALPR and records captured data"
LABEL maintainer "seanclaflin@protonmail.com"

ENV SHELL /bin/bash

# Install some binaries
RUN apt update \
    && apt upgrade -y \
    && apt install -y wget gpg apt-transport-https sqlite \
    && rm -rf /var/lib/apt/lists/*

# Set up nodesource repo & install nodejs
RUN KEYRING=/usr/share/keyrings/nodesource.gpg \
    && VERSION=node_16.x \
    && DISTRO=bionic \
    && wget --quiet -O - https://deb.nodesource.com/gpgkey/nodesource.gpg.key | gpg --dearmor | tee "$KEYRING" >/dev/null \
    && echo "deb [signed-by=$KEYRING] https://deb.nodesource.com/$VERSION $DISTRO main" | tee /etc/apt/sources.list.d/nodesource.list \
    && echo "deb-src [signed-by=$KEYRING] https://deb.nodesource.com/$VERSION $DISTRO main" | tee -a /etc/apt/sources.list.d/nodesource.list \
    && apt update \
    && apt install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create the application user
RUN useradd -m app

# Run as the new user
USER app

# Copy application files over
COPY index.js /app/
COPY package*.json /app/
COPY lib /app/lib
COPY data/placeholder /app/data/placeholder
COPY migrations /app/migrations
COPY ffmpeg /app/ffmpeg
COPY node_modules /app/node_modules

WORKDIR /app

CMD ["/usr/bin/npm", "start"]