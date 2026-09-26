#!/bin/sh
set -e

mkdir -p "${MEDIA_ROOT:-media}"

python manage.py migrate --noinput
if [ "$RUN_SEED_ON_START" = "True" ]; then
  python manage.py seed
fi
gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}
