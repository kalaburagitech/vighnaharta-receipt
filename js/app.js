const STORAGE_KEY = 'vighnaharta_receipt_data';
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

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

  function addSwap(input, span, display = 'none') {
    const oldDisplay = input.style.display;
    input.style.display = 'none';
    input.parentNode.insertBefore(span, input);
    changes.push({ input, span, oldDisplay });
  }

  receipt.querySelectorAll('input[type="text"]:not(.amount-input), input[type="date"]').forEach(input => {
    const span = document.createElement('span');
    span.className = 'pdf-field-value';
    const val = input.type === 'date' ? formatDateForDisplay(input.value) : input.value;
    span.textContent = val || '\u00A0';
    span.style.cssText = 'font-size:12px;font-weight:600;display:inline-block;min-width:0;padding:3px 5px;border-bottom:1.5px solid #ccc;flex:1;line-height:1.35;white-space:nowrap;text-overflow:ellipsis;';
    addSwap(input, span);
  });

  receipt.querySelectorAll('textarea').forEach(ta => {
    const span = document.createElement('div');
    span.className = 'pdf-field-value pdf-textarea-value';
    span.textContent = ta.value || '\u00A0';
    span.style.cssText = 'font-size:12px;font-weight:600;padding:3px 5px;border-bottom:1.5px solid #ccc;line-height:1.35;flex:1;min-height:28px;white-space:pre-wrap;';
    addSwap(ta, span);
  });

  receipt.querySelectorAll('.amount-input').forEach(input => {
    const span = document.createElement('span');
    span.className = 'pdf-field-value';
    span.textContent = input.value || '\u00A0';
    span.style.cssText = 'font-size:11px;font-weight:600;display:inline-block;min-width:40px;max-width:82px;text-align:right;white-space:nowrap;text-overflow:ellipsis;';
    addSwap(input, span);
  });

  return () => changes.forEach(({ input, span, oldDisplay }) => {
    span.remove();
    input.style.display = oldDisplay;
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
  let restoreFields = null;

  btn.disabled = true;
  showStatus('Generating PDF...');

  receipt.classList.add('pdf-capture');
  receipt.scrollIntoView({ behavior: 'instant', block: 'start' });
  window.scrollTo(0, 0);

  restoreFields = swapFieldsForPdf(receipt);

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
      imageTimeout: 0,
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
      windowWidth: A4_WIDTH_PX,
      windowHeight: A4_HEIGHT_PX,
      scrollX: 0,
      scrollY: 0
    });

    restoreFields();
    restoreFields = null;
    receipt.classList.remove('pdf-capture');

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
      unit: 'px',
      format: [A4_WIDTH_PX, A4_HEIGHT_PX],
      orientation: 'portrait',
      compress: true
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_PX, A4_HEIGHT_PX, undefined, 'FAST');
    pdf.save(filename);
    showStatus('PDF downloaded!');
  } catch (err) {
    if (restoreFields) restoreFields();
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
