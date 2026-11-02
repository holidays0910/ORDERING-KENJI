# KusinaERP Enterprise System (2026 Edition)
**Centralized Multi-Outlet Restaurant & Commissary Management Platform**  
*Programmed by: Renz Aldrin Gomez*

---

## 📌 Tungkol sa System
Ang **KusinaERP** ay isang modernong cloud-enabled Enterprise Resource Planning (ERP) platform na dinisenyo para sa multi-branch restaurant operations, central commissary, supply chain logistics, at accounting management. Gumagana ito gamit ang **Firebase Authentication** at **Cloud Firestore** para sa real-time synchronization.

---

## 🚀 Mga Pangunahing Features at Modules

### 1. 🏭 Manufacturing, Costing & Inventory
* **Manufacturing & Bill of Materials (BOM):** Recipe builder para sa pag-convert ng Raw Materials (hal. Harina, Baboy) papunta sa Finished Goods (hal. Ramen, Siomai Wrapper). Awtomatikong nagbabawas sa inventory ng raw materials tuwing may Production Work Order.
* **Live Recipe Costing (COGS):** Awtomatikong nagko-compute ng Cost of Goods Sold (puhunan) base sa pinakabagong presyo ng raw materials mula sa huling na-receive na supplier invoice.
* **Lot Tracing & FEFO (First Expire, First Out):** Sinusubaybayan ang Expiration Dates ng mga raw materials upang maiwasan ang spoilage at mauna itong gamitin sa production.
* **Automated Purchase Requests (Auto-PR):** Kusa nang gagawa ng draft PR ang system para sa mga produktong bumagsak na sa itinakdang Buffer Limit.

### 2. 👥 Human Resources & Kenji Tei Salary Slip System
* **HR Masterlist (Employee DB):** Kumpletong 201 file records kasama ang SSS, PhilHealth, Pag-IBIG, TIN, at BDO payroll account.
* **Kenji Tei Official Salary Slip Standard:**
  * Kopyang-kopya ang opisyal na corporate salary slip layout (Earnings vs Deductions dual-column table).
  * **Night Differential (10PM-6AM):** Awtomatikong 10% premium computation base sa daily/hourly rate ng empleyado.
  * Live breakdown ng Basic, Allowance, Deminimis, SL Refund, Leave w/ Pay, Regular OT (1.25x), Special/Legal Holiday, at Night Differential.
  * Mga kaltas: Restday/Absences, Tardiness/Undertime (minutes conversion), Statutory contributions, Loans, Cash Advance, at HMO.
  * Summary ng Cash Advance at automated **Amount in Words** generator para sa Net Pay.
* **Accounting Financial Safety (2-Step Payroll Approval):**
  * Nagse-save bilang "Draft" upang hindi magulo ang Cash on Hand sa pag-generate pa lamang.
  * Pinipindot ang "Release Payout" kung kailan opisyal na ibabawas ang Net Pay sa General Ledger.

### 3. 📝 Vendor Purchase Orders & Accounts Payable (APDP Pipeline)
* **Purchase Order Creator:** Lumilikha ng detalyadong PO na naka-link sa mga supplier at uom rates.
* **Signatory Controls (System Branding Setup):**
  * Auto-tagging ng mga pangalan para sa: *Prepared By*, *Verified & Checked By (Supply Chain Head)*, at *Approved By (COO/President)*.
* **Smooth Receiving Screen (Zero Input Lag):** Inayos ang real-time inventory count UI upang hindi mawala ang cursor habang nag-e-encode ng actual delivery ng truck.
* **5-Stage Accounts Payable Pipeline:**
  1. `Received / AP Pending`
  2. `For Check Preparation (APDP)`
  3. `For Check Signing (COO/President)`
  4. `For Deposit / Release`
  5. `Paid & Closed` (Dito pa lamang mag-re-record ng opisyal na Credit Expense).

### 4. 🚚 Order Fulfillment & Logistics
* **Station-by-Station Picking Guide:** Maaaring i-print ang Order Slip ng branch nang nakagrupo ang mga item batay sa Storage Station sa bodega (hal. Cold Storage, Dry Warehouse) upang mapabilis ang pag-prepare ng Stockman.
* **7-Day Late Return Dispute:** Kung nakumpleto na ang delivery ngunit may nadiskubreng panis o butas makalipas ang ilang araw (basta't hindi lalagpas ng 7 araw), maaari itong i-report ng branch kasama ang photo evidence para magawan ng Credit Memo ni Admin.

### 5. ⚙️ Asset & Equipment Maintenance
* Talaan ng mga makinarya at sasakyan (hal. Noodle Machine, Delivery Truck).
* Preventive maintenance schedules para maiwasan ang biglaang pagkasira sa gitna ng operasyon.

### 6. 📦 Maramihang Pag-upload (Bulk CSV Import & Export)
* **Bulk Import:** May handang "Blank Template (.CSV)" para sa maramihang upload (130+ items/records) nang sabay-sabay para sa Employees, Vendors, Customers, at Products.
* **Full Data Export:** Madaling i-extract ang buong talaan bilang CSV para sa backup o Excel reporting.

### 7. 🎂 Animated Birthday Celebrants Pop-Up (Per-Account Basis)
* Real-time na sinusuri ang kaarawan ng mga empleyado. Lilitaw ang animated popup (with CSS balloons at confetti) sa mismong araw ng kaarawan sa *unang login* ng bawat user account. Ipinapakita rin dito ang edad at "Tenure" (tagal sa kumpanya) ng celebrant.

### 8. 💾 Database Backup, Restore & Rollback Engine
* **Client-Side JSON / CSV Snapshots:** Libreng backup methodology kung saan diretsong nagda-download ng records ang browser.
* **One-Click Rollback:** Kakayahang ibalik (restore) ang buong database state ng Product Masterlist bago nagkaroon ng maling CSV upload.

### 9. 🕵️ Universal System Audit Trail & Security Logs
Bawat galaw at transaksyon sa system ay may timestamped record na makikita sa **Universal System Audit Logs**:
* Pag-print ng PO at Picking Slips (`VENDOR_PO_PRINTED`, `PICKING_SLIP_PRINTED`)
* Pag-export at pag-download ng CSV records (`ORDER_CSV_DOWNLOADED`, `EMPLOYEES_EXPORTED`)
* Paggawa at pag-release ng Salary Slip (`PAYROLL_FORM_OPENED`, `PAYROLL_GENERATED`, `PAYROLL_PAYOUT_RELEASED`)
* Pag-receive, pag-dispute, at pagbawas sa imbentaryo.

---
*KusinaERP © 2026. All Rights Reserved.*
