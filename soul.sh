#!/bin/sh
# Generate new soul id

echo "Here is the new Soul ID:"
echo "SOUL_ID=$(bunx ulid)"
echo "Update the SOUL_ID in .env file with the new Soul ID."
