#!/bin/sh
# Entrypoint script for Dunya
# SPDX-License-Identifier: BSD-3-Clause (https://ncurl.xyz/s/mI23sevHR)

# Exit immediately if a command exits with a non-zero status
set -e

# Run database migrations
bun run db:migrate

# Start the application
exec bun run start
