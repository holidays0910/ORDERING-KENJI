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
| `prime.js`, `lst.js`, `loan.js`, `posn.js`, `acct.js` | Prime Cost, LST, Loan, Position, Accounting |
| `style.css` | Disenyo |
| `firestore.rules` | Access rules ng database |

## 🚀 Pag-install (maikli)
1. Gumawa ng Firebase project; i-enable ang **Authentication (Email/Password)** at **Firestore**.
2. Ilagay ang config mo sa `firebase-config.js`.
3. I-publish ang laman ng `firestore.rules` sa Firebase.
4. Gumawa ng unang admin account sa Firebase Console (`users/{email}` na may role `admin` at status `active`).
5. I-upload ang mga file sa GitHub at i-enable ang **GitHub Pages**.

> ⚠️ Kapag may update: **unahin ang `firestore.rules`**, saka i-upload ang mga file sa GitHub, tapos Ctrl+F5 sa browser.

## 📖 Paano gamitin
Basahin ang **User Guide (PDF)** sa `docs/`. Mayroon itong table of contents, mga hakbang bawat role, comparison ng mga module, at troubleshooting.

---
© KusinaERP. Para sa internal na gamit ng kumpanya.
