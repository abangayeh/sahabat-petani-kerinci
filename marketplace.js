// ==========================================
// SAHABAT PETANI KERINCI - MARKETPLACE JS
// ==========================================

const API = "/api";

let currentUser = null;
let products = [];
let favorites = [];

// Elemen bantu
const $ = (selector) => document.querySelector(selector);

const formatRupiah = (value) =>
new Intl.NumberFormat("id-ID", {
style: "currency",
currency: "IDR",
maximumFractionDigits: 0
}).format(Number(value) || 0);

const escapeHTML = (value = "") =>
String(value).replace(/[&<>"']/g, (char) => ({
"&": "&",
"<": "<",
">": ">",
'"': """,
"'": "'"
})[char]);

async function api(url, options = {}) {
const response = await fetch(API + url, {
credentials: "same-origin",
...options,
headers: {
...(options.body ? { "Content-Type": "application/json" } : {}),
...options.headers
}
});

const data = await response.json().catch(() => ({}));

if (!response.ok) {
throw new Error(data.error || "Terjadi kesalahan.");
}

return data;
}

function showMessage(message, type = "info") {
let box = $("#marketplace-message");

if (!box) {
box = document.createElement("div");
box.id = "marketplace-message";
box.className = "status-message";
document.querySelector("main")?.prepend(box);
}

if (box) {
box.textContent = message;
box.dataset.type = type;
box.style.display = "block";
box.scrollIntoView({ behavior: "smooth", block: "nearest" });
} else {
alert(message);
}
}

// ==========================================
// LOGIN DAN AKUN
// ==========================================

async function loadAccount() {
try {
const data = await api("/auth/me");
currentUser = data.user;
} catch {
currentUser = null;
}

renderAccount();
}

function renderAccount() {
const box = $("#account-info");
if (!box) return;

if (!currentUser) {
box.innerHTML = "<p>Silakan masuk atau daftar untuk menggunakan marketplace.</p>";
return;
}

box.innerHTML = "<h3>Halo, ${escapeHTML(currentUser.name)}</h3> <p>${escapeHTML(currentUser.email)}</p> <p>Status akun: <strong>${escapeHTML(currentUser.role)}</strong></p> ${ currentUser.role === "buyer" ?"<button type="button" id="become-seller">Mulai Berjualan</button>": "" } <button type="button" id="logout-button">Keluar</button>";

$("#become-seller")?.addEventListener("click", becomeSeller);
$("#logout-button")?.addEventListener("click", logout);
}

async function loginOrRegister(event) {
event.preventDefault();

const form = event.currentTarget;
const values = Object.fromEntries(new FormData(form).entries());

const isRegister = form.dataset.mode === "register";

try {
const endpoint = isRegister
? "/auth/register"
: "/auth/login";

const data = await api(endpoint, {
  method: "POST",
  body: JSON.stringify(values)
});

currentUser = data.user;
renderAccount();
showMessage("Berhasil masuk ke akun.", "success");

await loadProducts();
await loadMyProducts();
await loadFavorites();

} catch (error) {
showMessage(error.message, "error");
}
}

async function logout() {
try {
await api("/auth/logout", { method: "POST" });
currentUser = null;
favorites = [];

renderAccount();
await loadProducts();

showMessage("Kamu sudah keluar dari akun.", "success");

} catch (error) {
showMessage(error.message, "error");
}
}

async function becomeSeller() {
try {
const data = await api("/auth/become-seller", {
method: "POST"
});

currentUser = data.user;
renderAccount();

showMessage("Akun berhasil diaktifkan sebagai penjual.", "success");

} catch (error) {
showMessage(error.message, "error");
}
}

// ==========================================
// KATALOG PRODUK
// ==========================================

async function loadProducts() {
const container = $("#product-list") || $(".product-grid");
if (!container) return;

container.innerHTML = "<p>Memuat produk...</p>";

try {
const data = await api("/products");
products = data.items || [];
renderProducts(products);
} catch (error) {
container.innerHTML = "<p>${escapeHTML(error.message)}</p>";
}
}

function renderProducts(items) {
const container = $("#product-list") || $(".product-grid");
if (!container) return;

if (!items.length) {
container.innerHTML = "<div class="empty-message"> <h3>Belum ada produk</h3> <p>Produk yang sudah disetujui akan muncul di sini.</p> </div>";
return;
}

container.innerHTML = items.map(product => `
<article class="product-card">
<div class="product-info">
<span class="product-category">
${escapeHTML(product.category)}
</span>

    <h3>${escapeHTML(product.name)}</h3>

    <p>${escapeHTML(product.description || "Tidak ada deskripsi.")}</p>

    <strong class="product-price">
      ${formatRupiah(product.price)} / ${escapeHTML(product.unit)}
    </strong>

    <p class="product-location">
      📍 ${escapeHTML(product.location || "Lokasi belum diisi")}
    </p>

    <p>Stok: ${escapeHTML(product.stock)}</p>
    <p>Penjual: ${escapeHTML(product.seller_name || "Petani")}</p>

    <button type="button"
      data-favorite="${product.id}">
      ${favorites.includes(Number(product.id)) ? "♥ Favorit" : "♡ Favorit"}
    </button>

    <button type="button"
      data-order="${product.id}">
      Pesan Produk
    </button>

    <button type="button"
      data-message="${product.seller_id}">
      Hubungi Penjual
    </button>
  </div>
</article>

`).join("");

container.querySelectorAll("[data-favorite]").forEach(button => {
button.addEventListener("click", () =>
toggleFavorite(button.dataset.favorite)
);
});

container.querySelectorAll("[data-order]").forEach(button => {
button.addEventListener("click", () =>
orderProduct(button.dataset.order)
);
});

container.querySelectorAll("[data-message]").forEach(button => {
button.addEventListener("click", () =>
sendMessage(button.dataset.message)
);
});
}

// ==========================================
// PENCARIAN DAN FILTER
// ==========================================

function filterProducts() {
const keyword = ($("#product-search")?.value || "")
.toLowerCase()
.trim();

const category = $("#category-filter")?.value || "";

const filtered = products.filter(product => {
const matchesKeyword =
product.name.toLowerCase().includes(keyword) ||
(product.description || "").toLowerCase().includes(keyword) ||
(product.location || "").toLowerCase().includes(keyword);

const matchesCategory =
  !category || product.category === category;

return matchesKeyword && matchesCategory;

});

renderProducts(filtered);
}

// ==========================================
// PRODUK MILIK PENJUAL
// ==========================================

async function loadMyProducts() {
const container = $("#my-products");
if (!container || !currentUser) return;

try {
const data = await api("/my-products");
const items = data.items || [];

container.innerHTML = items.length
  ? items.map(product => `
      <article class="product-card">
        <h3>${escapeHTML(product.name)}</h3>
        <p>${formatRupiah(product.price)}</p>
        <p>Status: <strong>${escapeHTML(product.status)}</strong></p>
        <button type="button" data-delete-product="${product.id}">
          Hapus Produk
        </button>
      </article>
    `).join("")
  : "<p>Kamu belum memiliki produk.</p>";

container.querySelectorAll("[data-delete-product]").forEach(button => {
  button.addEventListener("click", () =>
    deleteProduct(button.dataset.deleteProduct)
  );
});

} catch (error) {
container.textContent = error.message;
}
}

async function saveProduct(event) {
event.preventDefault();

if (!currentUser) {
showMessage("Silakan masuk terlebih dahulu.", "error");
return;
}

const form = event.currentTarget;
const values = Object.fromEntries(new FormData(form).entries());

const editId = form.dataset.editId;
const endpoint = editId
? "/products/${editId}"
: "/products";

try {
const data = await api(endpoint, {
method: editId ? "PUT" : "POST",
body: JSON.stringify(values)
});

form.reset();
delete form.dataset.editId;

showMessage(
  "Produk berhasil dikirim dan menunggu persetujuan admin.",
  "success"
);

await loadMyProducts();
await loadProducts();

} catch (error) {
showMessage(error.message, "error");
}
}

async function deleteProduct(id) {
if (!confirm("Yakin ingin menghapus produk ini?")) return;

try {
await api("/products/${id}", { method: "DELETE" });

showMessage("Produk berhasil dihapus.", "success");

await loadMyProducts();
await loadProducts();

} catch (error) {
showMessage(error.message, "error");
}
}

// ==========================================
// FAVORIT
// ==========================================

async function loadFavorites() {
if (!currentUser) return;

try {
const data = await api("/favorites");

favorites = (data.items || []).map(item => Number(item.id));

renderProducts(products);

} catch {
favorites = [];
}
}

async function toggleFavorite(id) {
if (!currentUser) {
showMessage("Masuk terlebih dahulu untuk menyimpan favorit.", "error");
return;
}

const exists = favorites.includes(Number(id));

try {
await api("/favorites${exists ? "/${id}" : ""}", {
method: exists ? "DELETE" : "POST",
...(exists ? {} : {
body: JSON.stringify({ product_id: Number(id) })
})
});

await loadFavorites();
showMessage("Favorit berhasil diperbarui.", "success");

} catch (error) {
showMessage(error.message, "error");
}
}

// ==========================================
// PEMESANAN
// ==========================================

async function orderProduct(id) {
if (!currentUser) {
showMessage("Masuk terlebih dahulu untuk memesan produk.", "error");
return;
}

const quantity = prompt("Masukkan jumlah yang ingin dipesan:");
if (quantity === null) return;

const deliveryAddress = prompt("Masukkan alamat pengiriman:");
if (!deliveryAddress) return;

const notes = prompt("Catatan pesanan (boleh dikosongkan):") || "";

try {
const data = await api("/orders", {
method: "POST",
body: JSON.stringify({
product_id: Number(id),
quantity: Number(quantity),
delivery_address: deliveryAddress,
notes
})
});

showMessage(
  `Pesanan berhasil dibuat. Nomor pesanan: ${data.order_id}. Total: ${formatRupiah(data.total)}`,
  "success"
);

} catch (error) {
showMessage(error.message, "error");
}
}

// ==========================================
// PESAN PENJUAL
// ==========================================

async function sendMessage(sellerId) {
if (!currentUser) {
showMessage("Masuk terlebih dahulu untuk menghubungi penjual.", "error");
return;
}

const message = prompt("Tulis pesan untuk penjual:");
if (!message) return;

try {
await api("/messages", {
method: "POST",
body: JSON.stringify({
receiver_id: Number(sellerId),
message
})
});

showMessage("Pesan berhasil dikirim.", "success");

} catch (error) {
showMessage(error.message, "error");
}
}

// ==========================================
// INISIALISASI
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
$("#auth-form")?.addEventListener("submit", loginOrRegister);
$("#product-form")?.addEventListener("submit", saveProduct);

$("#product-search")?.addEventListener("input", filterProducts);
$("#category-filter")?.addEventListener("change", filterProducts);

await loadAccount();
await loadProducts();

if (currentUser) {
await loadMyProducts();
await loadFavorites();
}
});
