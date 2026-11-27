# 🍳 KusinaERP

Isang buong ERP para sa food business na may commissary at maraming branch — **mula order, produksyon, inventory, HR at payroll, hanggang accounting books.** Static website (GitHub Pages) + Firebase (Auth at Firestore). Walang server na kailangang i-maintain.

> 📖 **Kumpletong User Guide (PDF):** [`docs/KusinaERP_User_Guide.pdf`](docs/KusinaERP_User_Guide.pdf) — nandoon ang lahat ng features at kung paano gamitin ang bawat isa, step by step.

---

## ✨ Mga pangunahing features

### 🏭 Operations at Inventory
- **Order flow** — Branch → Commissary: Place Order, Fulfillment Queue, Delivery, Order Board, Branch Disputes.
- **Product Master** — SRP (presyo ng branch), Supplier Price, Puhunan, Whole/Loose na may conversion sa gramo/ml at presyo kada gramo.
- **BOM Management** — per-company recipe, may R&D ingredients, at ang bawat BOM ay puwedeng maging sangkap at product din.
- **Recipe Costing, Lot & Expiry Tracing, Spoilage Approvals, Auto-PR (Low Stock).**
- **Inventory** — Branch Inventory Count, Plant Inventory, Inventory Totals (Beg/End), SAP Item Master kada company.

### 🧾 Purchasing at Finance
- **Purchase Orders, A/P Invoices, Vendors, Daily Price Sheet, Price Lists** kada company.
- **AR Ledger** — bayad ng customers/branch, may company filter, aging at gabay.
- **📚 Accounting (Books)** — double-entry: Chart of Accounts, Journal (hindi binubura, reversal lang), Bank Reconciliation (may statement auto-match), Trial Balance / Income Statement / Balance Sheet / Cash Movement, Invoice at Statement of Account, Credit Memo / Vendor Credit, **VAT at EWT (2307 draft)**, Budget vs Actual, Recurring entries, Month-end lock, at awtomatikong pag-post mula sa AR, AP at Payroll.
- **Prime Cost Management** — weekly prime cost ng bawat branch.

### 👥 HR at Payroll
- **Employee DB** — status filter (Active/Inactive), Import/Export CSV, 201 files at dokumento.
- **Position Management** — listahan ng position, Area Manager, Employee History, at naka-link sa mga approver.
- **Attendance at Schedule**, **LST (Schedule/Manning)**, **Leave** (SIL at Vacation Leave, taunang reset, with/without pay).
- **Payroll / Payslip**, **Loan Management** (may self-apply ng empleyado na "Loan Ko").
- **HR Memo** na may view/acknowledge tracking, at **HR Documents** na may shared/private.

### 🛒 POS at BIR Report
- **POS (Counter, Tables, Events, Roster, Ideal vs Actual)** — SI number, X-read / Z-read, void, discount (Senior/PWD/iba), VAT / VAT-Exempt / Non-VAT.
- **🧾 BIR Sales Report** (POS → Sales, manager) — Daily / Monthly / Annual sa napiling petsa; Gross, Discounts (SC/PWD/iba), Void, Net Sales, VATable, VAT-Exempt, Non-VAT, VAT, may bilang ng transaksyon; listahan ng mga void at discount; **tseke ng nilaktawang SI number**; Print at CSV. Galing mismo sa benta ng POS — ito ang audit trail.

### 🎫 Tickets / Workflow (Kanban)
- Parang Jira/monday: **board na may sariling column**, uri ng ticket (hal. IT Support, IT Request) at **sariling field** — walang developer na kailangan (⚙️ Ayusin ang board).
- Drag-and-drop, assign / "Kunin ko", **SLA timer**, komento, history, List at Dashboard view, approver kada column.
- Branch ang nagre-request; IT team ang kumukuha at naglilipat (Request → Ongoing → Done).

### 💬 Messenger
- DM at group (may profile sa kaliwa ng bawat mensahe sa group), voice/video call at **share screen**, story / note na may **Archive at Insights** (views, reactions, comments), PIN lock ng chat, naka-schedule na mensahe (server tab), at **🤖 KusinaBot** (sagot mula sa documentation).

### 🛡️ Seguridad at Kontrol
- Role-based access: Admin, Accounting, HR, Branch, Commissary, at iba pa — per-module na View/Edit.
- **Menu Visibility** (Super Admin) — itago ang mga feature na hindi pa gagamitin.
- **Online / Logout Users**, **Audit Logs**, **Data Backups**, **System Health**.
- Ang Firestore rules ay nagpapatupad ng access sa server side, hindi lang sa screen.

---

## 🧱 Teknolohiya
| Bahagi | Gamit |
|---|---|
| Frontend | HTML, CSS, JavaScript (walang build step) |
| Hosting | GitHub Pages |
| Login | Firebase Authentication |
| Database | Cloud Firestore (+ `firestore.rules`) |

## 📁 Mga pangunahing file
| File | Laman |
|---|---|
| `admin.html` / `branch.html` / `commissary.html` | Mga screen ayon sa role |
| `app.js` | Pangunahing logic na shared |
| `app.js` + `app_00 … app_21_*.js` | Ang `app.js` ang naglo-load ng mga hiwalay na module (kapag may isang hindi nag-load, ang iba ay gumagana pa rin). **Lahat ng `app_NN_*.js` ay dapat nasa parehong folder ng `admin.html`.** |
| `kpos.js` (+ `pos_*.js`) | POS at BIR Sales Report |
| `messenger.js`, `help.js` | Messenger at KusinaBot (kailangan ng `help.js` ang bot) |
| `tickets.js` | Tickets / Workflow (Kanban) |
| `golive.js` | 🚀 Go-Live Reset (Admin → Truncate) |
| `setup.html` | 🛠️ Setup ng bagong Firebase / database |
| `prime.js`, `lst.js`, `loan.js`, `posn.js`, `acct.js` | Prime Cost, LST, Loan, Position, Accounting |
| `firebase-config.js` | Config ng Firebase project (**sa bawat kumpanya ay iba**) |
| `firebase.json` | Para sa opsyonal na `firebase deploy --only firestore:rules` |
| `style.css` | Disenyo |
| `firestore.rules` | Access rules ng database |

## 🚀 Pag-install / Paglipat sa bagong Firebase (madali)
Gamitin ang **`setup.html`** (buksan ito sa site mo). Ito ang gagabay sa iyo:
1. **Gumawa ng Firebase project** gamit ang email ng kumpanya/IT: i-enable ang **Authentication (Google)** at **Firestore (Production mode)**; idagdag ang domain ng GitHub Pages sa *Authorized domains*; kopyahin ang `firebaseConfig`.
2. **`setup.html` → Hakbang 2:** i-paste ang config → gagawa ito ng **`firebase-config.js`** (i-upload sa GitHub).
3. **`setup.html` → Hakbang 3:** ilagay ang email ng may-ari → gagawa ng **`firestore.rules`** na naka-set sa may-ari (i-paste sa Firebase Console → Firestore → Rules → Publish).
4. **`setup.html` → Hakbang 4:** mag-sign in bilang may-ari → **🚀 Ihanda ang Database** — gagawin nito ang unang Super Admin at ang mga kailangang settings, at susuriin ang koneksyon at rules. Ang mga collection (table) ay awtomatikong nabubuo ng Firestore sa unang save ng bawat module — hindi mo na kailangang gumawa nang manu-mano.
5. Mag-login sa `index.html`, i-add ang mga user, branch, produkto at POS Setup.

> ℹ️ Ang paggawa ng Firebase project, pag-enable ng Authentication, at pag-publish ng rules ay sa **Firebase Console** lang magagawa (isang beses). Hindi ito kayang gawin ng website.

### Bago mag-live (linisin ang test data)
**Admin → Truncate (Danger Zone) → 🚀 Go-Live Reset.** Pumili ng mga grupo (POS, Orders, Accounting, HR logs, Tickets, Messenger, Logs) → buburahin ang lahat ng test data at **babalik sa 1 ang SI number** (POS at invoice). Hindi ginagalaw ang users, produkto, BOM, vendor, customer, POS menu/setup, access control at settings. May opsyon na mag-download muna ng backup. Pagkatapos, sa bawat POS device ay i-clear ang browser data o Ctrl+F5.
Para sa isang collection lang, gamitin ang mga individual na Truncate button.

> ⚠️ Kapag may update: **unahin ang `firestore.rules`** (i-publish sa Firebase), saka i-upload ang mga file sa GitHub (hintayin ang deploy ng ~1–2 min), tapos Ctrl+F5. Kapag may pulang banner na "May file na hindi na-load", ibig sabihin kulang ang mga `app_NN_*.js` sa folder.

## 📖 Paano gamitin
Basahin ang **User Guide (PDF)** sa `docs/`. Mayroon itong table of contents, mga hakbang bawat role, comparison ng mga module, at troubleshooting.

---
© KusinaERP. Para sa internal na gamit ng kumpanya.
