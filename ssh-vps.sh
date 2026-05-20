#!/bin/bash
# Open SSH session to VPS via Cloudflare Access.
# Usage: ./ssh-vps.sh   (or: ./ssh-vps.sh "some command")
# Requires: cloudflared installed and logged in for access.

SSH_HOST="${SSH_HOST:-ssh.bfcpos.com}"
SSH_USER="${SSH_USER:-admin93}"

if [ -n "$1" ]; then
  exec ssh -o ProxyCommand="cloudflared access ssh --hostname %h" "${SSH_USER}@${SSH_HOST}" "$@"
else
  exec ssh -o ProxyCommand="cloudflared access ssh --hostname %h" "${SSH_USER}@${SSH_HOST}"
fi
