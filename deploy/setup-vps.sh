#!/usr/bin/env bash
#
# One-shot setup for a fresh Ubuntu/Debian VPS (Hostinger KVM, Oracle Always
# Free, DigitalOcean, anything).
#
#   curl -fsSL https://raw.githubusercontent.com/akthernaimudheen/rejifash/main/deploy/setup-vps.sh -o setup.sh
#   sudo bash setup.sh shop.yourdomain.com
#
# Point an A record at this server's IP BEFORE running, or the TLS step fails.

set -euo pipefail

DOMAIN="${1:-}"
REPO="https://github.com/akthernaimudheen/rejifash.git"
APP_DIR="/opt/rejifash"
DATA_DIR="/var/lib/rejifash"
ENV_FILE="/etc/rejifash.env"

if [[ -z "$DOMAIN" ]]; then
  echo "usage: sudo bash setup-vps.sh shop.yourdomain.com" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "run with sudo" >&2
  exit 1
fi

say() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }

say "Installing node, nginx, git, certbot"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git nginx

# NodeSource: Debian's own node package is usually too old.
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt 18 ]]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs
fi
echo "node $(node -v)"

say "Creating service user and directories"
id -u rejifash >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin rejifash
install -d -o rejifash -g rejifash -m 0750 "$DATA_DIR"

say "Fetching the application"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --quiet origin main
  git -C "$APP_DIR" reset --hard --quiet origin/main
else
  rm -rf "$APP_DIR"
  git clone --quiet --depth 1 "$REPO" "$APP_DIR"
fi
chown -R rejifash:rejifash "$APP_DIR"

# Secrets live here, root-readable only — never in the repo.
if [[ ! -f "$ENV_FILE" ]]; then
  say "Generating $ENV_FILE"
  ADMIN_PW="$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | cut -c1-16)"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=4173
PUBLIC_URL=https://$DOMAIN

# CHANGE THIS to your real UPI ID before taking orders. Customers pay whatever
# address is here. Leave blank and checkout falls back to WhatsApp.
UPI_VPA=
UPI_PAYEE_NAME=Reji Fashions

ADMIN_USERNAME=admin
ADMIN_PASSWORD=$ADMIN_PW

WHATSAPP_NUMBER=919074666413
WHATSAPP_PROVIDER=link
CALLMEBOT_API_KEY=
EOF
  chmod 600 "$ENV_FILE"
  GENERATED_PW="$ADMIN_PW"
else
  echo "$ENV_FILE already exists — leaving it alone"
fi

say "Installing the systemd service"
cp "$APP_DIR/deploy/rejifash.service" /etc/systemd/system/rejifash.service
systemctl daemon-reload
systemctl enable --quiet rejifash
systemctl restart rejifash
sleep 2
systemctl is-active --quiet rejifash || { journalctl -u rejifash -n 30 --no-pager; exit 1; }

say "Configuring nginx for $DOMAIN"
sed "s/shop\.yourdomain\.com/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" \
  > /etc/nginx/sites-available/rejifash
ln -sf /etc/nginx/sites-available/rejifash /etc/nginx/sites-enabled/rejifash
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

say "Requesting a TLS certificate"
apt-get install -y -qq certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
        --register-unsafely-without-email --redirect \
  || echo "certbot failed — check the A record points here, then rerun: sudo certbot --nginx -d $DOMAIN"

say "Done"
echo "  Storefront   https://$DOMAIN/"
echo "  Admin        https://$DOMAIN/admin"
echo "  Data         $DATA_DIR   (survives restarts and redeploys)"
if [[ -n "${GENERATED_PW:-}" ]]; then
  echo
  echo "  Admin password: $GENERATED_PW"
  echo "  Written to $ENV_FILE — change it in the dashboard after signing in."
fi
echo
echo "  Update later:  cd $APP_DIR && sudo git pull && sudo systemctl restart rejifash"
echo "  Logs:          sudo journalctl -u rejifash -f"
