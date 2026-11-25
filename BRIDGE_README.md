# 🌉 Kusina Bridge — setup (Post 1, Windows / Ubuntu)

## Ano ito
Maliit na program (`kusina-bridge.js`) na tumatakbo sa **Post 1 (main)**. Walang `npm install`; kailangan lang ng **Node.js 18+**.
- 📲 Post 2, 3… (iPad/phone) ay nagbubukas ng `http://<IP-ng-Post-1>:8787/waiter` at nakakapag-order **kahit walang internet**.
- 🖨️ Nagpi-print sa Star TSP143III / BSC10 / Epson TM-T… sa **static IP**, port 9100, kahit offline.
- 🔧 Admin page `http://localhost:8787/admin`: nakikita ang mga IP sa LAN → itakda kung **Post 1 (Main)** o **Post 2+**; ilagay ang IP ng mga printer.
- ☁️ Ang Post 1 (browser) ang nagsi-sync sa Firebase pagbalik ng internet (offline persistence). Ang Bridge ay hindi nagbubukas ng cloud.

## Mga file (ilagay sa isang folder sa Post 1)
`kusina-bridge.js`, `bridge-pages.js`, `print-agent.js`

## Unang takbo
**Windows:** i-install ang Node.js LTS, buksan ang Command Prompt sa folder, `node kusina-bridge.js`
**Ubuntu:** `sudo apt install nodejs` (v18+; kung luma: gamitin ang NodeSource), `node kusina-bridge.js`
Sa unang takbo ipapakita ang **ADMIN PASSWORD** (isang beses lang) at ang **KEY** ng Post 1. Itala.

## Laging tumatakbo
- Windows: gumawa ng Task Scheduler task "At log on" → `node C:\kusina\kusina-bridge.js`. (o `npm i -g pm2 && pm2 start kusina-bridge.js && pm2 save`)
- Ubuntu: `sudo npm i -g pm2 && pm2 start kusina-bridge.js && pm2 save && pm2 startup`
- Firewall: payagan ang port **8787** (Private/LAN lang). **Huwag i-port-forward.**

## Router
Bigyan ng **static IP / DHCP reservation**: Post 1, bawat iPad, at bawat printer. (Printer: i-print ang self-test sheet para makita/itakda ang IP.)

## POS (Post 1)
1. Idagdag sa `firebase-config.js` (pagkatapos ng `window.db = firebase.firestore();`):
   `db.enablePersistence({ synchronizeTabs: true }).catch(() => {});`
2. POS → pindutin ang chip sa ibabang-kaliwa (🌐 Online) o Setup → 🌉 Bridge: URL `http://localhost:8787`, ilagay ang **key**.
3. Sa Admin page: itakda ang IP ng Post 1 bilang **Post 1 (Main)**, ang mga iPad bilang Post 2, 3…; idagdag ang mga printer (susi, IP, port).
4. Sa POS Stations (Setup), ilagay ang parehong IP ng printer sa bawat station.

## Mga limitasyon (v1)
- Para sa pag-order at pag-print ang LAN. Ang pagbayad/settle ay sa Post 1 lang (isang main lang ang naglalabas ng OR).
- Kailangang **bukas ang POS sa Post 1** (naka-login, bukas ang shift) para tanggapin ang order mula sa waiter-lite.
- Ang waiter-lite ay gumagamit ng snapshot ng menu/table na ipinapadala ng Post 1 bawat 60 segundo.
- Bawal mag-edit ng menu habang offline (iwas banggaan ng code).
- Ang Star printers ay gumagana sa ESC/POS (Star Line Mode ay hindi); kung Star ang gamit at walang lumalabas, i-set ang printer emulation sa **ESC/POS**.
