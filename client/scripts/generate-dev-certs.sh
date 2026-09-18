#!/usr/bin/env bash
# Generates a locally-trusted HTTPS certificate (via mkcert) for the Vite
# dev server, covering localhost plus this Mac's LAN IP/hostname. A secure
# context (HTTPS, or localhost) is required by the browser Camera API
# (getUserMedia), so iPhone / Rokid glasses accessing the dev server over
# the LAN need this — plain http:// will silently refuse camera access.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert が見つかりません。まずインストールしてください:"
  echo "  brew install mkcert nss"
  exit 1
fi

mkdir -p .certs

LAN_IP="${1:-}"
if [ -z "$LAN_IP" ]; then
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
fi
HOSTNAME_LOCAL=$(scutil --get LocalHostName 2>/dev/null || true)

HOSTS=(localhost 127.0.0.1 ::1)
[ -n "$LAN_IP" ] && HOSTS+=("$LAN_IP")
[ -n "$HOSTNAME_LOCAL" ] && HOSTS+=("${HOSTNAME_LOCAL}.local")

echo "対象ホスト: ${HOSTS[*]}"
echo

echo "ローカル認証局をシステム/ブラウザに信頼登録します（初回のみ。パスワードを聞かれることがあります）"
mkcert -install

echo "証明書を発行します..."
mkcert -key-file .certs/dev-key.pem -cert-file .certs/dev-cert.pem "${HOSTS[@]}"

CAROOT=$(mkcert -CAROOT)
echo
echo "============================================================"
echo "証明書を client/.certs/ に生成しました。"
echo "この後 npm run dev:client で https 起動になります。"
echo
echo "MacBook Air 以外（iPhone / Rokidグラス）で警告なしに使うには、"
echo "以下のルート証明書を各デバイスに転送し、信頼済みとして登録してください:"
echo "  $CAROOT/rootCA.pem"
echo
echo "iPhone: AirDrop等でrootCA.pemを送る → 設定 > 一般 > VPNとデバイス管理 でプロファイルをインストール"
echo "        → 設定 > 一般 > 情報 > 証明書信頼設定 で対象の証明書を完全信頼にする"
echo "Rokid (Android): 設定 > セキュリティ > 暗号化と認証情報 > CA証明書をインストール"
echo "============================================================"
