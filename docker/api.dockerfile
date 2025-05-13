FROM node:24.0-alpine AS dev

WORKDIR /app
RUN apk add --no-cache curl nano

CMD ["npm", "run", "start:debug"]


FROM node:24-alpine AS prod
ARG UID
ARG GID
ARG USER
ARG GROUP=docker

ENV UID=${UID}
ENV GID=${GID}
ENV USER=${USER}
ENV GROUP=${GROUP}

WORKDIR /app
RUN apk add --no-cache curl nano


COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/

RUN mkdir -p logs storage

RUN addgroup -g ${GID} -S ${GROUP}
RUN adduser -u ${UID} -S -G ${GROUP} -h /home/${USER} -s /bin/sh ${USER}
RUN chown -R ${USER}:${GROUP} /app && chmod 755 -R /app



USER ${USER}

CMD ["node", "dist/main"]
