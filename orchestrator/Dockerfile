FROM node:22-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    jq \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && apt-get install -y --no-install-recommends gh && \
    rm -rf /var/lib/apt/lists/*

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code@latest

# App
WORKDIR /app

COPY package.json tsconfig.json tsconfig.server.json ./
RUN npm install --omit=dev && npm install tsx typescript

COPY orchestrator/ ./orchestrator/

# Workspace for cloned repos
RUN mkdir -p /workspace && chown node:node /workspace

ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV SCOUT_WORKSPACE="/workspace"

USER node

CMD ["npx", "tsx", "orchestrator/process-bugs.ts"]
