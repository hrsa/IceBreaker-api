FROM --platform=linux/amd64 node:24.0-alpine AS base

ARG UID
ARG GID
ARG USER

ENV UID=${UID}
ENV GID=${GID}
ENV USER=${USER}

WORKDIR /app

RUN apk add --no-cache python3 make g++ curl
RUN npm i -g @nestjs/cli


FROM base AS dev
WORKDIR /app
CMD ["npm", "run", "start:debug"]


FROM base AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build


FROM node:24-alpine AS prod
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production
COPY --from=build /app/dist ./dist

RUN mkdir -p logs storage

RUN addgroup --gid ${GID} --system ${USER} \
    && adduser --system --home /home/${USER} --shell /bin/sh --uid ${UID} --ingroup ${USER} ${USER} \
    && chown -R ${UID}:${GID} /app \
    && chmod 755 -R /app

USER ${USER}

CMD ["npm", "run", "start:prod"]
