const DB_KEY = "stockflow_business_v1";

let db = JSON.parse(localStorage.getItem(DB_KEY)) || {
  business: {
    name: "My Business",
    address: "",
    phone: ""
  },

  products: [],
  history: []
};

let productImage = "";
let scannedItems = [];
let invoiceCart = [];


/* ================= SAVE ================= */

function saveDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function money(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}

function generateId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2);
}


/* ================= NAVIGATION ================= */

function showPage(pageId) {

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  const page = document.getElementById(pageId);

  if (page) {
    page.classList.add("active");
  }

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.remove("active-nav");
  });

  renderAll();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* ================= TOAST ================= */

function toast(message) {

  const element = document.getElementById("toast");

  element.textContent = message;
  element.style.display = "block";

  setTimeout(() => {
    element.style.display = "none";
  }, 2500);
}


/* ================= PRODUCT IMAGE ================= */

function previewProduct(event) {

  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {

    productImage = e.target.result;

    document.getElementById("productPreview").innerHTML =
      `<img src="${productImage}">`;
  };

  reader.readAsDataURL(file);
}


/* ================= SCANNER 2 ================= */
/* PRODUCT STORAGE */

function saveProduct() {

  const name =
    document.getElementById("productName").value.trim();

  const sku =
    document.getElementById("productSKU").value.trim();

  const stock =
    Number(document.getElementById("productStock").value);

  const cost =
    Number(document.getElementById("productCost").value);

  const price =
    Number(document.getElementById("productPrice").value);

  const alert =
    Number(document.getElementById("productAlert").value || 5);

  if (!name) {
    toast("Please enter a product name");
    return;
  }

  if (stock < 0 || price < 0) {
    toast("Enter valid product details");
    return;
  }

  const product = {
    id: generateId(),
    name,
    sku,
    stock,
    cost,
    price,
    alert,
    image: productImage,
    created: new Date().toISOString()
  };

  db.products.unshift(product);

  db.history.unshift({
    id: generateId(),
    type: "product",
    title: "Product added",
    details: name,
    date: new Date().toISOString()
  });

  saveDB();

  clearProductForm();

  renderAll();

  toast("Product added to smart storage");
}


function clearProductForm() {

  [
    "productName",
    "productSKU",
    "productStock",
    "productCost",
    "productPrice"
  ].forEach(id => {

    document.getElementById(id).value = "";

  });

  document.getElementById("productAlert").value = 5;

  productImage = "";

  document.getElementById("productPreview").innerHTML =
    `<span>📦</span><p>Product Image</p>`;
}


/* ================= SCANNER 1 ================= */
/* CUSTOMER BILL OCR */

async function scanCustomerBill(event) {

  const file = event.target.files[0];

  if (!file) return;

  const loading =
    document.getElementById("scanner1Loading");

  loading.innerHTML = `
    <div class="panel">
      <h3>🔍 Reading Customer Bill...</h3>
      <p style="color:#8294a8;margin-top:8px">
        Detecting products from your smart storage.
      </p>
    </div>
  `;

  try {

    const worker =
      await Tesseract.createWorker("eng");

    const result =
      await worker.recognize(file);

    await worker.terminate();

    const text =
      result.data.text.toLowerCase();

    scannedItems = detectProductsFromText(text);

    loading.innerHTML = "";

    document
      .getElementById("scanner1Results")
      .classList.remove("hidden");

    renderDetectedItems();

    if (!scannedItems.length) {

      toast("No matching products found");

    } else {

      toast(scannedItems.length + " product(s) detected");

    }

  } catch (error) {

    console.error(error);

    loading.innerHTML =
      `<div class="panel">
        Scanner could not read this image.
        Try a clearer bill photo.
      </div>`;

  }
}


/* MATCH OCR TEXT WITH INVENTORY */

function detectProductsFromText(text) {

  const detected = [];

  db.products.forEach(product => {

    const productName =
      product.name.toLowerCase();

    if (text.includes(productName)) {

      let quantity = findQuantityForProduct(
        text,
        productName
      );

      detected.push({
        productId: product.id,
        name: product.name,
        quantity: quantity || 1,
        available: product.stock
      });

    }

  });

  return detected;
}


/* TRY TO FIND QUANTITY */

function findQuantityForProduct(text, productName) {

  const lines = text.split("\n");

  for (const line of lines) {

    if (line.includes(productName)) {

      const match =
        line.match(/\b(\d+)\b/);

      if (match) {

        const number =
          Number(match[1]);

        if (number > 0 && number < 10000) {
          return number;
        }

      }

    }

  }

  return 1;
}


/* RENDER DETECTED ITEMS */

function renderDetectedItems() {

  const container =
    document.getElementById("detectedProducts");

  if (!scannedItems.length) {

    container.innerHTML =
      `<div class="activity-row">
        No products matched your inventory.
        Make sure product names on the bill are similar
        to the names saved in Scanner 02.
      </div>`;

    return;
  }

  container.innerHTML =
    scannedItems.map((item, index) => {

      return `
        <div class="cart-row">

          <div>
            <b>${escapeHTML(item.name)}</b>

            <div style="color:#8294a8;font-size:11px;margin-top:5px">
              Available stock: ${item.available}
            </div>
          </div>

          <div class="qty-controls">

            <button onclick="changeScannedQty(${index},-1)">
              −
            </button>

            <b>${item.quantity}</b>

            <button onclick="changeScannedQty(${index},1)">
              +
            </button>

          </div>

        </div>
      `;

    }).join("");
}


function changeScannedQty(index, change) {

  scannedItems[index].quantity =
    Math.max(
      1,
      scannedItems[index].quantity + change
    );

  renderDetectedItems();
}


/* CONFIRM STOCK DEDUCTION */

function confirmStockDeduction() {

  if (!scannedItems.length) {

    toast("No products to deduct");
    return;

  }

  const successful = [];

  scannedItems.forEach(item => {

    const product =
      db.products.find(
        p => p.id === item.productId
      );

    if (!product) return;

    const quantity =
      Math.min(
        Number(item.quantity),
        Number(product.stock)
      );

    if (quantity > 0) {

      product.stock -= quantity;

      successful.push(
        product.name + " × " + quantity
      );

    }

  });

  if (!successful.length) {

    toast("Not enough stock available");
    return;

  }

  db.history.unshift({

    id: generateId(),

    type: "scan",

    title: "Customer bill scanned",

    details: successful.join(", "),

    date: new Date().toISOString()

  });

  saveDB();

  renderAll();

  document
    .getElementById("scanner1Results")
    .classList.add("hidden");

  scannedItems = [];

  toast("Stock updated successfully");
}


/* ================= INVENTORY ================= */

function renderInventory() {

  const container =
    document.getElementById("inventoryList");

  const search =
    (
      document
        .getElementById("inventorySearch")
        ?.value || ""
    ).toLowerCase();

  const products =
    db.products.filter(product =>
      product.name
        .toLowerCase()
        .includes(search)
    );

  if (!products.length) {

    container.innerHTML =
      `<div class="panel">
        📦 No products in storage yet.
      </div>`;

    return;
  }

  container.innerHTML =
    products.map(product => {

      const low =
        Number(product.stock) <= Number(product.alert);

      return `
        <div class="inventory-card">

          ${
            product.image
              ? `<img src="${product.image}">`
              : `<div class="inventory-placeholder">📦</div>`
          }

          <div class="inventory-info">

            <h3>${escapeHTML(product.name)}</h3>

            <p>
              Selling Price:
              ${money(product.price)}
            </p>

            <span class="stock-badge ${low ? "low" : ""}">
              ${product.stock} units
            </span>

          </div>

        </div>
      `;

    }).join("");
}


/* ================= SCANNER 3 ================= */
/* SMART BILL MAKER */

function renderInvoiceProducts() {

  const container =
    document.getElementById("invoiceProductList");

  const search =
    (
      document
        .getElementById("invoiceSearch")
        ?.value || ""
    ).toLowerCase();

  const products =
    db.products.filter(product =>
      product.name
        .toLowerCase()
        .includes(search) &&
      Number(product.stock) > 0
    );

  container.innerHTML =
    products.map(product => {

      return `
        <div class="product-row">

          <div class="product-mini">

            ${
              product.image
                ? `<img src="${product.image}">`
                : `<div>📦</div>`
            }

            <div>
              <b>${escapeHTML(product.name)}</b>

              <small>
                ${money(product.price)}
                · Stock ${product.stock}
              </small>
            </div>

          </div>

          <button
            class="add-small"
            onclick="addToInvoice('${product.id}')">

            + Add

          </button>

        </div>
      `;

    }).join("");
}


function addToInvoice(productId) {

  const product =
    db.products.find(p => p.id === productId);

  if (!product) return;

  const existing =
    invoiceCart.find(
      item => item.productId === productId
    );

  if (existing) {

    if (existing.quantity < product.stock) {
      existing.quantity++;
    }

  } else {

    invoiceCart.push({

      productId: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: 1

    });

  }

  renderInvoiceCart();
}


function changeInvoiceQty(index, change) {

  const item = invoiceCart[index];

  const product =
    db.products.find(
      p => p.id === item.productId
    );

  if (change > 0 &&
      item.quantity >= product.stock) {

    toast("Maximum available stock reached");
    return;

  }

  item.quantity += change;

  if (item.quantity <= 0) {

    invoiceCart.splice(index, 1);

  }

  renderInvoiceCart();
}


function renderInvoiceCart() {

  const cart =
    document.getElementById("invoiceCart");

  if (!invoiceCart.length) {

    cart.innerHTML =
      `<p style="color:#8294a8;padding:15px 0">
        No products selected yet.
      </p>`;

  } else {

    cart.innerHTML =
      invoiceCart.map((item, index) => {

        return `
          <div class="cart-row">

            <div>

              <b>${escapeHTML(item.name)}</b>

              <div style="color:#8294a8;font-size:11px;margin-top:4px">

                ${money(item.price)}
                × ${item.quantity}

              </div>

            </div>

            <div class="qty-controls">

              <button
                onclick="changeInvoiceQty(${index},-1)">
                −
              </button>

              <b>${item.quantity}</b>

              <button
                onclick="changeInvoiceQty(${index},1)">
                +
              </button>

            </div>

          </div>
        `;

      }).join("");

  }

  updateInvoicePreview();
}


function updateInvoicePreview() {

  const customer =
    document.getElementById("invoiceCustomer")?.value
    || "Walk-in Customer";

  document
    .getElementById("previewCustomer")
    .textContent = customer;

  const preview =
    document.getElementById("previewItems");

  preview.innerHTML =
    invoiceCart.map(item => {

      const total =
        item.price * item.quantity;

      return `
        <div class="invoice-item">

          <span>
            ${escapeHTML(item.name)}
            × ${item.quantity}
          </span>

          <b>${money(total)}</b>

        </div>
      `;

    }).join("");

  const total =
    invoiceCart.reduce(
      (sum, item) =>
        sum + item.price * item.quantity,
      0
    );

  document
    .getElementById("invoiceTotal")
    .textContent = money(total);
}


document.addEventListener("input", function(event) {

  if (
    event.target.id === "invoiceCustomer"
  ) {

    updateInvoicePreview();

  }

});


/* SAVE INVOICE */

function saveInvoice() {

  if (!invoiceCart.length) {

    toast("Add products to the bill first");
    return;

  }

  let total = 0;

  const soldItems = [];

  for (const item of invoiceCart) {

    const product =
      db.products.find(
        p => p.id === item.productId
      );

    if (!product ||
        product.stock < item.quantity) {

      toast(
        "Not enough stock for " + item.name
      );

      return;

    }

  }

  invoiceCart.forEach(item => {

    const product =
      db.products.find(
        p => p.id === item.productId
      );

    product.stock -= item.quantity;

    total += item.price * item.quantity;

    soldItems.push(
      item.name + " × " + item.quantity
    );

  });

  const customer =
    document.getElementById("invoiceCustomer").value
    || "Walk-in Customer";

  db.history.unshift({

    id: generateId(),

    type: "invoice",

    title: "Invoice generated",

    details:
      customer +
      " — " +
      soldItems.join(", ") +
      " — " +
      money(total),

    total,

    date: new Date().toISOString()

  });

  saveDB();

  invoiceCart = [];

  document.getElementById("invoiceCustomer").value = "";
  document.getElementById("invoicePhone").value = "";

  renderAll();

  toast("Professional invoice saved & stock updated");
}


/* PRINT INVOICE */

function printInvoice() {

  updateInvoicePreview();

  const invoice =
    document.getElementById("invoicePreview").innerHTML;

  const win = window.open("", "_blank");

  win.document.write(`
    <!DOCTYPE html>

    <html>

    <head>

      <title>Invoice</title>

      <style>

        body{
          font-family:Arial;
          padding:40px;
          color:#111;
        }

        .invoice-logo{
          font-size:28px;
          font-weight:bold;
        }

        .invoice-logo span{
          display:block;
          font-size:10px;
          color:#555;
        }

        .invoice-item,
        .invoice-total{
          display:flex;
          justify-content:space-between;
          padding:10px 0;
          border-bottom:1px solid #ddd;
        }

        .invoice-total{
          font-size:20px;
          font-weight:bold;
          border-top:2px solid #111;
          margin-top:20px;
        }

      </style>

    </head>

    <body>

      ${invoice}

    </body>

    </html>
  `);

  win.document.close();

  win.print();
}


/* ================= DASHBOARD ================= */

function renderDashboard() {

  const totalSales =
    db.history
      .filter(item => item.type === "invoice")
      .reduce(
        (sum, item) =>
          sum + Number(item.total || 0),
        0
      );

  const stockValue =
    db.products.reduce(
      (sum, product) =>
        sum +
        Number(product.stock) *
        Number(product.cost),
      0
    );

  const lowStock =
    db.products.filter(
      product =>
        Number(product.stock) <=
        Number(product.alert)
    );

  document
    .getElementById("businessTitle")
    .textContent =
    db.business.name;

  document
    .getElementById("totalSales")
    .textContent =
    money(totalSales);

  document
    .getElementById("totalProducts")
    .textContent =
    db.products.length;

  document
    .getElementById("stockValue")
    .textContent =
    money(stockValue);

  document
    .getElementById("lowStock")
    .textContent =
    lowStock.length;


  document
    .getElementById("dateText")
    .textContent =
    new Date().toLocaleDateString(
      "en-IN",
      {
        weekday:"long",
        day:"numeric",
        month:"long"
      }
    );


  const lowList =
    document.getElementById("lowStockList");

  if (!lowStock.length) {

    lowList.innerHTML =
      `<div class="activity-row">
        ✅ All products have healthy stock.
      </div>`;

  } else {

    lowList.innerHTML =
      lowStock.slice(0,5)
      .map(product => `

        <div class="activity-row">

          <div>

            <b>${escapeHTML(product.name)}</b>

            <div style="color:#8294a8;font-size:11px;margin-top:4px">
              Only ${product.stock} remaining
            </div>

          </div>

          <span style="color:#ffb454">
            Low
          </span>

        </div>

      `).join("");

  }


  const recent =
    document.getElementById("recentActivity");

  if (!db.history.length) {

    recent.innerHTML =
      `<div class="activity-row">
        No activity yet.
      </div>`;

  } else {

    recent.innerHTML =
      db.history.slice(0,5)
      .map(item => `

        <div class="activity-row">

          <div>

            <b>${escapeHTML(item.title)}</b>

            <div style="color:#8294a8;font-size:11px;margin-top:4px">

              ${escapeHTML(item.details)}

            </div>

          </div>

        </div>

      `).join("");

  }
}


/* ================= HISTORY ================= */

function renderHistory() {

  const container =
    document.getElementById("historyList");

  if (!db.history.length) {

    container.innerHTML =
      `<div class="panel">
        No business activity yet.
      </div>`;

    return;

  }

  container.innerHTML =
    db.history.map(item => `

      <div class="panel" style="margin-bottom:10px">

        <b>${escapeHTML(item.title)}</b>

        <p style="color:#8294a8;margin-top:8px;font-size:12px">

          ${escapeHTML(item.details)}

        </p>

        <small style="color:#5f7285;display:block;margin-top:8px">

          ${new Date(item.date).toLocaleString("en-IN")}

        </small>

      </div>

    `).join("");
}


/* ================= SETTINGS ================= */

function saveSettings() {

  db.business.name =
    document
      .getElementById("businessNameInput")
      .value
      .trim()
    || "My Business";

  db.business.address =
    document
      .getElementById("businessAddressInput")
      .value;

  db.business.phone =
    document
      .getElementById("businessPhoneInput")
      .value;

  saveDB();

  renderAll();

  toast("Business settings saved");
}


function loadSettings() {

  document
    .getElementById("businessNameInput")
    .value =
    db.business.name || "";

  document
    .getElementById("businessAddressInput")
    .value =
    db.business.address || "";

  document
    .getElementById("businessPhoneInput")
    .value =
    db.business.phone || "";
}


/* ================= BACKUP ================= */

function exportData() {

  const blob =
    new Blob(
      [JSON.stringify(db,null,2)],
      {type:"application/json"}
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    "stockflow-business-backup.json";

  link.click();

  URL.revokeObjectURL(url);

  toast("Backup downloaded");
}


function restoreData(event) {

  const file = event.target.files[0];

  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = function() {

    try {

      const data =
        JSON.parse(reader.result);

      if (!data.products) {
        throw new Error();
      }

      db = data;

      saveDB();

      renderAll();

      toast("Backup restored");

    } catch {

      toast("Invalid backup file");

    }

  };

  reader.readAsText(file);
}


function resetApp() {

  if (
    !confirm(
      "Delete all business data permanently?"
    )
  ) return;

  localStorage.removeItem(DB_KEY);

  location.reload();
}


/* ================= UTILITIES ================= */

function escapeHTML(text) {

  return String(text || "")

    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}


/* ================= RENDER ALL ================= */

function renderAll() {

  renderDashboard();

  renderInventory();

  renderHistory();

  renderInvoiceProducts();

  renderInvoiceCart();

  loadSettings();
}


/* START */

renderAll();
