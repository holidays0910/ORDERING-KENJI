# KusinaERP Enterprise System (2026 Edition)
**Centralized Multi-Outlet Restaurant & Commissary Management Platform**  
*Programmed by: Renz Aldrin Gomez*

---

## 📌 Tungkol sa System
Ang **KusinaERP** ay isang modernong cloud-enabled Enterprise Resource Planning (ERP) platform na dinisenyo para sa multi-branch restaurant operations, central commissary, supply chain logistics, at accounting management. Gumagana ito gamit ang **Firebase Authentication** at **Cloud Firestore** para sa real-time synchronization.

---

## 🚀 Mga Pangunahing Features at Modules

### 1. 👥 Human Resources & Kenji Tei Salary Slip System
* **HR Masterlist (Employee DB):** Kumpletong 201 file records (Personal data, statutory numbers: SSS, PhilHealth, Pag-IBIG, TIN, at BDO payroll account).
* **Kenji Tei Official Salary Slip Standard:**
  * Kopyang-kopya ang opisyal na corporate salary slip layout (Earnings vs Deductions dual-column table).
  * Kasama ang live breakdown ng Basic, Allowance, Deminimis, SL Refund, Leave w/ Pay, Regular OT (1.25x), Special/Legal Holiday, at Night Differential.
  * Kasama ang kaltas sa Restday/Absences, Tardiness/Undertime (minutes conversion), Statutory contributions, Loans, Cash Advance, at HMO.
  * Summary ng Cash Advance (No. of Pay, Amount, Balance).
  * Awtomatikong **Amount in Words** generator para sa Net Pay.
* **Accounting Financial Safety (2-Step Payroll Approval):**
  * **Draft / Generated:** Hindi kailanman magbabawas sa Cash on Hand sa pag-generate pa lamang ng payslip para maiwasan ang financial discrepancies.
  * **Release Payout:** Sa sandaling pormal nang ibigay ang pera o ma-credit sa bangko, saka pa lamang ibabawas ang Net Pay sa Cash on Hand / Bank Account sa General Ledger.
* **Printable / Downloadable:** Isang click lang para ma-preview at ma-print bilang malinis na physical slip o PDF.

---

### 2. 📝 Vendor Purchase Orders & Accounts Payable (APDP Pipeline)
* **Purchase Order Creator:** Lumilikha ng detalyadong PO na naka-link sa mga produkto ng bawat opisyal na supplier.
* **Signatory Controls (System Branding Setup):**
  * **Prepared By:** Awtomatikong nakapangalan sa mismong Purchasing Officer o Admin na gumawa ng PO.
  * **Verified & Checked By:** Awtomatikong ipinapasok ang nakatakdang pangalan at posisyon ng Supply Chain / Commissary Head mula sa Branding.
  * **Approved By:** Awtomatikong nakatatak ang pangalan at posisyon ng COO o Presidente mula sa Branding.
* **Smooth Receiving Screen (Zero Input Lag):**
  * Inayos ang live counting input—hindi nagre-refresh ang buong listahan kaya hindi nawawala ang focus ng cursor at keyboard sa cellphone o computer habang nagta-type ng actual count.
* **Full Accounts Payable & Check Processing Pipeline:**
  1. `Received / AP Pending`: Na-receive na sa bodega/planta at may pinal na Billed Amount batay sa actual count.
  2. `For Check Preparation (APDP)`: Ginagawan na ng voucher at tseke ng Accounting.
  3. `For Check Signing (COO/President)`: Nakasalang na para sa pirma ng ehekutibo.
  4. `For Deposit / Release`: Handa nang ideposito o ibigay sa vendor.
  5. `Paid & Closed`: Nabayaran na nang buo (awtomatikong nagtatala ng Credit Expense sa General Ledger).

---

### 3. 📦 Maramihang Pag-upload (Bulk CSV Import & Export)
* **Bulk Import:** May handang **"Blank Template (.CSV)"** para sa maramihang upload (130+ items/records) nang sabay-sabay upang maiwasan ang mano-manong pag-input:
  * Employee HR Masterlist (.CSV)
  * Vendor / Supplier Directory (.CSV)
  * Customer & Outlet Directory (.CSV)
  * Product Masterlist & Live Pricing Editor (.CSV)
* **Full Data Export:** Madaling i-extract ang buong talaan bilang CSV para sa backup o Excel reporting.

---

### 4. 🎂 Animated Birthday Celebrants Pop-Up (Per-Account Basis)
* **Real-time Birthday Detection:** Sinusuri ang buwan at araw ng kapanganakan ng lahat ng empleyado batay sa petsa ngayon.
* **Per-Account First Login:** Lilitaw sa unang login ng bawat account sa araw na iyon. Kahit magkasalo sa iisang computer ang mga staff, lilitaw pa rin ito sa account ng susunod na magla-log in.
* **Kailanman Hindi Mauuna:** Kung bukas pa ang kaarawan, bukas pa ito lilitaw; kapag natapos na ang araw, kusa itong hihinto sa pag-pop up.
* **Buhay na Animations:** May kasamang CSS floating balloons, confetti, shimmering gold banner, edad, at tenure (tagal sa kumpanya).

---

### 5. 💾 Database Backup, Restore & Automated Scheduler
* **Client-Side JSON Snapshot:** Walang dagdag na bayad sa Firebase Storage dahil direktang ida-download ang buong database snapshot (.JSON) sa computer ng Admin.
* **One-Click Database Restore:** Kakayahang ibalik ang buong database mula sa na-download na JSON backup sakaling magkaroon ng emergency o aksidenteng pagbura.
* **Notification Scheduler:** Maaaring itakda ni Admin kung tuwing kailan magpapaalala ang system (Every 7, 15, o 30 days) upang mag-backup.

---

### 6. 📢 Company Memos & e-Acknowledgment System
* **Auto-Popup Upon Login:** Ang bagong memorandum mula kay HR o Management ay awtomatikong magpa-pop up sa dashboard ng mga sakop na user.
* **Acknowledge & Received Tracking:** May opisyal na acknowledgment receipt kung saan itinatala ang pangalan ng nagbasa at timestamp bilang legal proof of receipt.
* **Printable / Downloadable Memo:** May built-in format para ma-print sa bond paper o ma-download ang kalakip na memo circular file/litrato.

---

### 7. 🕵️ Universal System Audit Trail & Security Logs
Bawat galaw at transaksyon sa system ay may timestamped record na makikita sa **Universal System Audit Logs**:
* Pag-print ng PO at Resibo (`VENDOR_PO_PRINTED`, `PICKING_SLIP_PRINTED`)
* Pag-export at pag-download ng CSV records (`ORDER_CSV_DOWNLOADED`, `EMPLOYEES_EXPORTED`, atbp.)
* Paggawa, pag-preview, at pag-release ng Salary Slip (`PAYROLL_FORM_OPENED`, `PAYROLL_GENERATED`, `PAYROLL_PAYOUT_RELEASED`)
* Pag-receive, pagbawas, at pag-adjust ng imbentaryo at status changes.

---

## 🛠️ Tech Stack & Requirements
* **Frontend:** HTML5, CSS3 (Modern Flexbox/Grid), Vanilla JavaScript (ES6+)
* **Backend & Database:** Firebase Auth, Google Cloud Firestore
* **Libraries:** Chart.js (Analytics), Html5-QRCode (Barcode Camera Scanner), JsBarcode (Barcode Generator)
* **Supported Devices:** Desktop Browsers, Tablets, Android & iOS Mobile Devices (PWA Ready)

---
*KusinaERP © 2026. All Rights Reserved.*
