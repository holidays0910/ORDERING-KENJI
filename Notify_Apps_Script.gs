// KusinaERP — Email notifier (Google Apps Script)
// 1) script.google.com → New project → i-paste ito → palitan ang SECRET
// 2) Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone → Deploy
// 3) Kopyahin ang Web app URL → Admin ⋮ → Email Notifications
var SECRET = 'PALITAN-MO-ITO';
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return ContentService.createTextOutput('forbidden');
    var to = (d.to || []).filter(function (x) { return /@/.test(x); }).join(',');
    if (to) MailApp.sendEmail({ to: to, subject: '[KusinaERP] ' + d.subject, body: d.body });
    return ContentService.createTextOutput('ok');
  } catch (err) { return ContentService.createTextOutput('error: ' + err); }
}
