/* =====================================================================
   KusinaERP — app.js (LOADER)
   Ang dating isang malaking app.js ay hinati sa mga hiwalay na module (app_NN_*.js).
   Ang loader na ito ang nagkakarga sa kanila nang sunod-sunod (mahalaga ang pagkakasunod).
   Kapag may isang module na nag-error, ang iba ay tuloy pa rin sa pag-load.
   Kapag nagdagdag ng module: idagdag lang sa listahan sa ibaba.
   ===================================================================== */
/* Offline persistence ng Firestore: ang mga nabasa na dati ay agad lumalabas mula sa cache ng device (mas mabilis ang pagbukas ng chat/menu at gumagana pa rin kahit mahina ang internet). Dapat tawagin bago ang anumang ibang Firestore call. */
try { if (window.db && !window.__fsPersist && typeof window.db.enablePersistence === 'function') { window.__fsPersist = 1; window.db.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } } catch (e) {}
(function () {
  var BUILD = 'b1';
  var cs = document.currentScript, q = '';
  try { q = (cs && cs.src.indexOf('?') > -1 ? cs.src.split('?')[1].split('&')[0].replace(/^v=/, '') : ''); } catch (e) {}
  var V = encodeURIComponent((q ? q + '-' : '') + BUILD);
  var MODS = ["app_00_core.js", "app_01_dash_products.js", "app_02_stock_orders.js", "app_03_pricing_forms.js", "app_04_admin_nav.js", "app_05_branding.js", "app_06_order_detail.js", "app_07_cancel_returns.js", "app_08_spoilage.js", "app_09_receiving.js", "app_10_words_pdf.js", "app_11_finance.js", "app_12_vendors.js", "app_13_bom.js", "app_14_autopr.js", "app_15_csv_import.js", "app_16_inv_admin.js", "app_17_costing.js", "app_18_ar_ledger.js", "app_19_attendance.js", "app_20_notify.js", "app_21_security.js"];
  window.__kMods = { list: MODS.slice(), failed: [], loaded: [] };
  window.__kModFail = function (n) { window.__kMods.failed.push(n); try { console.error('[ERP] Hindi na-load ang module: ' + n); } catch (e) {} };
  window.__kModOk = function (n) { window.__kMods.loaded.push(n); };
  /* Preload: sabay-sabay na dina-download ang lahat ng module habang sunod-sunod pa rin silang pinapatakbo (mas mabilis kaysa isa-isang download). Hint lang ito — hindi nagbabago ang pagkakasunod ng execution. */
  MODS.forEach(function (m) { document.write('<link rel="preload" as="script" href="' + m + '?v=' + V + '">'); });
  MODS.forEach(function (m) {
    document.write('<script src="' + m + '?v=' + V + '" onerror="__kModFail(\'' + m + '\')" onload="__kModOk(\'' + m + '\')"><\/script>');
  });
  document.write('<script>(function(){var f=window.__kMods.failed;if(f.length){window.addEventListener("load",function(){var d=document.createElement("div");d.style.cssText="position:fixed;left:0;right:0;top:0;z-index:99999;background:#dc2626;color:#fff;padding:.5rem 1rem;font:14px sans-serif";d.textContent="\u26a0\ufe0f May file na hindi na-load: "+f.join(", ")+" \u2014 i-upload ito sa parehong folder, tapos Ctrl+F5.";document.body.appendChild(d)})}})()<\/script>');
})();
