#!/bin/bash

# Seed admin roles without superadmin user
echo "Seeding admin roles..."
tsx server/run-seeders.ts