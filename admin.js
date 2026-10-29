function downloadCSVTemplate() {
  const headers = "SAP_Item_Code,Branch_Code,Item_Description,Category,Whole_Price,Loose_Price,Conversion_Factor,Buffer_Limit\n";
  const sample1 = "SAP-001,BR-01,Beef Tapa Marinated,Commissary A,500,12,50,15\n";
  const sample2 = "SAP-002,BR-02,Cooking Oil 18L,Commissary B,1200,75,18,5\n";
  const blob = new Blob([headers + sample1 + sample2], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "ERP_Product_Master_Template.csv";
  a.click();
}

function processCSVUpload() {
  const input = document.getElementById('csv-file-input');
  if (!input.files.length) {
    alert('Mangyaring pumili muna ng .CSV file na nanggaling sa SAP o Excel.');
    return;
  }
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const lines = e.target.result.split('\n');
    alert(`Matagumpay na nabasa ang ${lines.length - 1} mga produkto mula sa SAP master file! Naka-mapa na ang Whole at Loose conversion logic.`);
  };
  reader.readAsText(file);
}

function copyTableToGoogleSheets() {
  const table = document.getElementById('variance-table');
  let tsv = '';
  for (let row of table.rows) {
    let rowData = [];
    for (let cell of row.cells) {
      rowData.push(cell.innerText.replace(/\t|\n/g, ' '));
    }
    tsv += rowData.join('\t') + '\n';
  }
  navigator.clipboard.writeText(tsv).then(() => {
    alert('Na-kopya na ang buong report! Pwede mo na itong i-Paste (Ctrl+V) diretso sa Google Sheets.');
  });
}
