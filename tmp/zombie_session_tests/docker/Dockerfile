FROM node:25-slim

# iptables is needed to create the packet black hole
RUN apt-get update && \
    apt-get install -y --no-install-recommends iptables && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy certs and script
COPY certs/ certs/
COPY reproduce_zombie_http2.js .

# Default: observe mode. Pass --crash to trigger the assertion failure.
ENTRYPOINT ["node", "reproduce_zombie_http2.js"]
