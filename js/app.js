const STORAGE_KEY = 'vighnaharta_receipt_data';

const formFields = [
  'receiptNo', 'date', 'receivedFrom', 'sumOf', 'amountWords',
  'rentMonth', 'propertyAddress', 'chequeNo', 'paymentOtherText',
  'totalAmount', 'advanceBalance', 'thisPayment', 'balance',
  'receivedByName', 'receivedByMobile', 'receivedByAddress', 'receivedByAadhaar'
];

const checkboxes = [
  'paymentCash', 'paymentCheque', 'paymentUpi', 'paymentOther'
];

function getFormData() {
  const data = {};
  formFields.forEach(name => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) data[name] = el.value;
  });
  checkboxes.forEach(name => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) data[name] = el.checked;
  });
  return data;
}

function setFormData(data) {
  formFields.forEach(name => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el && data[name] !== undefined) el.value = data[name];
  });
  checkboxes.forEach(name => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el && data[name] !== undefined) el.checked = data[name];
  });
}

function showStatus(msg, isError = false) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.style.color = isError ? '#c0392b' : '#1a5c3a';
  setTimeout(() => { el.textContent = ''; }, 3000);
}

function saveData() {
  const data = getFormData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  showStatus('Saved temporarily in browser!');
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    showStatus('No saved data found.', true);
    return;
  }
  try {
    setFormData(JSON.parse(raw));
    showStatus('Loaded saved data!');
  } catch {
    showStatus('Failed to load saved data.', true);
  }
}

function clearData() {
  formFields.forEach(name => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) el.value = '';
  });
  checkboxes.forEach(name => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) el.checked = false;
  });
  localStorage.removeItem(STORAGE_KEY);
  showStatus('Form cleared!');
}

function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function swapFieldsForPdf(receipt) {
  const changes = [];

  function addSwap(input, span) {
    input.style.display = 'none';
    input.parentNode.insertBefore(span, input);
    changes.push({ input, span });
  }

  receipt.querySelectorAll('input[type="text"], input[type="date"]').forEach(input => {
    const span = document.createElement('span');
    span.className = 'pdf-field-value';
    const val = input.type === 'date' ? formatDateForDisplay(input.value) : input.value;
    span.textContent = val || '\u00A0';
    span.style.cssText = 'font-size:13px;font-weight:600;display:inline-block;min-width:80px;padding:4px 6px;border-bottom:1.5px solid #ccc;flex:1;';
    addSwap(input, span);
  });

  receipt.querySelectorAll('textarea').forEach(ta => {
    const span = document.createElement('div');
    span.className = 'pdf-field-value';
    span.textContent = ta.value || '\u00A0';
    span.style.cssText = 'font-size:13px;font-weight:600;padding:4px 6px;border-bottom:1.5px solid #ccc;line-height:1.5;flex:1;min-height:28px;white-space:pre-wrap;';
    addSwap(ta, span);
  });

  receipt.querySelectorAll('.amount-input').forEach(input => {
    const span = document.createElement('span');
    span.className = 'pdf-field-value';
    span.textContent = input.value || '\u00A0';
    span.style.cssText = 'font-size:12px;font-weight:600;display:inline-block;min-width:40px;text-align:right;';
    addSwap(input, span);
  });

  return () => changes.forEach(({ input, span }) => {
    span.remove();
    input.style.display = '';
  });
}

function waitForImages(container) {
  const images = [...container.querySelectorAll('img')];
  if (images.length === 0) return Promise.resolve();

  return Promise.all(images.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));
}

async function downloadPdf() {
  const btn = document.getElementById('pdfBtn');
  const receipt = document.getElementById('receipt');

  btn.disabled = true;
  showStatus('Generating PDF...');

  receipt.classList.add('pdf-capture');
  receipt.scrollIntoView({ behavior: 'instant', block: 'start' });
  window.scrollTo(0, 0);

  const restoreFields = swapFieldsForPdf(receipt);

  await waitForImages(receipt);
  await new Promise(r => setTimeout(r, 200));

  const receiptNo = document.querySelector('[name="receiptNo"]').value || 'receipt';
  const filename = `Vighnaharta-Rent-Receipt-${receiptNo}.pdf`;

  try {
    const canvas = await html2canvas(receipt, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 0
    });

    restoreFields();
    receipt.classList.remove('pdf-capture');

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const { jsPDF } = window.jspdf;

    const pdfWidth = 794;
    const pdfHeight = Math.ceil((canvas.height * pdfWidth) / canvas.width);

    const pdf = new jsPDF({
      unit: 'px',
      format: [pdfWidth, pdfHeight],
      orientation: 'portrait',
      compress: true
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    pdf.save(filename);
    showStatus('PDF downloaded!');
  } catch (err) {
    restoreFields();
    receipt.classList.remove('pdf-capture');
    showStatus('PDF generation failed. Try again.', true);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('saveBtn').addEventListener('click', saveData);
document.getElementById('loadBtn').addEventListener('click', loadData);
document.getElementById('clearBtn').addEventListener('click', clearData);
document.getElementById('pdfBtn').addEventListener('click', downloadPdf);

window.addEventListener('DOMContentLoaded', () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      setFormData(JSON.parse(raw));
    } catch { /* ignore */ }
  }

  const dateField = document.querySelector('[name="date"]');
  if (dateField && !dateField.value) {
    dateField.value = new Date().toISOString().split('T')[0];
  }
});
