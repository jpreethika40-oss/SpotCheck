#!/bin/bash
set -e
service postgresql start
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" || true
sudo -u postgres psql -c "CREATE USER spotcheck WITH PASSWORD 'spotcheck' SUPERUSER;" || true
sudo -u postgres psql -c "CREATE DATABASE spotcheck OWNER spotcheck;" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE spotcheck TO spotcheck;" || true

# Allow connections
HBA=$(find /etc/postgresql -name pg_hba.conf | head -n 1)
CONF=$(find /etc/postgresql -name postgresql.conf | head -n 1)

echo "host all all 127.0.0.1/32 trust" >> "$HBA"
echo "host all all 0.0.0.0/0 trust" >> "$HBA"
echo "listen_addresses = '*'" >> "$CONF"

service postgresql restart
echo "POSTGRES_READY_SUCCESS"
