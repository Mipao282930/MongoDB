#!/bin/bash
set -eu

mongosh "$MONGO_INITDB_DATABASE" --quiet --eval \
  "db.createUser({ user: '${APP_USERNAME}', pwd: '${APP_PASSWORD}', roles: [{ role: 'readWrite', db: 'control_ventas' }] })"
