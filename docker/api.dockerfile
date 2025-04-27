FROM python:3.12.9 AS base

ARG UID
ARG GID
ARG USER

ENV UID=${UID}
ENV GID=${GID}
ENV USER=${USER}

WORKDIR /app

RUN apt-get update && apt-get install -y \
  tesseract-ocr \
  libtesseract-dev \
  poppler-utils \
  antiword \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

FROM base AS dev
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS prod
COPY alembic alembic
COPY app app
COPY tests tests
COPY alembic.ini .
COPY pytest.ini .
COPY .env .
RUN mkdir storage
RUN mkdir logs

RUN addgroup --gid ${GID} --system ${USER} \
    && adduser --system --home /home/${USER} --shell /bin/sh --uid ${UID} --ingroup ${USER} ${USER} \
    && chown -R ${UID}:${GID} /app \
    && chmod 777 -R /app
USER ${USER}
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
