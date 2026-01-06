// GLOBAL DATA
let db = JSON.parse(localStorage.getItem("swan_db_v2")) || {
    info: { name: "Swan Enterprise", addr: "123 Business St, City", logo: "" },
    items: [],
    customers: [
        { id: 1, name: "Walk-in", phone: "", bal: 0, opening: 0, type: "Walk-in" }
    ],
    suppliers: [],
    sales: [],
    expenses: [],
    banks: [],
    bankTx: [],
    heldBills: [],
    purchases: [],
    transactions: [],
    employees: [],
    attendance: [],
    miscProfits: [],
    settings: { taxMode: "percent", fixedTax: 0, taxPercent: 0 },
    role: "employee"
};

let currentRole = db.role || "employee";
let cart = [];
let purchaseCart = [];
let customerDisplayOn = false;
let currentBillIndex = -1;

// INIT
window.onload = function () {
    updateClock();
    setInterval(updateClock, 1000);

    const savedTheme = localStorage.getItem("swan_theme") || "theme-default";
    document.body.className = savedTheme;
    document.getElementById("theme-selector").value = savedTheme;

    document.getElementById("set-name").value = db.info.name || "";
    document.getElementById("set-addr").value = db.info.addr || "";
    document.getElementById("set-logo").value = db.info.logo || "";

    if (db.settings) {
        document.getElementById("set-tax-mode").value = db.settings.taxMode || "percent";
        document.getElementById("set-fixed-tax").value = db.settings.fixedTax || 0;
        document.getElementById("set-tax-percent").value = db.settings.taxPercent || 0;
        toggleFixedTaxSettings();
    }
    if (db.info.logo) document.getElementById("brand-logo").src = db.info.logo;

    const units = ["Pcs", "Box", "Kg", "g", "L", "ml", "m", "cm", "Doz", "Pack"];
    const u1 = document.getElementById("mi-u1");
    const u2 = document.getElementById("mi-u2");
    units.forEach((u) => {
        u1.add(new Option(u, u));
        u2.add(new Option(u, u));
    });

    renderSelectors();
    renderDash();
    renderInv();
    renderExpenses();
    renderBanks();
    renderHR();
    renderLedgers();
    applyRoleUI();
    attachEvents();
    updateBillIndexDisplay();
};

function saveDB() {
    db.role = currentRole;
    localStorage.setItem("swan_db_v2", JSON.stringify(db));
}

// CLOCK/THEME
function updateClock() {
    const now = new Date();
    document.getElementById("clock").innerText = now.toLocaleTimeString();
    if (!document.getElementById("pos-date").value)
        document.getElementById("pos-date").valueAsDate = now;
    if (!document.getElementById("pur-date").value)
        document.getElementById("pur-date").valueAsDate = now;
    if (!document.getElementById("me-date").value)
        document.getElementById("me-date").valueAsDate = now;
    if (!document.getElementById("att-date").value)
        document.getElementById("att-date").valueAsDate = now;
    if (!document.getElementById("cp-date").value)
        document.getElementById("cp-date").valueAsDate = now;
    if (!document.getElementById("sp-date").value)
        document.getElementById("sp-date").valueAsDate = now;
    if (!document.getElementById("bt-date").value)
        document.getElementById("bt-date").valueAsDate = now;
}

function setTheme(t) {
    document.body.className = t;
    localStorage.setItem("swan_theme", t);
}

// ROLE / PERMISSIONS
function switchRole() {
    if (currentRole === "admin") {
        currentRole = "employee";
        saveDB();
        applyRoleUI();
        return;
    }
    const pass = prompt("Enter Admin Password:");
    if (pass === "1234") {
        currentRole = "admin";
        saveDB();
        applyRoleUI();
    } else {
        alert("Incorrect password");
    }
}

function applyRoleUI() {
    document.getElementById("role-label").innerText =
        "Role: " + (currentRole === "admin" ? "Admin" : "Employee");

    document
        .querySelectorAll(".tile-hidden-admin")
        .forEach((el) => (el.style.display = currentRole === "admin" ? "flex" : "none"));

    const invAddBtn = document.getElementById("btn-new-item");
    if (invAddBtn) invAddBtn.style.display = currentRole === "admin" ? "inline-flex" : "none";
}

// NAV
function nav(viewId) {
    document.querySelectorAll(".ribbon-btn").forEach((b) => b.classList.remove("active"));
    const btn = document.querySelector(`.ribbon-btn[data-view="${viewId}"]`);
    if (btn) btn.classList.add("active");

    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.getElementById(viewId).classList.add("active");

    if (viewId === "dashboard") renderDash();
    if (viewId === "pos") {
        renderPosItems();
        document.getElementById("pos-search").focus();
    }
    if (viewId === "inventory") renderInv();
    if (viewId === "ledger") renderLedgers();
    if (viewId === "expenses") renderExpenses();
    if (viewId === "banking") renderBanks();
    if (viewId === "hr") {
        renderSelectors();
    }
}

// DATE FILTER
function filterByDate(array, startId, endId, field = "date") {
    const s = document.getElementById(startId).value || null;
    const e = document.getElementById(endId).value || null;
    let out = array;
    if (s) out = out.filter((x) => x[field] >= s);
    if (e) out = out.filter((x) => x[field] <= e);
    return out;
}

// DASHBOARD + REPORTS
function renderDash() {
    const salesRange = filterByDate(db.sales, "rpt-start", "rpt-end");
    const total = salesRange.reduce((sum, s) => sum + s.total, 0);
    const cash = salesRange
        .filter((s) => s.payMode === "Cash")
        .reduce((sum, s) => sum + s.total, 0);
    const online = salesRange
        .filter((s) => s.payMode === "Online")
        .reduce((sum, s) => sum + s.total, 0);
    const credit = salesRange
        .filter((s) => s.payMode === "Credit")
        .reduce((sum, s) => sum + s.total, 0);
    const gross = salesRange.reduce((sum, s) => sum + (s.profit || 0), 0);

    document.getElementById("d-total").innerText = format(total);
    document.getElementById("d-cash").innerText = format(cash);
    document.getElementById("d-credit").innerText = format(credit);
    document.getElementById("d-online").innerText = format(online);
    document.getElementById("d-gross").innerText = format(gross);

    const expRange = filterByDate(db.expenses, "rpt-start", "rpt-end");
    const expTotal = expRange.reduce((sum, e) => sum + e.amt, 0);
    document.getElementById("d-net").innerText = format(gross - expTotal);
}

function viewReport(type) {
    const cont = document.getElementById("report-container");
    let title = "";
    let headRowHtml = "";
    let bodyRowsHtml = "";
    let footerHtml = "";

    if (type === "sale" || type === "profit") {
        const data = filterByDate(db.sales, "rpt-start", "rpt-end");
        let sumSub = 0,
            sumDisc = 0,
            sumTax = 0,
            sumTotal = 0,
            sumProfit = 0;
        bodyRowsHtml = data
            .map((s) => {
                sumSub += s.sub;
                sumDisc += s.disc;
                sumTax += s.taxAmt;
                sumTotal += s.total;
                sumProfit += s.profit || 0;
                return `
          <tr>
            <td>${s.date}</td>
            <td>${s.id}</td>
            <td>${s.custName}</td>
            <td class="text-right">${format(s.sub)}</td>
            <td class="text-right">${format(s.disc)}</td>
            <td class="text-right">${format(s.taxAmt)}</td>
            <td class="text-right">${format(s.total)}</td>
            <td class="text-right">${format(s.profit || 0)}</td>
            <td>${s.payMode}</td>
          </tr>`;
            })
            .join("");
        footerHtml = `
      <tfoot>
        <tr>
          <th colspan="3" class="text-right">Totals</th>
          <th class="text-right">${format(sumSub)}</th>
          <th class="text-right">${format(sumDisc)}</th>
          <th class="text-right">${format(sumTax)}</th>
          <th class="text-right">${format(sumTotal)}</th>
          <th class="text-right">${format(sumProfit)}</th>
          <th></th>
        </tr>
      </tfoot>`;
        headRowHtml = `
      <tr>
        <th>Date</th><th>Bill #</th><th>Customer</th>
        <th>Sub</th><th>Disc</th><th>Tax</th><th>Total</th><th>Profit</th><th>Mode</th>
      </tr>`;
        title = type === "sale" ? "Sales Report" : "Profit Report";
    } else if (type === "expense") {
        const data = filterByDate(db.expenses, "rpt-start", "rpt-end");
        let sum = 0;
        bodyRowsHtml = data
            .map((e) => {
                sum += e.amt;
                return `
          <tr>
            <td>${e.date}</td>
            <td>${e.cat}</td>
            <td>${e.desc}</td>
            <td class="text-right">${format(e.amt)}</td>
          </tr>`;
            })
            .join("");
        footerHtml = `
      <tfoot>
        <tr>
          <th colspan="3" class="text-right">Total</th>
          <th class="text-right">${format(sum)}</th>
        </tr>
      </tfoot>`;
        headRowHtml = `
      <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr>`;
        title = "Expense Report";
    } else if (type === "stock") {
        let sumValue = 0;
        bodyRowsHtml = db.items
            .map((i) => {
                const value = i.stock * i.cost;
                sumValue += value;
                return `
          <tr>
            <td>${i.code}</td>
            <td>${i.name}</td>
            <td>${i.loc || ""}</td>
            <td class="text-right">${format(i.cost)}</td>
            <td class="text-right">${format(i.price)}</td>
            <td class="text-right">${i.stock}</td>
            <td class="text-right">${format(value)}</td>
          </tr>`;
            })
            .join("");
        footerHtml = `
      <tfoot>
        <tr>
          <th colspan="6" class="text-right">Total Stock Value</th>
          <th class="text-right">${format(sumValue)}</th>
        </tr>
      </tfoot>`;
        headRowHtml = `
      <tr><th>Code</th><th>Name</th><th>Loc</th><th>Cost</th><th>Price</th><th>Stock</th><th>Value</th></tr>`;
        title = "Stock Report";
    }

    document.getElementById("m-report-title").innerText = title;
    cont.innerHTML = `
    <div class="table-container reports-table-container">
      <div class="table-scroll">
        <table class="table-tight">
          <thead>${headRowHtml}</thead>
          <tbody>${bodyRowsHtml}</tbody>
          ${footerHtml}
        </table>
      </div>
    </div>
  `;
    modal("m-report");
}

function printReport(type) {
    let title = "";
    let headRowHtml = "";
    let bodyRowsHtml = "";
    let footerHtml = "";

    if (type === "sale" || type === "profit") {
        const data = filterByDate(db.sales, "rpt-start", "rpt-end");
        let sumSub = 0,
            sumDisc = 0,
            sumTax = 0,
            sumTotal = 0,
            sumProfit = 0;
        bodyRowsHtml = data
            .map((s) => {
                sumSub += s.sub;
                sumDisc += s.disc;
                sumTax += s.taxAmt;
                sumTotal += s.total;
                sumProfit += s.profit || 0;
                return `
        <tr>
          <td>${s.date}</td>
          <td>${s.id}</td>
          <td>${s.custName}</td>
          <td>${format(s.sub)}</td>
          <td>${format(s.disc)}</td>
          <td>${format(s.taxAmt)}</td>
          <td>${format(s.total)}</td>
          <td>${format(s.profit || 0)}</td>
          <td>${s.payMode}</td>
        </tr>`;
            })
            .join("");
        footerHtml = `
      <tr>
        <th colspan="3">Totals</th>
        <th>${format(sumSub)}</th>
        <th>${format(sumDisc)}</th>
        <th>${format(sumTax)}</th>
        <th>${format(sumTotal)}</th>
        <th>${format(sumProfit)}</th>
        <th></th>
      </tr>`;
        headRowHtml = `
      <tr>
        <th>Date</th><th>Bill #</th><th>Customer</th>
        <th>Sub</th><th>Disc</th><th>Tax</th><th>Total</th><th>Profit</th><th>Mode</th>
      </tr>`;
        title = type === "sale" ? "Sales Report" : "Profit Report";
    } else if (type === "expense") {
        const data = filterByDate(db.expenses, "rpt-start", "rpt-end");
        let sum = 0;
        bodyRowsHtml = data
            .map((e) => {
                sum += e.amt;
                return `
        <tr>
          <td>${e.date}</td>
          <td>${e.cat}</td>
          <td>${e.desc}</td>
          <td>${format(e.amt)}</td>
        </tr>`;
            })
            .join("");
        footerHtml = `
      <tr>
        <th colspan="3">Total</th>
        <th>${format(sum)}</th>
      </tr>`;
        headRowHtml = `
      <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr>`;
        title = "Expense Report";
    } else if (type === "stock") {
        let sumValue = 0;
        bodyRowsHtml = db.items
            .map((i) => {
                const value = i.cost * i.stock;
                sumValue += value;
                return `
        <tr>
          <td>${i.code}</td>
          <td>${i.name}</td>
          <td>${i.loc || ""}</td>
          <td>${format(i.cost)}</td>
          <td>${format(i.price)}</td>
          <td>${i.stock}</td>
          <td>${format(value)}</td>
        </tr>`;
            })
            .join("");
        footerHtml = `
      <tr>
        <th colspan="6">Total Stock Value</th>
        <th>${format(sumValue)}</th>
      </tr>`;
        headRowHtml = `
      <tr><th>Code</th><th>Name</th><th>Loc</th><th>Cost</th><th>Price</th><th>Stock</th><th>Value</th></tr>`;
        title = "Stock Report";
    }

    const zone = document.getElementById("print-zone");
    zone.innerHTML = `
    <div class="print-header">
      ${db.info.logo ? `<img src="${db.info.logo}">` : ""}
      <h2>${db.info.name}</h2>
      <p>${db.info.addr}</p>
      <hr>
      <h3>${title}</h3>
    </div>
    <table class="print-table">
      <thead>${headRowHtml}</thead>
      <tbody>${bodyRowsHtml}</tbody>
      <tfoot>${footerHtml}</tfoot>
    </table>
  `;
    window.print();
    setTimeout(() => (zone.innerHTML = ""), 1000);
}

// POS
function renderPosItems() {
    // just ensure selectors refresh
    const sel = document.getElementById("pos-cust");
    sel.innerHTML = "";
    db.customers.forEach((c) => sel.add(new Option(c.name, c.id)));

    const bsel = document.getElementById("pos-bank");
    bsel.innerHTML = "";
    db.banks.forEach((b) => bsel.add(new Option(b.name, b.id)));
}

function filterPosList() {
    const q = document.getElementById("pos-search").value.toLowerCase();
    const res = db.items.filter(
        (i) =>
            i.name.toLowerCase().includes(q) ||
            i.code.toLowerCase().includes(q)
    );
    const tb = document.getElementById("pos-search-body");
    tb.innerHTML = "";

    const exact = res.find((i) => i.code.toLowerCase() === q);
    if (exact && res.length === 1) {
        addToCart(exact.id);
        document.getElementById("pos-search").value = "";
        tb.innerHTML = "";
        return;
    }

    res.slice(0, 50).forEach((i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${i.code}</td>
      <td>${i.name}</td>
      <td class="text-right">${format(i.price)}</td>
      <td class="text-right">${i.stock}</td>
      <td><button class="btn btn-sm" data-add-cart="${i.id}">+</button></td>
    `;
        tb.appendChild(tr);
    });
}

function addToCart(id) {
    const item = db.items.find((i) => i.id === id);
    if (!item) return;
    if (item.stock <= 0) {
        alert("Out of stock!");
        return;
    }
    const exist = cart.find((c) => c.id === id);
    if (exist) exist.qty++;
    else
        cart.push({
            id: item.id,
            name: item.name,
            price: item.price,
            cost: item.cost,
            qty: 1,
            unit: item.u1
        });
    renderCart();
}

function renderCart() {
    const tb = document.getElementById("pos-body");
    tb.innerHTML = "";
    let sub = 0;
    cart.forEach((c, idx) => {
        const total = c.price * c.qty;
        sub += total;
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.unit}</td>
      <td><input type="number" value="${c.qty}" style="width:60px" data-cart-qty="${idx}"></td>
      <td class="text-right">${format(c.price)}</td>
      <td class="text-right">${format(total)}</td>
      <td><button class="btn btn-danger btn-sm" data-cart-del="${idx}">x</button></td>
    `;
        tb.appendChild(tr);
    });
    document.getElementById("pos-sub").innerText = format(sub);
    document.getElementById("pos-cart-sub-footer").innerText = format(sub);
    calcPos();
    updateCustomerDisplay();
}

function updateCart(idx, qty) {
    if (qty < 1) qty = 1;
    cart[idx].qty = parseFloat(qty);
    renderCart();
}

function remCart(idx) {
    cart.splice(idx, 1);
    renderCart();
}

function calcPos() {
    const sub = parseFloat(document.getElementById("pos-sub").innerText) || 0;
    const disc = parseFloat(document.getElementById("pos-disc").value) || 0;
    const taxPercent = parseFloat(document.getElementById("pos-tax").value) || 0;
    const fixedTax = parseFloat(document.getElementById("pos-fixed-tax").value) || 0;
    let taxAmt = sub * (taxPercent / 100) + fixedTax;
    const svc = parseFloat(document.getElementById("pos-svc").value) || 0;
    const net = sub - disc + taxAmt + svc;
    document.getElementById("pos-net").innerText = format(net);
    calcChange();
    updateCustomerDisplay();
}

function calcChange() {
    const net = parseFloat(document.getElementById("pos-net").innerText) || 0;
    const tend = parseFloat(document.getElementById("pos-tend").value) || 0;
    document.getElementById("pos-change").innerText = format(tend - net);
}

function clearPos() {
    cart = [];
    renderCart();
    document.getElementById("pos-tend").value = "";
    document.getElementById("pos-disc").value = 0;
    if (db.settings) {
        document.getElementById("pos-tax").value = db.settings.taxPercent || 0;
        document.getElementById("pos-fixed-tax").value = db.settings.fixedTax || 0;
    } else {
        document.getElementById("pos-tax").value = 0;
        document.getElementById("pos-fixed-tax").value = 0;
    }
    document.getElementById("pos-svc").value = 0;
    calcPos();
}

function saveOrPrint(mode) {
    if (cart.length === 0) {
        alert("Cart empty");
        return;
    }
    const custId = parseInt(document.getElementById("pos-cust").value, 10);
    const cust = db.customers.find((c) => c.id === custId);
    const date = document.getElementById("pos-date").value;
    const payMode = document.getElementById("pos-mode").value;
    const sub = parseFloat(document.getElementById("pos-sub").innerText) || 0;
    const disc = parseFloat(document.getElementById("pos-disc").value) || 0;
    const taxPercent = parseFloat(document.getElementById("pos-tax").value) || 0;
    const fixedTax = parseFloat(document.getElementById("pos-fixed-tax").value) || 0;
    const taxAmt = sub * (taxPercent / 100) + fixedTax;
    const total = sub - disc + taxAmt + (parseFloat(document.getElementById("pos-svc").value) || 0);
    const remarks = document.getElementById("pos-rem").value;

    let billProfit = 0;
    cart.forEach((c) => {
        billProfit += (c.price - c.cost) * c.qty;
        const item = db.items.find((i) => i.id === c.id);
        if (item) item.stock -= c.qty;
    });

    const saleId = Date.now();
    let remaining = 0;
    let receivedNow = 0;

    if (payMode === "Credit") {
        receivedNow = 0;
        remaining = total;
        if (cust) {
            cust.bal += remaining;
            db.transactions.push({
                date,
                type: "Credit Sale",
                desc: `Bill #${saleId}`,
                amt: remaining,
                relId: cust.id
            });
        }
    } else {
        receivedNow = total;
        remaining = 0;
        if (payMode === "Online") {
            const bankId = parseInt(document.getElementById("pos-bank").value, 10);
            const bank = db.banks.find((b) => b.id === bankId);
            if (bank) {
                bank.bal += total;
                db.bankTx.push({
                    id: Date.now(),
                    date,
                    bankId: bank.id,
                    type: "Deposit",
                    amt: total
                });
            }
        }
    }

    const sale = {
        id: saleId,
        date,
        custId,
        custName: cust ? cust.name : "",
        items: JSON.parse(JSON.stringify(cart)),
        sub,
        disc,
        taxAmt,
        total,
        profit: billProfit,
        payMode,
        remarks,
        received: receivedNow,
        remaining
    };

    db.sales.push(sale);
    saveDB();

    if (mode === "saveprint") {
        printBill(sale);
    } else {
        alert("Saved!");
    }

    clearPos();
    renderDash();
    renderInv();
    updateBillIndexDisplay();
}

function printBill(sale) {
    const zone = document.getElementById("print-zone");
    const rows = sale.items
        .map(
            (i) => `
      <tr>
        <td>${i.name}</td>
        <td>${i.qty}</td>
        <td>${format(i.price)}</td>
        <td>${format(i.qty * i.price)}</td>
      </tr>`
        )
        .join("");
    zone.innerHTML = `
    <div class="print-header">
      ${db.info.logo ? `<img src="${db.info.logo}">` : ""}
      <h2>${db.info.name}</h2>
      <p>${db.info.addr}</p>
      <hr>
      <h3>INVOICE #${sale.id}</h3>
      <p>Date: ${sale.date} | Cust: ${sale.custName}</p>
    </div>
    <table class="print-table">
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:right; margin-top:10px;">
      <p>Sub: ${format(sale.sub)}</p>
      <p>Disc: ${format(sale.disc)}</p>
      <p>Tax: ${format(sale.taxAmt)}</p>
      <h3>Total: ${format(sale.total)}</h3>
      <p>Received: ${format(sale.received)}</p>
      <p>Remaining: ${format(sale.remaining)}</p>
    </div>
    <hr>
    <p style="text-align:center; font-size:10px;">Thank you for your business!</p>
  `;
    window.print();
    setTimeout(() => (zone.innerHTML = ""), 1000);
}

// BILL NAVIGATION (shared with POS & dashboard)
function updateBillIndexDisplay() {
    const idxInput = document.getElementById("bill-index");
    if (!idxInput) return;
    if (db.sales.length === 0) {
        idxInput.value = "No bills";
        currentBillIndex = -1;
    } else {
        if (currentBillIndex < 0) currentBillIndex = 0;
        if (currentBillIndex >= db.sales.length) currentBillIndex = db.sales.length - 1;
        const sale = db.sales[currentBillIndex];
        idxInput.value = `#${sale.id} (${sale.date}) - ${sale.custName}`;
    }
}

function billPrev() {
    if (db.sales.length === 0) return;
    currentBillIndex--;
    if (currentBillIndex < 0) currentBillIndex = db.sales.length - 1;
    updateBillIndexDisplay();
}

function billNext() {
    if (db.sales.length === 0) return;
    currentBillIndex++;
    if (currentBillIndex >= db.sales.length) currentBillIndex = 0;
    updateBillIndexDisplay();
}

function billPrintCurrent() {
    if (db.sales.length === 0 || currentBillIndex < 0) return;
    printBill(db.sales[currentBillIndex]);
}

function billReturnCurrent() {
    if (db.sales.length === 0 || currentBillIndex < 0) return;
    const sale = db.sales[currentBillIndex];
    if (!confirm(`Return Bill #${sale.id}?`)) return;

    sale.items.forEach((line) => {
        const item = db.items.find((i) => i.id === line.id);
        if (item) item.stock += line.qty;
    });

    const cust = db.customers.find((c) => c.id === sale.custId);
    if (cust && sale.payMode === "Credit") {
        cust.bal -= sale.remaining;
        db.transactions.push({
            date: sale.date,
            type: "Return Credit",
            desc: `Return Bill #${sale.id}`,
            amt: -sale.remaining,
            relId: cust.id
        });
    }
    if (sale.payMode === "Online") {
        const bank = db.banks[0];
        if (bank) bank.bal -= sale.total;
    }

    alert("Bill returned. Stock and balances adjusted.");
    saveDB();
    renderInv();
    renderDash();
}

function billDeleteCurrent() {
    if (db.sales.length === 0 || currentBillIndex < 0) return;
    const sale = db.sales[currentBillIndex];
    if (!confirm(`Delete Bill #${sale.id} permanently?`)) return;
    db.sales.splice(currentBillIndex, 1);
    saveDB();
    if (currentBillIndex >= db.sales.length) currentBillIndex = db.sales.length - 1;
    updateBillIndexDisplay();
}

function posPrevBill() {
    billPrev();
}
function posNextBill() {
    billNext();
}

// HOLD / RECALL
function holdBill() {
    if (cart.length === 0) {
        alert("No items to hold.");
        return;
    }
    const date = document.getElementById("pos-date").value;
    const custId = parseInt(document.getElementById("pos-cust").value, 10);
    const payMode = document.getElementById("pos-mode").value;
    const remarks = document.getElementById("pos-rem").value;
    const sub = parseFloat(document.getElementById("pos-sub").innerText) || 0;
    const disc = parseFloat(document.getElementById("pos-disc").value) || 0;
    const taxPercent = parseFloat(document.getElementById("pos-tax").value) || 0;
    const fixedTax = parseFloat(document.getElementById("pos-fixed-tax").value) || 0;
    const taxAmt = sub * (taxPercent / 100) + fixedTax;
    const svc = parseFloat(document.getElementById("pos-svc").value) || 0;
    const net = sub - disc + taxAmt + svc;

    db.heldBills.push({
        id: Date.now(),
        date,
        custId,
        payMode,
        remarks,
        sub,
        disc,
        taxPercent,
        fixedTax,
        svc,
        net,
        cart: JSON.parse(JSON.stringify(cart))
    });
    saveDB();
    alert("Bill held.");
    clearPos();
}

function recallBill() {
    if (db.heldBills.length === 0) {
        alert("No held bills.");
        return;
    }
    const last = db.heldBills.pop();
    saveDB();
    document.getElementById("pos-date").value = last.date;
    document.getElementById("pos-cust").value = last.custId;
    document.getElementById("pos-mode").value = last.payMode;
    document.getElementById("pos-rem").value = last.remarks;
    document.getElementById("pos-disc").value = last.disc;
    document.getElementById("pos-tax").value = last.taxPercent;
    document.getElementById("pos-fixed-tax").value = last.fixedTax;
    document.getElementById("pos-svc").value = last.svc;
    cart = JSON.parse(JSON.stringify(last.cart));
    renderCart();
    alert("Held bill recalled.");
}

// PURCHASES
function filterPurchaseList() {
    const q = document.getElementById("pur-search").value.toLowerCase();
    const res = db.items.filter(
        (i) =>
            i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    );
    const tb = document.getElementById("pur-search-body");
    tb.innerHTML = "";
    res.slice(0, 50).forEach((i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${i.code}</td>
      <td>${i.name}</td>
      <td class="text-right">${format(i.cost)}</td>
      <td class="text-right">${i.stock}</td>
      <td><button class="btn btn-sm" data-add-pur="${i.id}">+</button></td>
    `;
        tb.appendChild(tr);
    });
}

function addToPurchase(id) {
    const item = db.items.find((i) => i.id === id);
    if (!item) return;
    const exist = purchaseCart.find((p) => p.id === id);
    if (exist) exist.qty++;
    else purchaseCart.push({ id: item.id, name: item.name, cost: item.cost, qty: 1 });
    renderPurchaseCart();
}

function renderPurchaseCart() {
    const tb = document.getElementById("pur-body");
    tb.innerHTML = "";
    let total = 0;
    purchaseCart.forEach((p, idx) => {
        const lineTotal = p.qty * p.cost;
        total += lineTotal;
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${p.name}</td>
      <td><input type="number" value="${p.qty}" style="width:60px" data-pur-qty="${idx}"></td>
      <td class="text-right">${format(p.cost)}</td>
      <td class="text-right">${format(lineTotal)}</td>
      <td><button class="btn btn-danger btn-sm" data-pur-del="${idx}">x</button></td>
    `;
        tb.appendChild(tr);
    });
    document.getElementById("pur-total").innerText = format(total);
}

function updatePurchaseCart(idx, qty) {
    if (qty < 1) qty = 1;
    purchaseCart[idx].qty = parseFloat(qty);
    renderPurchaseCart();
}

function remPurchaseCart(idx) {
    purchaseCart.splice(idx, 1);
    renderPurchaseCart();
}

function savePurchase() {
    if (purchaseCart.length === 0) {
        alert("No purchase items.");
        return;
    }
    const date = document.getElementById("pur-date").value;
    const supId = parseInt(document.getElementById("pur-sup").value, 10);
    const sup = db.suppliers.find((s) => s.id === supId);
    const total = parseFloat(document.getElementById("pur-total").innerText) || 0;

    purchaseCart.forEach((p) => {
        const item = db.items.find((i) => i.id === p.id);
        if (item) {
            item.stock += p.qty;
            item.cost = p.cost;
        }
    });

    const purchase = {
        id: Date.now(),
        date,
        supId,
        supName: sup ? sup.name : "",
        items: JSON.parse(JSON.stringify(purchaseCart)),
        total
    };
    db.purchases.push(purchase);

    if (sup) {
        sup.bal = (sup.bal || 0) + total;
    }

    saveDB();
    alert("Purchase saved.");
    purchaseCart = [];
    renderPurchaseCart();
    renderInv();
}

function printPurchaseReport() {
    const data = db.purchases;
    let sum = 0;
    const rows = data
        .map((p) => {
            sum += p.total;
            return `
        <tr>
          <td>${p.date}</td>
          <td>${p.id}</td>
          <td>${p.supName}</td>
          <td>${format(p.total)}</td>
        </tr>`;
        })
        .join("");
    const zone = document.getElementById("print-zone");
    zone.innerHTML = `
    <div class="print-header">
      ${db.info.logo ? `<img src="${db.info.logo}">` : ""}
      <h2>${db.info.name}</h2>
      <p>${db.info.addr}</p>
      <hr>
      <h3>Purchase Report</h3>
    </div>
    <table class="print-table">
      <thead>
        <tr><th>Date</th><th>PO #</th><th>Supplier</th><th>Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><th colspan="3">Grand Total</th><th>${format(sum)}</th></tr>
      </tfoot>
    </table>
  `;
    window.print();
    setTimeout(() => (zone.innerHTML = ""), 1000);
}

// INVENTORY
function renderInv() {
    const q = (document.getElementById("inv-search").value || "").toLowerCase();
    const tb = document.getElementById("inv-body");
    tb.innerHTML = "";
    let totalValue = 0;

    db.items
        .filter((i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q))
        .forEach((i) => {
            const value = i.cost * i.stock;
            totalValue += value;
            const tr = document.createElement("tr");
            const allowEdit = currentRole === "admin";
            tr.innerHTML = `
        <td>${i.code}</td>
        <td>${i.name}</td>
        <td>${i.loc || ""}</td>
        <td class="text-right">${format(i.cost)}</td>
        <td class="text-right">${format(i.price)}</td>
        <td>${i.u1}</td>
        <td class="text-right" style="${
                i.stock <= (i.alert || 5) ? "color:red;font-weight:bold" : ""
            }">${i.stock}</td>
        <td>
          ${
                allowEdit
                    ? `<button class="btn btn-sm" data-edit-item="${i.id}">
                  <i class="fa fa-pen"></i>
                 </button>
                 <button class="btn btn-sm btn-danger" data-del-item="${i.id}">
                  <i class="fa fa-trash"></i>
                 </button>`
                    : `<span class="small-muted">View only</span>`
            }
        </td>
      `;
            tb.appendChild(tr);
        });
    document.getElementById("inv-stock-total").innerText = format(totalValue);
}

function newItem() {
    if (currentRole !== "admin") {
        alert("Only admin can add items.");
        return;
    }
    document.getElementById("mi-id").value = "";
    document.getElementById("mi-code").value = "";
    document.getElementById("mi-name").value = "";
    document.getElementById("mi-cost").value = "";
    document.getElementById("mi-price").value = "";
    document.getElementById("mi-stock").value = "";
    document.getElementById("mi-loc").value = "";
    document.getElementById("mi-u1").value = "Pcs";
    document.getElementById("mi-u2").value = "Pcs";
    document.getElementById("mi-conv").value = 1;
    document.getElementById("mi-alert").value = 5;
    modal("m-item");
}

function editItem(id) {
    if (currentRole !== "admin") {
        alert("Only admin can edit items.");
        return;
    }
    const i = db.items.find((x) => x.id === id);
    if (!i) return;
    document.getElementById("mi-id").value = i.id;
    document.getElementById("mi-code").value = i.code;
    document.getElementById("mi-name").value = i.name;
    document.getElementById("mi-cost").value = i.cost;
    document.getElementById("mi-price").value = i.price;
    document.getElementById("mi-stock").value = i.stock;
    document.getElementById("mi-loc").value = i.loc;
    document.getElementById("mi-u1").value = i.u1;
    document.getElementById("mi-u2").value = i.u2;
    document.getElementById("mi-conv").value = i.conv;
    document.getElementById("mi-alert").value = i.alert || 5;
    modal("m-item");
}

function saveItem() {
    if (currentRole !== "admin") {
        alert("Only admin can save items.");
        return;
    }
    const id = document.getElementById("mi-id").value;
    const code = document.getElementById("mi-code").value.trim();
    const name = document.getElementById("mi-name").value.trim();
    const costStr = document.getElementById("mi-cost").value;
    const priceStr = document.getElementById("mi-price").value;
    const stockStr = document.getElementById("mi-stock").value;
    const loc = document.getElementById("mi-loc").value.trim();
    const u1 = document.getElementById("mi-u1").value;
    const u2 = document.getElementById("mi-u2").value;
    const convStr = document.getElementById("mi-conv").value;
    const alertLvStr = document.getElementById("mi-alert").value;

    if (!name) {
        alert("Name required");
        return;
    }
    if (!code) {
        alert("Barcode required");
        return;
    }

    // numeric validation (price/cost must be float or int)
    const cost = parseFloat(costStr);
    const price = parseFloat(priceStr);
    const stock = parseFloat(stockStr);
    const conv = parseFloat(convStr);
    const alertLv = parseFloat(alertLvStr);

    if (isNaN(cost) || isNaN(price)) {
        alert("Cost and price must be numbers.");
        return;
    }
    if (isNaN(stock)) {
        alert("Stock must be a number.");
        return;
    }

    // uniqueness for name + barcode
    const normalizedName = name.toLowerCase();
    const normalizedCode = code.toLowerCase();
    const duplicate = db.items.find(
        (x) =>
            x.id != id &&
            (x.name.toLowerCase() === normalizedName ||
                (x.code && x.code.toLowerCase() === normalizedCode))
    );
    if (duplicate) {
        alert("Item with same name or barcode already exists.");
        return;
    }

    if (id) {
        const i = db.items.find((x) => x.id == id);
        i.code = code;
        i.name = name;
        i.cost = cost;
        i.price = price;
        i.stock = stock;
        i.loc = loc;
        i.u1 = u1;
        i.u2 = u2;
        i.conv = isNaN(conv) ? 1 : conv;
        i.alert = isNaN(alertLv) ? 5 : alertLv;
    } else {
        db.items.push({
            id: Date.now(),
            code,
            name,
            cost,
            price,
            stock,
            loc,
            u1,
            u2,
            conv: isNaN(conv) ? 1 : conv,
            alert: isNaN(alertLv) ? 5 : alertLv
        });
    }
    saveDB();
    closeModal("m-item");
    renderInv();
    renderPosItems();
}

function delItem(id) {
    if (currentRole !== "admin") {
        alert("Only admin can delete items.");
        return;
    }
    if (!confirm("Delete item?")) return;
    db.items = db.items.filter((i) => i.id !== id);
    saveDB();
    renderInv();
    renderPosItems();
}

// CONTACTS / BANK / EXPENSE / HR
function saveContact(type, prefix) {
    const name = document.getElementById(`${prefix}-name`).value.trim();
    const phone = document.getElementById(`${prefix}-phone`).value.trim();
    if (!name) {
        alert("Name required");
        return;
    }
    let arr;
    if (type === "customers") {
        const opening = parseFloat(document.getElementById("mc-opening").value) || 0;
        const ctype = document.getElementById("mc-type").value;
        arr = db.customers;
        arr.push({
            id: Date.now(),
            name,
            phone,
            bal: opening,
            opening,
            type: ctype
        });
    } else {
        arr = db.suppliers;
        arr.push({ id: Date.now(), name, phone, bal: 0 });
    }
    saveDB();
    closeModal(type === "customers" ? "m-cust" : "m-sup");
    renderSelectors();
    renderLedgers();
}

function saveBank() {
    const name = document.getElementById("mb-name").value.trim();
    const acc = document.getElementById("mb-acc").value.trim();
    const bal = parseFloat(document.getElementById("mb-bal").value) || 0;
    if (!name) {
        alert("Bank name required");
        return;
    }
    db.banks.push({ id: Date.now(), name, acc, bal });
    saveDB();
    closeModal("m-bank");
    renderBanks();
    renderSelectors();
}

function delBank(id) {
    if (!confirm("Delete bank?")) return;
    db.banks = db.banks.filter((b) => b.id !== id);
    saveDB();
    renderBanks();
    renderSelectors();
}

function saveBankTx() {
    const date = document.getElementById("bt-date").value;
    const bankId = parseInt(document.getElementById("bt-bank").value, 10);
    const type = document.getElementById("bt-type").value;
    const amt = parseFloat(document.getElementById("bt-amt").value) || 0;
    const bank = db.banks.find((b) => b.id === bankId);
    if (!bank) {
        alert("Select bank.");
        return;
    }
    if (amt <= 0) {
        alert("Amount must be > 0");
        return;
    }
    let signAmt = amt;
    if (type === "Withdraw") signAmt = -amt;

    bank.bal += signAmt;
    db.bankTx.push({ id: Date.now(), date, bankId, type, amt: signAmt });
    saveDB();
    closeModal("m-bank-tx");
    renderBanks();
    renderBankReport();
}

function saveExpense() {
    const date = document.getElementById("me-date").value;
    const cat = document.getElementById("me-cat").value.trim();
    const desc = document.getElementById("me-desc").value.trim();
    const amt = parseFloat(document.getElementById("me-amt").value) || 0;
    db.expenses.push({ id: Date.now(), date, cat, desc, amt });
    saveDB();
    closeModal("m-exp");
    renderExpenses();
    renderDash();
}

function delExpense(id) {
    if (!confirm("Delete expense?")) return;
    db.expenses = db.expenses.filter((e) => e.id !== id);
    saveDB();
    renderExpenses();
    renderDash();
}

function saveEmployee() {
    const id = document.getElementById("me-id").value;
    const name = document.getElementById("me-name").value.trim();
    const role = document.getElementById("me-role").value.trim();
    if (!name) {
        alert("Name required");
        return;
    }
    if (id) {
        const e = db.employees.find((x) => x.id == id);
        if (e) {
            e.name = name;
            e.role = role;
        }
    } else {
        db.employees.push({ id: Date.now(), name, role });
    }
    saveDB();
    closeModal("m-emp");
    renderHR();
    renderSelectors();
}

function delEmployee(id) {
    if (!confirm("Delete employee?")) return;
    db.employees = db.employees.filter((e) => e.id !== id);
    saveDB();
    renderHR();
    renderSelectors();
}

function saveAttendance() {
    const date = document.getElementById("att-date").value;
    const empId = parseInt(document.getElementById("att-emp").value, 10);
    const status = document.getElementById("att-status").value;
    const shift = document.getElementById("att-shift").value;
    db.attendance.push({ id: Date.now(), date, empId, status, shift });
    saveDB();
    closeModal("m-att");
}

function printAttendanceReport() {
    const start = document.getElementById("att-rpt-start").value || null;
    const end = document.getElementById("att-rpt-end").value || null;
    const empIdFilter = parseInt(document.getElementById("att-rpt-emp").value || 0, 10);

    const data = db.attendance.filter((a) => {
        if (start && a.date < start) return false;
        if (end && a.date > end) return false;
        if (empIdFilter && a.empId !== empIdFilter) return false;
        return true;
    });

    const zone = document.getElementById("print-zone");
    const rows = data
        .map((a) => {
            const emp = db.employees.find((e) => e.id === a.empId);
            return `
        <tr>
          <td>${a.date}</td>
          <td>${emp ? emp.name : ""}</td>
          <td>${a.status}</td>
          <td>${a.shift}</td>
        </tr>`;
        })
        .join("");
    zone.innerHTML = `
    <div class="print-header">
      ${db.info.logo ? `<img src="${db.info.logo}">` : ""}
      <h2>${db.info.name}</h2>
      <p>${db.info.addr}</p>
      <hr>
      <h3>Attendance Report</h3>
    </div>
    <table class="print-table">
      <thead>
        <tr><th>Date</th><th>Employee</th><th>Status</th><th>Shift</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
    window.print();
    setTimeout(() => (zone.innerHTML = ""), 1000);
}

function renderAttendanceSummary() {
    const start = document.getElementById("att-rpt-start").value || null;
    const end = document.getElementById("att-rpt-end").value || null;
    const empIdFilter = parseInt(document.getElementById("att-rpt-emp").value || 0, 10);
    const body = document.getElementById("att-rpt-body");
    body.innerHTML = "";

    const stats = {};
    db.employees.forEach((e) => {
        stats[e.id] = { empName: e.name, Present: 0, Absent: 0, Late: 0, Leave: 0 };
    });

    db.attendance.forEach((a) => {
        if (start && a.date < start) return;
        if (end && a.date > end) return;
        if (empIdFilter && a.empId !== empIdFilter) return;
        const s = stats[a.empId];
        if (!s) return;
        if (!s[a.status]) s[a.status] = 0;
        s[a.status]++;
    });

    Object.values(stats).forEach((s) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${s.empName}</td>
      <td class="text-right">${s.Present || 0}</td>
      <td class="text-right">${s.Absent || 0}</td>
      <td class="text-right">${s.Late || 0}</td>
      <td class="text-right">${s.Leave || 0}</td>
    `;
        body.appendChild(tr);
    });
}

// SELECTOR RENDERERS
function renderSelectors() {
    const cSel = document.getElementById("pos-cust");
    if (cSel) {
        cSel.innerHTML = "";
        db.customers.forEach((c) => cSel.add(new Option(c.name, c.id)));
    }
    const csSel = document.getElementById("led-credit-cust");
    if (csSel) {
        csSel.innerHTML = "";
        db.customers.forEach((c) => csSel.add(new Option(c.name, c.id)));
    }
    const cpSel = document.getElementById("cp-cust");
    if (cpSel) {
        cpSel.innerHTML = "";
        db.customers.forEach((c) => cpSel.add(new Option(c.name, c.id)));
    }
    const supSel = document.getElementById("pur-sup");
    if (supSel) {
        supSel.innerHTML = "";
        db.suppliers.forEach((s) => supSel.add(new Option(s.name, s.id)));
    }
    const ledSup = document.getElementById("led-sup-select");
    if (ledSup) {
        ledSup.innerHTML = "";
        db.suppliers.forEach((s) => ledSup.add(new Option(s.name, s.id)));
    }
    const spSel = document.getElementById("sp-sup");
    if (spSel) {
        spSel.innerHTML = "";
        db.suppliers.forEach((s) => spSel.add(new Option(s.name, s.id)));
    }
    const attEmp = document.getElementById("att-emp");
    if (attEmp) {
        attEmp.innerHTML = "";
        db.employees.forEach((e) => attEmp.add(new Option(e.name, e.id)));
    }
    const attRptEmp = document.getElementById("att-rpt-emp");
    if (attRptEmp) {
        attRptEmp.innerHTML = "<option value='0'>All</option>";
        db.employees.forEach((e) => attRptEmp.add(new Option(e.name, e.id)));
    }
    const bankSel = document.getElementById("bt-bank");
    if (bankSel) {
        bankSel.innerHTML = "";
        db.banks.forEach((b) => bankSel.add(new Option(b.name, b.id)));
    }
    const cpBank = document.getElementById("cp-bank");
    if (cpBank) {
        cpBank.innerHTML = "";
        db.banks.forEach((b) => cpBank.add(new Option(b.name, b.id)));
    }
    const spBank = document.getElementById("sp-bank");
    if (spBank) {
        spBank.innerHTML = "";
        db.banks.forEach((b) => spBank.add(new Option(b.name, b.id)));
    }
}

function renderExpenses() {
    const tb = document.getElementById("exp-body");
    if (!tb) return;
    tb.innerHTML = "";

    const start = document.getElementById("exp-start").value || null;
    const end = document.getElementById("exp-end").value || null;

    const data = db.expenses.filter((e) => {
        if (start && e.date < start) return false;
        if (end && e.date > end) return false;
        return true;
    });

    let total = 0;
    data.forEach((e) => {
        total += e.amt;
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${e.date}</td>
      <td>${e.cat}</td>
      <td>${e.desc}</td>
      <td class="text-right">${format(e.amt)}</td>
      <td><button class="btn btn-sm btn-danger" data-del-exp="${e.id}">x</button></td>
    `;
        tb.appendChild(tr);
    });
    document.getElementById("exp-total-footer").innerText = format(total);
}

function renderBanks() {
    const tb = document.getElementById("bank-body");
    if (!tb) return;
    tb.innerHTML = "";
    let sum = 0;
    db.banks.forEach((b) => {
        sum += b.bal;
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${b.name}</td>
      <td>${b.acc}</td>
      <td class="text-right">${format(b.bal)}</td>
      <td><button class="btn btn-sm btn-danger" data-del-bank="${b.id}">x</button></td>
    `;
        tb.appendChild(tr);
    });
    document.getElementById("bank-total-footer").innerText = format(sum);
    renderBankReport();
}

function renderBankReport() {
    const start = document.getElementById("bank-start").value || null;
    const end = document.getElementById("bank-end").value || null;
    const tb = document.getElementById("bank-tx-body");
    if (!tb) return;
    tb.innerHTML = "";

    const data = db.bankTx.filter((t) => {
        if (start && t.date < start) return false;
        if (end && t.date > end) return false;
        return true;
    });

    let total = 0;
    data.forEach((t) => {
        const bank = db.banks.find((b) => b.id === t.bankId);
        total += t.amt;
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${t.date}</td>
      <td>${bank ? bank.name : ""}</td>
      <td>${t.type}</td>
      <td class="text-right">${format(t.amt)}</td>
    `;
        tb.appendChild(tr);
    });
    document.getElementById("bank-tx-total-footer").innerText = format(total);
}

function renderHR() {
    const tb = document.getElementById("emp-body");
    if (!tb) return;
    tb.innerHTML = "";
    db.employees.forEach((e) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${e.id}</td>
      <td>${e.name}</td>
      <td>${e.role}</td>
      <td>
        <button class="btn btn-sm" data-edit-emp="${e.id}"><i class="fa fa-pen"></i></button>
        <button class="btn btn-sm btn-danger" data-del-emp="${e.id}"><i class="fa fa-trash"></i></button>
      </td>
    `;
        tb.appendChild(tr);
    });
}

function renderLedgers() {
    const custTb = document.getElementById("led-cust");
    const supTb = document.getElementById("led-sup");
    if (!custTb || !supTb) return;

    const cQ = (document.getElementById("search-cust").value || "").toLowerCase();
    custTb.innerHTML = "";
    db.customers
        .filter((c) => c.name.toLowerCase().includes(cQ))
        .forEach((c) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td>${c.name}</td>
        <td class="text-right">${format(c.bal || 0)}</td>
        <td>${c.type || ""}</td>
        <td><button class="btn btn-sm" data-del-cust="${c.id}"><i class="fa fa-trash"></i></button></td>
      `;
            custTb.appendChild(tr);
        });

    const sQ = (document.getElementById("search-sup").value || "").toLowerCase();
    supTb.innerHTML = "";
    db.suppliers
        .filter((s) => s.name.toLowerCase().includes(sQ))
        .forEach((s) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td>${s.name}</td>
        <td class="text-right">${format(s.bal || 0)}</td>
        <td><button class="btn btn-sm" data-del-sup="${s.id}"><i class="fa fa-trash"></i></button></td>
      `;
            supTb.appendChild(tr);
        });
}

function printCustomerCreditReport() {
    const custId = parseInt(document.getElementById("led-credit-cust").value, 10);
    const start = document.getElementById("led-rpt-start").value || null;
    const end = document.getElementById("led-rpt-end").value || null;
    const cust = db.customers.find((c) => c.id === custId);

    const rows = db.sales
        .filter((s) => s.custId === custId)
        .filter((s) => (!start || s.date >= start) && (!end || s.date <= end))
        .map((s) => {
            const itemsText = s.items
                .map((i) => `${i.name} x${i.qty}=${format(i.qty * i.price)}`)
                .join(", ");
            return `
      <tr>
        <td>${s.date}</td>
        <td>${s.id}</td>
        <td>${itemsText}</td>
        <td>${format(s.total)}</td>
        <td>${format(s.received)}</td>
        <td>${format(s.remaining)}</td>
      </tr>`;
        })
        .join("");

    const totalBill = db.sales
        .filter((s) => s.custId === custId)
        .filter((s) => (!start || s.date >= start) && (!end || s.date <= end))
        .reduce((sum, s) => sum + s.total, 0);
    const totalReceived = db.sales
        .filter((s) => s.custId === custId)
        .filter((s) => (!start || s.date >= start) && (!end || s.date <= end))
        .reduce((sum, s) => sum + s.received, 0);
    const totalRem = totalBill - totalReceived;

    const zone = document.getElementById("print-zone");
    zone.innerHTML = `
    <div class="print-header">
      ${db.info.logo ? `<img src="${db.info.logo}">` : ""}
      <h2>${db.info.name}</h2>
      <p>${db.info.addr}</p>
      <hr>
      <h3>Customer Credit Report - ${cust ? cust.name : ""}</h3>
    </div>
    <table class="print-table">
      <thead>
        <tr>
          <th>Date</th><th>Bill #</th><th>Items</th><th>Total</th><th>Received</th><th>Remaining</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <th colspan="3">Totals</th>
          <th>${format(totalBill)}</th>
          <th>${format(totalReceived)}</th>
          <th>${format(totalRem)}</th>
        </tr>
      </tfoot>
    </table>
  `;
    window.print();
    setTimeout(() => (zone.innerHTML = ""), 1000);
}

function printSupplierReport() {
    const supId = parseInt(document.getElementById("led-sup-select").value, 10);
    const start = document.getElementById("led-sup-start").value || null;
    const end = document.getElementById("led-sup-end").value || null;
    const sup = db.suppliers.find((s) => s.id === supId);

    const filtered = db.purchases
        .filter((p) => p.supId === supId)
        .filter((p) => (!start || p.date >= start) && (!end || p.date <= end));

    let total = 0;
    const rows = filtered
        .map((p) => {
            total += p.total;
            const itemsText = p.items
                .map((i) => `${i.name} x${i.qty}=${format(i.qty * i.cost)}`)
                .join(", ");
            return `
      <tr>
        <td>${p.date}</td>
        <td>${p.id}</td>
        <td>${itemsText}</td>
        <td>${format(p.total)}</td>
      </tr>`;
        })
        .join("");

    const zone = document.getElementById("print-zone");
    zone.innerHTML = `
    <div class="print-header">
      ${db.info.logo ? `<img src="${db.info.logo}">` : ""}
      <h2>${db.info.name}</h2>
      <p>${db.info.addr}</p>
      <hr>
      <h3>Supplier Report - ${sup ? sup.name : ""}</h3>
    </div>
    <table class="print-table">
      <thead>
        <tr><th>Date</th><th>PO #</th><th>Items</th><th>Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><th colspan="3">Total</th><th>${format(total)}</th></tr>
      </tfoot>
    </table>
  `;
    window.print();
    setTimeout(() => (zone.innerHTML = ""), 1000);
}

// CUSTOMER / SUPPLIER DELETE
function delCustomer(id) {
    if (!confirm("Delete customer?")) return;
    db.customers = db.customers.filter((c) => c.id !== id);
    saveDB();
    renderSelectors();
    renderLedgers();
}

function delSupplier(id) {
    if (!confirm("Delete supplier?")) return;
    db.suppliers = db.suppliers.filter((s) => s.id !== id);
    saveDB();
    renderSelectors();
    renderLedgers();
}

// SETTINGS / RESET
function toggleFixedTaxSettings() {
    const mode = document.getElementById("set-tax-mode").value;
    const el = document.getElementById("fixed-tax-settings");
    el.style.display = mode === "fixed" ? "block" : "none";
}

function saveSettings() {
    db.info.name = document.getElementById("set-name").value;
    db.info.addr = document.getElementById("set-addr").value;
    db.info.logo = document.getElementById("set-logo").value;
    db.settings = {
        taxMode: document.getElementById("set-tax-mode").value,
        fixedTax: parseFloat(document.getElementById("set-fixed-tax").value) || 0,
        taxPercent: parseFloat(document.getElementById("set-tax-percent").value) || 0
    };
    saveDB();
    alert("Settings Saved");
    location.reload();
}

function hardReset() {
    if (currentRole !== "admin") {
        alert("Only admin can reset.");
        return;
    }
    const pass = prompt("Type password to confirm (1234):");
    if (pass !== "1234") {
        alert("Incorrect");
        return;
    }
    db = {
        info: { name: "Company Name", addr: "Address", logo: "" },
        items: [],
        customers: [
            { id: 1, name: "Walk-in", phone: "", bal: 0, opening: 0, type: "Walk-in" }
        ],
        suppliers: [],
        sales: [],
        expenses: [],
        banks: [],
        bankTx: [],
        heldBills: [],
        purchases: [],
        transactions: [],
        employees: [],
        attendance: [],
        miscProfits: [],
        settings: { taxMode: "percent", fixedTax: 0, taxPercent: 0 },
        role: "employee"
    };
    saveDB();
    location.reload();
}

// CUSTOMER DISPLAY
function toggleCustomerDisplay() {
    customerDisplayOn = !customerDisplayOn;
    document
        .getElementById("customer-display")
        .classList.toggle("hidden", !customerDisplayOn);
    if (customerDisplayOn) updateCustomerDisplay();
}

function updateCustomerDisplay() {
    if (!customerDisplayOn) return;
    const itemsDiv = document.getElementById("cust-d-items");
    const summaryDiv = document.getElementById("cust-d-summary");
    const payDiv = document.getElementById("cust-d-pay");
    const typeDiv = document.getElementById("cust-d-type");

    const custId = parseInt(document.getElementById("pos-cust").value, 10);
    const cust = db.customers.find((c) => c.id === custId);
    typeDiv.innerHTML = `
    <p>Customer: <strong>${cust ? cust.name : ""}</strong></p>
    <p>Type: ${cust ? cust.type : ""}</p>
    <p>Credit Balance: ${format(cust ? cust.bal || 0 : 0)}</p>
  `;

    let html = "<table style='width:100%;border-collapse:collapse;font-size:12px;'>";
    html +=
        "<tr><th style='text-align:left;border-bottom:1px solid #64748b;'>Item</th><th style='border-bottom:1px solid #64748b;'>Qty</th><th style='border-bottom:1px solid #64748b;'>Price</th><th style='border-bottom:1px solid #64748b;'>Total</th></tr>";
    let sub = 0;
    cart.forEach((c) => {
        const t = c.qty * c.price;
        sub += t;
        html += `<tr><td>${c.name}</td><td style='text-align:center;'>${c.qty}</td><td style='text-align:right;'>${format(
            c.price
        )}</td><td style='text-align:right;'>${format(t)}</td></tr>`;
    });
    html += "</table>";
    itemsDiv.innerHTML = html;

    const disc = parseFloat(document.getElementById("pos-disc").value) || 0;
    const taxPercent = parseFloat(document.getElementById("pos-tax").value) || 0;
    const fixedTax = parseFloat(document.getElementById("pos-fixed-tax").value) || 0;
    const svc = parseFloat(document.getElementById("pos-svc").value) || 0;
    let taxAmt = sub * (taxPercent / 100) + fixedTax;
    const net = sub - disc + taxAmt + svc;

    summaryDiv.innerHTML = `
    <p>Subtotal: ${format(sub)}</p>
    <p>Discount: ${format(disc)}</p>
    <p>Tax: ${format(taxAmt)}</p>
    <p>Service: ${format(svc)}</p>
    <h3>Total: ${format(net)}</h3>
  `;

    const mode = document.getElementById("pos-mode").value;
    payDiv.innerHTML = `<p>Payment Mode: <strong>${mode}</strong></p>`;
}

// CUSTOMER / SUPPLIER PAYMENTS (LEDGER)
function openCustPayModal() {
    document.getElementById("cp-date").valueAsDate = new Date();
    // ensure selectors already filled
    modal("m-cust-pay");
}

function openSupPayModal() {
    document.getElementById("sp-date").valueAsDate = new Date();
    modal("m-sup-pay");
}

function saveCustPayment() {
    const custId = parseInt(document.getElementById("cp-cust").value, 10);
    const date = document.getElementById("cp-date").value;
    const amt = parseFloat(document.getElementById("cp-amt").value) || 0;
    const mode = document.getElementById("cp-mode").value;
    const bankId = parseInt(document.getElementById("cp-bank").value || 0, 10);
    if (amt <= 0) {
        alert("Amount must be > 0");
        return;
    }
    const cust = db.customers.find((c) => c.id === custId);
    if (!cust) {
        alert("Select customer");
        return;
    }
    cust.bal -= amt;
    db.transactions.push({
        date,
        type: "Credit Receive",
        desc: "Manual receive",
        amt: -amt,
        relId: cust.id
    });
    if (mode === "Online") {
        const bank = db.banks.find((b) => b.id === bankId);
        if (bank) {
            bank.bal += amt;
            db.bankTx.push({ id: Date.now(), date, bankId: bank.id, type: "Deposit", amt });
        }
    }
    saveDB();
    closeModal("m-cust-pay");
    renderLedgers();
    renderBanks();
}

function saveSupPayment() {
    const supId = parseInt(document.getElementById("sp-sup").value, 10);
    const date = document.getElementById("sp-date").value;
    const amt = parseFloat(document.getElementById("sp-amt").value) || 0;
    const mode = document.getElementById("sp-mode").value;
    const bankId = parseInt(document.getElementById("sp-bank").value || 0, 10);
    if (amt <= 0) {
        alert("Amount must be > 0");
        return;
    }
    const sup = db.suppliers.find((s) => s.id === supId);
    if (!sup) {
        alert("Select supplier");
        return;
    }
    sup.bal = (sup.bal || 0) - amt;
    if (mode === "Online") {
        const bank = db.banks.find((b) => b.id === bankId);
        if (bank) {
            bank.bal -= amt;
            db.bankTx.push({ id: Date.now(), date, bankId: bank.id, type: "Withdraw", amt: -amt });
        }
    }
    saveDB();
    closeModal("m-sup-pay");
    renderLedgers();
    renderBanks();
}

// HELPERS
function modal(id) {
    document.getElementById(id).style.display = "flex";
}
function closeModal(id) {
    document.getElementById(id).style.display = "none";
}
function format(n) {
    return (parseFloat(n) || 0).toFixed(2);
}

function handleLogoFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        db.info.logo = ev.target.result;
        document.getElementById("set-logo").value = db.info.logo;
        saveDB();
    };
    reader.readAsDataURL(file);
}

function toggleBank(modeId, bankRowSelector) {
    const mode = document.getElementById(modeId).value;
    const bankRowEls = document.querySelectorAll(bankRowSelector);
    bankRowEls.forEach((el) => {
        el.classList.toggle("hidden", mode !== "Online");
    });
}

// HR WINDOW
function openHRWindow() {
    document.getElementById("hr-window").classList.remove("hidden");
}
function closeHRWindow() {
    document.getElementById("hr-window").classList.add("hidden");
}

// TOGGLES
function toggleInvTable() {
    const el = document.getElementById("inv-table-container");
    el.classList.toggle("hidden");
}
function toggleExpTable() {
    const el = document.getElementById("exp-table-container");
    el.classList.toggle("hidden");
}
function togglePurchaseCart() {
    document
        .getElementById("purchase-cart-container")
        .classList.toggle("hidden");
}
function togglePosCartPanel() {
    document
        .getElementById("pos-cart-container")
        .classList.toggle("hidden");
}
function togglePosMidPanel() {
    document.getElementById("pos-mid-panel").classList.toggle("hidden");
}

// EVENTS
function attachEvents() {
    document.getElementById("btn-switch-role").addEventListener("click", switchRole);
    document.getElementById("theme-selector").addEventListener("change", (e) =>
        setTheme(e.target.value)
    );

    // calendar button sets today's date in common date filters
    document.getElementById("calendar-btn").addEventListener("click", () => {
        const today = new Date().toISOString().slice(0, 10);
        ["rpt-start", "rpt-end", "exp-start", "exp-end", "bank-start", "bank-end"].forEach((id) => {
            const el = document.getElementById(id);
            if (el && !el.value) el.value = today;
        });
    });

    document.querySelectorAll(".ribbon-btn[data-view]").forEach((btn) => {
        btn.addEventListener("click", () => nav(btn.getAttribute("data-view")));
    });

    // POS
    document.getElementById("pos-search").addEventListener("input", filterPosList);
    document.getElementById("pos-mode").addEventListener("change", () =>
        toggleBank("pos-mode", "#pos-bank-row")
    );

    ["pos-disc", "pos-tax", "pos-fixed-tax", "pos-svc"].forEach((id) => {
        document.getElementById(id).addEventListener("input", calcPos);
    });
    document.getElementById("pos-tend").addEventListener("input", calcChange);

    document
        .getElementById("btn-save-bill")
        .addEventListener("click", () => saveOrPrint("save"));
    document
        .getElementById("btn-save-print-bill")
        .addEventListener("click", () => saveOrPrint("saveprint"));
    document
        .getElementById("btn-clear-pos")
        .addEventListener("click", clearPos);

    document
        .getElementById("btn-toggle-cust-display")
        .addEventListener("click", toggleCustomerDisplay);
    document
        .getElementById("btn-close-cust-display")
        .addEventListener("click", toggleCustomerDisplay);

    document.getElementById("btn-new-item").addEventListener("click", newItem);
    document.getElementById("inv-search").addEventListener("input", renderInv);
    document
        .getElementById("btn-save-item")
        .addEventListener("click", saveItem);

    document
        .getElementById("btn-add-cust")
        .addEventListener("click", () => modal("m-cust"));
    document
        .getElementById("btn-save-cust")
        .addEventListener("click", () => saveContact("customers", "mc"));

    document
        .getElementById("btn-add-sup")
        .addEventListener("click", () => modal("m-sup"));
    document
        .getElementById("btn-add-sup-ledger")
        .addEventListener("click", () => modal("m-sup"));
    document
        .getElementById("btn-save-sup")
        .addEventListener("click", () => saveContact("suppliers", "ms"));

    document
        .getElementById("btn-add-bank")
        .addEventListener("click", () => modal("m-bank"));
    document
        .getElementById("btn-save-bank")
        .addEventListener("click", saveBank);

    document
        .getElementById("btn-add-bank-tx")
        .addEventListener("click", () => modal("m-bank-tx"));
    document
        .getElementById("btn-save-bank-tx")
        .addEventListener("click", saveBankTx);
    document
        .getElementById("btn-bank-rpt")
        .addEventListener("click", renderBankReport);

    document
        .getElementById("btn-add-exp")
        .addEventListener("click", () => modal("m-exp"));
    document
        .getElementById("btn-save-exp")
        .addEventListener("click", saveExpense);
    document
        .getElementById("btn-exp-filter")
        .addEventListener("click", renderExpenses);

    document
        .getElementById("btn-open-hr-window")
        .addEventListener("click", openHRWindow);
    document
        .getElementById("hr-close-btn")
        .addEventListener("click", closeHRWindow);

    document
        .getElementById("btn-save-emp")
        .addEventListener("click", saveEmployee);

    document
        .getElementById("btn-mark-att")
        .addEventListener("click", () => modal("m-att"));
    document
        .getElementById("btn-save-att")
        .addEventListener("click", saveAttendance);

    document
        .getElementById("btn-print-att-report")
        .addEventListener("click", printAttendanceReport);
    document
        .getElementById("btn-view-att-report")
        .addEventListener("click", renderAttendanceSummary);

    document
        .getElementById("btn-save-settings")
        .addEventListener("click", saveSettings);
    document
        .getElementById("btn-hard-reset")
        .addEventListener("click", hardReset);

    document
        .getElementById("set-logo-file")
        .addEventListener("change", handleLogoFileChange);

    // Dashboard reports
    document.querySelectorAll("[data-rpt-view]").forEach((btn) => {
        btn.addEventListener("click", () => viewReport(btn.getAttribute("data-rpt-view")));
    });
    document.querySelectorAll("[data-rpt-print]").forEach((btn) => {
        btn.addEventListener("click", () => printReport(btn.getAttribute("data-rpt-print")));
    });
    document.getElementById("rpt-start").addEventListener("change", renderDash);
    document.getElementById("rpt-end").addEventListener("change", renderDash);

    // Bill nav
    document.getElementById("btn-bill-prev").addEventListener("click", billPrev);
    document.getElementById("btn-bill-next").addEventListener("click", billNext);
    document
        .getElementById("btn-bill-reprint")
        .addEventListener("click", billPrintCurrent);
    document
        .getElementById("btn-bill-return")
        .addEventListener("click", billReturnCurrent);
    document
        .getElementById("btn-bill-delete")
        .addEventListener("click", billDeleteCurrent);

    document
        .getElementById("btn-pos-prev-bill")
        .addEventListener("click", posPrevBill);
    document
        .getElementById("btn-pos-next-bill")
        .addEventListener("click", posNextBill);

    // Hold / Recall
    document.getElementById("btn-hold-bill").addEventListener("click", holdBill);
    document.getElementById("btn-recall-bill").addEventListener("click", recallBill);

    // POS tables
    document.getElementById("pos-search-body").addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-add-cart");
        if (id) addToCart(parseInt(id, 10));
    });
    document.getElementById("pos-body").addEventListener("input", (e) => {
        const idx = e.target.getAttribute("data-cart-qty");
        if (idx !== null) updateCart(parseInt(idx, 10), parseFloat(e.target.value));
    });
    document.getElementById("pos-body").addEventListener("click", (e) => {
        const idx = e.target.getAttribute("data-cart-del");
        if (idx !== null) remCart(parseInt(idx, 10));
    });

    // Purchase
    document.getElementById("pur-search").addEventListener("input", filterPurchaseList);
    document.getElementById("btn-save-purchase").addEventListener("click", savePurchase);
    document
        .getElementById("btn-print-purchase-report")
        .addEventListener("click", printPurchaseReport);
    document.getElementById("pur-search-body").addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-add-pur");
        if (id) addToPurchase(parseInt(id, 10));
    });
    document.getElementById("pur-body").addEventListener("input", (e) => {
        const idx = e.target.getAttribute("data-pur-qty");
        if (idx !== null) updatePurchaseCart(parseInt(idx, 10), parseFloat(e.target.value));
    });
    document.getElementById("pur-body").addEventListener("click", (e) => {
        const idx = e.target.getAttribute("data-pur-del");
        if (idx !== null) remPurchaseCart(parseInt(idx, 10));
    });

    // Ledgers
    document
        .getElementById("search-cust")
        .addEventListener("input", renderLedgers);
    document
        .getElementById("search-sup")
        .addEventListener("input", renderLedgers);
    document
        .getElementById("btn-print-cust-credit-report")
        .addEventListener("click", printCustomerCreditReport);
    document
        .getElementById("btn-print-sup-report")
        .addEventListener("click", printSupplierReport);

    document
        .getElementById("btn-ledger-receive")
        .addEventListener("click", openCustPayModal);
    document
        .getElementById("btn-ledger-pay-sup")
        .addEventListener("click", openSupPayModal);
    document
        .getElementById("btn-save-cust-pay")
        .addEventListener("click", saveCustPayment);
    document
        .getElementById("btn-save-sup-pay")
        .addEventListener("click", saveSupPayment);

    document.getElementById("cp-mode").addEventListener("change", () =>
        toggleBank("cp-mode", ".cp-bank-row")
    );
    document.getElementById("sp-mode").addEventListener("change", () =>
        toggleBank("sp-mode", ".sp-bank-row")
    );

    // HR / Expenses / Banks / Ledgers delete/edit
    document.getElementById("emp-body").addEventListener("click", (e) => {
        const editId = e.target.getAttribute("data-edit-emp");
        const delId = e.target.getAttribute("data-del-emp");
        if (editId) {
            const emp = db.employees.find((x) => x.id == editId);
            if (!emp) return;
            document.getElementById("me-id").value = emp.id;
            document.getElementById("me-name").value = emp.name;
            document.getElementById("me-role").value = emp.role;
            modal("m-emp");
        }
        if (delId) delEmployee(parseInt(delId, 10));
    });

    document.getElementById("exp-body").addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-del-exp");
        if (id) delExpense(parseInt(id, 10));
    });

    document.getElementById("bank-body").addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-del-bank");
        if (id) delBank(parseInt(id, 10));
    });

    document.getElementById("led-cust").addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-del-cust");
        if (id) delCustomer(parseInt(id, 10));
    });

    document.getElementById("led-sup").addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-del-sup");
        if (id) delSupplier(parseInt(id, 10));
    });

    document.getElementById("inv-body").addEventListener("click", (e) => {
        const edit = e.target.getAttribute("data-edit-item");
        const del = e.target.getAttribute("data-del-item");
        if (edit) editItem(parseInt(edit, 10));
        if (del) delItem(parseInt(del, 10));
    });

    // Attendance filters
    document
        .getElementById("att-rpt-start")
        .addEventListener("change", renderAttendanceSummary);
    document
        .getElementById("att-rpt-end")
        .addEventListener("change", renderAttendanceSummary);
    document
        .getElementById("att-rpt-emp")
        .addEventListener("change", renderAttendanceSummary);

    // Toggles
    document
        .getElementById("toggle-inv-table")
        .addEventListener("click", toggleInvTable);
    document
        .getElementById("toggle-exp-table")
        .addEventListener("click", toggleExpTable);
    document
        .getElementById("toggle-purchase-cart")
        .addEventListener("click", togglePurchaseCart);
    document
        .getElementById("pos-toggle-cart-inner")
        .addEventListener("click", togglePosCartPanel);
    document
        .getElementById("pos-toggle-cart")
        .addEventListener("click", togglePosCartPanel);
    document
        .getElementById("pos-toggle-search")
        .addEventListener("click", togglePosMidPanel);

    // Close modals
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
        btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close-modal")));
    });
}
