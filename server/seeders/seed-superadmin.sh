#!/bin/bash

# Get superadmin credentials from user input if not provided
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
  echo "Please provide superadmin credentials:"
  
  read -p "Username: " USERNAME
  read -s -p "Password: " PASSWORD
  echo ""
  read -p "Email: " EMAIL
else
  USERNAME=$1
  PASSWORD=$2
  EMAIL=$3
fi

# Seed superadmin user
echo "Seeding superadmin user..."
tsx server/run-seeders.ts --superadmin-username "$USERNAME" --superadmin-password "$PASSWORD" --superadmin-email "$EMAIL"