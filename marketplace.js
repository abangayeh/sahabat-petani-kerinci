/* =========================================
SAHABAT PETANI KERINCI
MARKETPLACE JAVASCRIPT
========================================= */

const API = "/api";

let currentUser = null;
let products = [];
let favorites = [];

/* =========================================
API HELPER
========================================= */

async function apiRequest(endpoint, options = {}) {
const response = await fetch(API + endpoint, {
credentials: "same-origin",
...options,
headers: {
"Content-Type": "application/json",
...(options.headers || {})
}
});

const data = await response.json().catch(() => ({}));

if (!response.ok) {
    throw new Error(data.error || data.message || "Terjadi kesalahan.");
}

return data;

}

function showMessage(id, message, success = false) {
const element = document.getElementById(id);

if (!element) return;

element.textContent = message;
element.style.color = success ? "#287a3e" : "#b42318";

}

function escapeHTML(value) {
return String(value ?? "").replace(/[&<>"']/g, character => ({
"&": "&",
"<": "<",
">": ">",
'"': """,
"'": "'"
})[character]);
}

function formatRupiah(value) {
return new Intl.NumberFormat("id-ID", {
style: "currency",
currency: "IDR",
maximumFractionDigits: 0
}).format(Number(value) || 0);
}

/* =========================================
AUTENTIKASI
========================================= */

function updateAccountDisplay() {
const form = document.getElementById("auth-form");
const signedIn = document.getElementById("signed-in");
const summary = document.getElementById("user-summary");
const becomeSeller = document.getElementById("become-seller");

if (!currentUser) {
    form.hidden = false;
    signedIn.hidden = true;
    return;
}

form.hidden = true;
signedIn.hidden = false;

summary.textContent =
    `Halo, ${currentUser.name}! Status akun: ${currentUser.role}.`;

becomeSeller.hidden =
    currentUser.role === "seller" ||
    currentUser.role === "admin";

}

async function checkLogin() {
try {
const data = await apiRequest("/auth/me");
currentUser = data.user || null;
} catch {
currentUser = null;
}

updateAccountDisplay();

if (currentUser) {
    loadMyProducts();
    loadFavorites();
}

}

/* =========================================
FORM MASUK DAN DAFTAR
========================================= */

let authMode = "login";

document.querySelectorAll(".form-tabs button").forEach(button => {
button.addEventListener("click", () => {
authMode = button.dataset.mode;

    document.querySelectorAll(".form-tabs button").forEach(item => {
        item.classList.toggle("active", item === button);
    });

    document.getElementById("name-field").hidden =
        authMode !== "register";

    document.getElementById("phone-field").hidden =
        authMode !== "register";

    document.getElementById("auth-submit").textContent =
        authMode === "register" ? "Daftar Akun" : "Masuk";

    showMessage("auth-message", "");
});

});

document.getElementById("auth-form").addEventListener("submit", async event => {
event.preventDefault();

const form = event.currentTarget;
const formData = new FormData(form);

const body = {
    email: formData.get("email"),
    password: formData.get("password")
};

if (authMode === "register") {
    body.name = formData.get("name");
    body.phone = formData.get("phone");
}

const endpoint = authMode === "register"
    ? "/auth/register"
    : "/auth/login";

const button = document.getElementById("auth-submit");

button.disabled = true;
button.textContent = "Memproses...";

try {
    const data = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(body)
    });

    currentUser = data.user;

    showMessage(
        "auth-message",
        authMode === "register"
            ? "Pendaftaran berhasil!"
            : "Berhasil masuk!",
        true
    );

    form.reset();
    updateAccountDisplay();

    await loadMyProducts();
    await loadFavorites();

} catch (error) {
    showMessage("auth-message", error.message);
} finally {
    button.disabled = false;
    button.textContent =
        authMode === "register" ? "Daftar Akun" : "Masuk";
}

});

/* =========================================
AKTIFKAN AKUN PENJUAL
========================================= */

document.getElementById("become-seller").addEventListener("click", async () => {
if (!confirm("Aktifkan akun sebagai penjual?")) return;

try {
    const data = await apiRequest("/auth/become-seller", {
        method: "POST",
        body: JSON.stringify({})
    });

    currentUser = data.user;

    updateAccountDisplay();

    alert("Akun penjual berhasil diaktifkan!");

    loadMyProducts();

} catch (error) {
    alert(error.message);
}

});

/* =========================================
KELUAR
========================================= */

document.getElementById("logout").addEventListener("click", async () => {
try {
await apiRequest("/auth/logout", {
method: "POST",
body: JSON.stringify({})
});

    currentUser = null;
    favorites = [];

    updateAccountDisplay();
    renderMyProducts();

    showMessage("auth-message", "Kamu berhasil keluar.", true);

} catch (error) {
    alert(error.message);
}

});

/* =========================================
MEMUAT PRODUK
========================================= */

async function loadProducts() {
const status = document.getElementById("products-status");

status.textContent = "Memuat produk...";

try {
    const data = await apiRequest("/products");

    products = data.items || [];

    renderProducts();

    status.textContent = products.length
        ? `${products.length} produk tersedia.`
        : "Belum ada produk yang tersedia.";

} catch (error) {
    status.textContent = error.message;
}

}

/* =========================================
MENAMPILKAN KATALOG
========================================= */

function renderProducts() {
const container = document.getElementById("product-grid");

const search = document
    .getElementById("product-search")
    .value.toLowerCase()
    .trim();

const category = document
    .getElementById("category-filter")
    .value.toLowerCase();

const filtered = products.filter(product => {
    const searchable = [
        product.name,
        product.category,
        product.description,
        product.location
    ].join(" ").toLowerCase();

    const matchesSearch = searchable.includes(search);

    const matchesCategory = !category ||
        String(product.category || "").toLowerCase() === category;

    return matchesSearch && matchesCategory;
});

if (!filtered.length) {
    container.innerHTML = `
        <p class="empty-message">
            Produk tidak ditemukan.
        </p>
    `;
    return;
}

container.innerHTML = filtered.map(product => {
    const id = Number(product.id);
    const isFavorite = favorites.includes(id);

    return `
        <article class="product-card">

            <div class="product-info">

                <p class="eyebrow">
                    ${escapeHTML(product.category || "Pertanian")}
                </p>

                <h3>${escapeHTML(product.name)}</h3>

                <p class="product-price">
                    ${formatRupiah(product.price)}
                    / ${escapeHTML(product.unit || "unit")}
                </p>

                <p class="product-location">
                    📍 ${escapeHTML(product.location || "Lokasi belum dicantumkan")}
                </p>

                <p>
                    Stok: ${escapeHTML(product.stock ?? 0)}
                    ${escapeHTML(product.unit || "unit")}
                </p>

                <p>
                    ${escapeHTML(product.description || "")}
                </p>

                <button
                    class="btn secondary full"
                    type="button"
                    onclick="orderProduct(${id})">
                    Pesan Produk
                </button>

                <button
                    class="btn secondary full"
                    type="button"
                    onclick="toggleFavorite(${id})">
                    ${isFavorite ? "♥ Hapus Favorit" : "♡ Tambah Favorit"}
                </button>

            </div>

        </article>
    `;
}).join("");

}

/* =========================================
PENCARIAN DAN FILTER
========================================= */

document.getElementById("product-search")
.addEventListener("input", renderProducts);

document.getElementById("category-filter")
.addEventListener("change", renderProducts);

document.getElementById("refresh-products")
.addEventListener("click", loadProducts);

/* =========================================
FAVORIT
========================================= */

async function loadFavorites() {
if (!currentUser) return;

try {
    const data = await apiRequest("/favorites");

    favorites = (data.items || []).map(item =>
        Number(item.product_id ?? item.id)
    );

    renderProducts();

} catch {
    favorites = [];
}

}

async function toggleFavorite(productId) {
if (!currentUser) {
alert("Silakan masuk terlebih dahulu.");
document.getElementById("akun").scrollIntoView();
return;
}

const isFavorite = favorites.includes(productId);

try {
    if (isFavorite) {
        await apiRequest(`/favorites/${productId}`, {
            method: "DELETE"
        });

        favorites = favorites.filter(id => id !== productId);

    } else {
        await apiRequest("/favorites", {
            method: "POST",
            body: JSON.stringify({
                product_id: productId
            })
        });

        favorites.push(productId);
    }

    renderProducts();

} catch (error) {
    alert(error.message);
}

}

/* =========================================
MEMESAN PRODUK
========================================= */

async function orderProduct(productId) {
if (!currentUser) {
alert("Silakan masuk terlebih dahulu untuk memesan.");
document.getElementById("akun").scrollIntoView();
return;
}

const product = products.find(item =>
    Number(item.id) === productId
);

if (!product) return;

const quantity = Number(
    prompt(`Masukkan jumlah pesanan (${product.unit || "unit"}):`)
);

if (!quantity || quantity <= 0) return;

if (quantity > Number(product.stock)) {
    alert("Jumlah pesanan melebihi stok tersedia.");
    return;
}

const address = prompt("Masukkan alamat pengiriman:");

if (!address || !address.trim()) return;

const notes = prompt("Catatan tambahan (opsional):") || "";

try {
    await apiRequest("/orders", {
        method: "POST",
        body: JSON.stringify({
            product_id: productId,
            quantity,
            delivery_address: address,
            notes
        })
    });

    alert("Pesanan berhasil dibuat!");

    await loadProducts();

} catch (error) {
    alert(error.message);
}

}

/* =========================================
PRODUK MILIK PENJUAL
========================================= */

let myProducts = [];

async function loadMyProducts() {
if (!currentUser) return;

try {
    const data = await apiRequest("/my-products");

    myProducts = data.items || [];

    renderMyProducts();

} catch (error) {
    console.error("Gagal memuat produk saya:", error);
}

}

function renderMyProducts() {
const container = document.getElementById("my-products");

if (!currentUser) {
    container.innerHTML = `
        <p class="empty-message">
            Masuk untuk melihat produk milikmu.
        </p>
    `;
    return;
}

if (!myProducts.length) {
    container.innerHTML = `
        <p class="empty-message">
            Kamu belum memiliki produk.
        </p>
    `;
    return;
}

container.innerHTML = myProducts.map(product => `
    <article class="product-card">
        <div class="product-info">

            <h3>${escapeHTML(product.name)}</h3>

            <p class="product-price">
                ${formatRupiah(product.price)}
            </p>

            <p>
                Status:
                <b>${escapeHTML(product.status || "pending")}</b>
            </p>

            <p>
                Stok: ${escapeHTML(product.stock ?? 0)}
                ${escapeHTML(product.unit || "unit")}
            </p>

        </div>
    </article>
`).join("");

}

/* =========================================
FORM JUAL PRODUK
========================================= */

document.getElementById("product-form").addEventListener("submit", async event => {
event.preventDefault();

if (!currentUser) {
    alert("Silakan masuk terlebih dahulu.");
    document.getElementById("akun").scrollIntoView();
    return;
}

if (!["seller", "admin"].includes(currentUser.role)) {
    alert("Aktifkan akun penjual terlebih dahulu.");
    return;
}

const form = event.currentTarget;
const formData = new FormData(form);

const body = {
    name: formData.get("name"),
    category: formData.get("category"),
    price: Number(formData.get("price")),
    stock: Number(formData.get("stock")),
    unit: formData.get("unit"),
    location: formData.get("location"),
    description: formData.get("description")
};

const button = form.querySelector('button[type="submit"]');

button.disabled = true;
button.textContent = "Mengirim...";

try {
    const data = await apiRequest("/products", {
        method: "POST",
        body: JSON.stringify(body)
    });

    showMessage(
        "product-message",
        "Produk berhasil dikirim dan menunggu persetujuan admin.",
        true
    );

    form.reset();

    await loadMyProducts();

    alert(`Produk berhasil dikirim. Status: ${data.status || "pending"}`);

} catch (error) {
    showMessage("product-message", error.message);
} finally {
    button.disabled = false;
    button.textContent = "Kirim Produk";
}

});

/* =========================================
MULAI MARKETPLACE
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
renderMyProducts();

await loadProducts();
await checkLogin();

});
