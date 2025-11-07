FROM nginx:1.29.3 AS base

ARG UID
ARG GID
ARG USER

ENV UID=${UID}
ENV GID=${GID}
ENV USER=${USER}

RUN groupadd --system --gid ${GID} ${USER}
RUN useradd --system --gid ${USER} --home /home/${USER} --shell /bin/sh --uid ${UID} ${USER}

RUN sed -i "s/user nginx/user '${USER}'/g" /etc/nginx/nginx.conf

RUN rm /etc/nginx/conf.d/default.conf

FROM base AS copy
COPY frontend/dist/ /usr/share/nginx/html/

FROM copy AS prod
COPY docker/nginx-prod.conf /etc/nginx/conf.d/default.conf

FROM copy AS no-ssl
COPY docker/nginx-no-ssl.conf /etc/nginx/conf.d/default.conf
