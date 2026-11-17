// ========================================
// KONFIGURASI SUPABASE
// ========================================

const SUPABASE_URL = "https://pzgjlotpgdmbqfqouihk.supabase.co";
const SUPABASE_KEY = "sb_publishable_YVctx86LRETCyp8LFE-xPg_DRtOm2dq";

const token = localStorage.getItem("access_token");
const userData = localStorage.getItem("user");

// ========================================
// ELEMEN HALAMAN
// ========================================

const productList = document.getElementById("productList");
const sellerName = document.getElementById("sellerName");

const totalProducts = document.getElementById("totalProducts");
const pendingProducts = document.getElementById("pendingProducts");
const activeProducts = document.getElementById("activeProducts");

const addProductBtn = document.getElementById("addProductBtn");
const productFormSection = document.getElementById("productFormSection");
const productForm = document.getElementById("productForm");
const cancelProductBtn = document.getElementById("cancelProductBtn");

let currentUser = null;
let currentStoreId = null;

// ========================================
// HEADER SUPABASE
// ========================================

function supabaseHeaders() {
return {
"apikey": SUPABASE_KEY,
"Authorization": "Bearer ${token}",
"Content-Type": "application/json"
};
}

// ========================================
// FUNGSI MEMBACA RESPONS SERVER
// ========================================

async function readResponse(response, label) {
const responseText = await response.text();

if (!response.ok) {
throw new Error(
"${label} gagal. HTTP ${response.status}: ${responseText.slice(0, 500)}"
);
}

try {
return JSON.parse(responseText);
} catch (error) {
console.error("Respons ${label} bukan JSON:", responseText);

throw new Error(
  `${label} menerima respons bukan JSON. HTTP ${response.status}. Isi respons: ${responseText.slice(0, 300)}`
);

}
}

// ========================================
// CEK LOGIN DAN AKUN PENJUAL
// ========================================

if (!token || !userData) {
window.location.href = "login.html";

} else {
try {
currentUser = JSON.parse(userData);

if (!currentUser.id) {
  throw new Error("ID pengguna tidak ditemukan.");
}

if (currentUser.user_metadata?.role !== "seller") {
  alert("Halaman ini khusus untuk penjual.");
  window.location.href = "../index.html";

} else {
  sellerName.textContent =
    currentUser.user_metadata.full_name || "Penjual";

  loadProducts();
}

} catch (error) {
console.error("Kesalahan akun:", error);

localStorage.removeItem("access_token");
localStorage.removeItem("user");

window.location.href = "login.html";

}
}

// ========================================
// MENCARI TOKO MILIK PENJUAL
// ========================================

async function loadStore() {
const url =
"${SUPABASE_URL}/rest/v1/stores?select=id&owner_id=eq.${encodeURIComponent(currentUser.id)}";

console.log("Memeriksa toko:", url);

const response = await fetch(url, {
method: "GET",
headers: supabaseHeaders()
});

const stores = await readResponse(response, "Memuat toko");

if (!Array.isArray(stores) || stores.length === 0) {
return null;
}

return stores[0].id;
}

// ========================================
// MEMUAT PRODUK PENJUAL
// ========================================

async function loadProducts() {
try {
productList.textContent = "Memuat produk...";

totalProducts.textContent = "0";
pendingProducts.textContent = "0";
activeProducts.textContent = "0";

currentStoreId = await loadStore();

if (!currentStoreId) {
  productList.textContent =
    "Anda belum memiliki toko. Silakan lengkapi data toko terlebih dahulu.";

  return;
}

const url =
  `${SUPABASE_URL}/rest/v1/products?select=id,name,price,unit,location,status,created_at&store_id=eq.${encodeURIComponent(currentStoreId)}&order=created_at.desc`;

console.log("Memuat produk:", url);

const response = await fetch(url, {
  method: "GET",
  headers: supabaseHeaders()
});

const products = await readResponse(response, "Memuat produk");

if (!Array.isArray(products)) {
  throw new Error("Format data produk tidak sesuai.");
}

totalProducts.textContent = products.length;

pendingProducts.textContent =
  products.filter(product => product.status === "pending").length;

activeProducts.textContent =
  products.filter(product => product.status === "active").length;

if (products.length === 0) {
  productList.textContent = "Anda belum memiliki produk.";
  return;
}

productList.innerHTML = "";

products.forEach(product => {
  const item = document.createElement("div");
  item.className = "product-item";

  const name = document.createElement("h3");
  name.textContent = product.name;

  const price = document.createElement("p");
  price.textContent =
    "Harga: Rp " +
    Number(product.price).toLocaleString("id-ID") +
    " / " + (product.unit || "");

  const location = document.createElement("p");
  location.textContent =
    "Lokasi: " + (product.location || "-");

  const status = document.createElement("p");
  status.textContent =
    "Status: " + (product.status || "Tidak diketahui");

  item.append(name, price, location, status);

  productList.appendChild(item);
});

} catch (error) {
console.error("Gagal memuat dashboard:", error);

productList.textContent =
  "Terjadi kesalahan: " + error.message;

}
}

// ========================================
// TOMBOL TAMBAH PRODUK
// ========================================

addProductBtn.addEventListener("click", () => {
if (!currentStoreId) {
alert("Toko belum tersedia. Produk belum bisa ditambahkan.");
return;
}

productFormSection.hidden = false;

productFormSection.scrollIntoView({
behavior: "smooth",
block: "start"
});
});

// ========================================
// TOMBOL BATAL
// ========================================

cancelProductBtn.addEventListener("click", () => {
productForm.reset();
productFormSection.hidden = true;

const formMessage = document.getElementById("formMessage");

if (formMessage) {
formMessage.textContent = "";
}
});

// ========================================
// LOGOUT
// ========================================

document.getElementById("logoutBtn").addEventListener("click", () => {
localStorage.removeItem("access_token");
localStorage.removeItem("user");

window.location.href = "login.html";
});
