#!/bin/bash
source ~/.zshrc 2>/dev/null
CACHE_DIR="$(dirname "$0")/cache"
mkdir -p "$CACHE_DIR"

# CRM data
gog -a chuck@coreconx.group sheets get 1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak "Companies!A1:Z100" -j > "$CACHE_DIR/crm-companies.json" 2>/dev/null
gog -a chuck@coreconx.group sheets get 1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak "Contacts!A1:Z100" -j > "$CACHE_DIR/crm-contacts.json" 2>/dev/null

# Emails
gog -a chuck@coreconx.group gmail search "is:unread" --max 20 -j > "$CACHE_DIR/emails-unread.json" 2>/dev/null

echo "Cache refreshed at $(date)"
