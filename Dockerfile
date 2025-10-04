###########
# BUILDER - React Frontend #
###########
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files for better caching
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY frontend/ .

# Build the React app
RUN npm run build

###########
# BUILDER - Python Backend #
###########
FROM python:3.11-slim AS backend-builder

# set work directory
WORKDIR /usr/src/app

# set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# install python dependencies for building
RUN pip install --upgrade pip
RUN pip install wheel

# copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /usr/src/app/wheels -r requirements.txt

#########
# FINAL - Combined App #
#########
FROM python:3.11-slim

# create directory for the app user
RUN mkdir -p /home/app

# create the app user
RUN groupadd --system app && useradd --system --group app --uid 1000 app

# create the appropriate directories
ENV HOME=/home/app
ENV APP_HOME=/home/app/web
RUN mkdir -p $APP_HOME
RUN mkdir -p $APP_HOME/staticfiles
RUN mkdir -p $APP_HOME/media

WORKDIR $APP_HOME

# install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# install python dependencies
COPY --from=backend-builder /usr/src/app/wheels /wheels
COPY --from=backend-builder /usr/src/app/requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache /wheels/*

# copy Django project
COPY backend/ $APP_HOME

# copy built React app to Django static files
COPY --from=frontend-builder /app/frontend/build/* $APP_HOME/staticfiles/

# create entrypoint script
RUN echo '#!/bin/bash\n\
if [ "$DATABASE" = "postgres" ]; then\n\
    echo "Waiting for postgres..."\n\
    while ! nc -z $SQL_HOST $SQL_PORT; do\n\
        sleep 0.1\n\
    done\n\
    echo "PostgreSQL started"\n\
fi\n\
python manage.py migrate --noinput\n\
python manage.py collectstatic --noinput --clear\n\
exec "$@"' > /home/app/web/entrypoint.sh

RUN chmod +x /home/app/web/entrypoint.sh

# chown all the files to the app user
RUN chown -R app:app $APP_HOME

# change to the app user
USER app

# expose port
EXPOSE 8000

# run entrypoint script
ENTRYPOINT ["/home/app/web/entrypoint.sh"]

# run gunicorn
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "2"]
