# Minimal container for the Decap CMS GitHub OAuth provider.
# Build:  docker build -t slow-dough-oauth-provider .
# Run:    docker run -p 8080:8080 \
#           -e OAUTH_GITHUB_CLIENT_ID=xxx \
#           -e OAUTH_GITHUB_CLIENT_SECRET=yyy \
#           slow-dough-oauth-provider
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
