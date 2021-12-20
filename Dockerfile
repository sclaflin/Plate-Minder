FROM ubuntu:20.04

LABEL description="Connects an RTSP feed to OpenALPR and records captured data"
LABEL maintainer "seanclaflin@protonmail.com"

ENV SHELL /bin/bash

# Install some binaries
RUN apt update \
    && apt upgrade -y \
    && DEBIAN_FRONTEND="noninteractive" \
        apt install -y \
        wget \
        gpg \
        apt-transport-https \
        sqlite \
        lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Set up nodesource repo & install nodejs
RUN KEYRING=/usr/share/keyrings/nodesource.gpg \
    && VERSION=node_16.x \
    && DISTRO="$(lsb_release -s -c)" \
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
COPY --chown=app:app index.js /app/
COPY --chown=app:app package*.json /app/
COPY --chown=app:app lib /app/lib
COPY --chown=app:app data/placeholder /app/data/placeholder
COPY --chown=app:app migrations /app/migrations

WORKDIR /app

RUN npm ci

CMD ["/usr/bin/npm", "start"]