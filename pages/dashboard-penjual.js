// ========================================
// SAHABAT PETANI KERINCI
// DASHBOARD PENJUAL - CLOUDFLARE D1
// ========================================

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

const formMessage = document.getElementById("formMessage");
const submitProductBtn = document.getElementById("submitProductBtn");

let currentUser = null;


// ========================================
// FUNGSI MEMBACA RESPONS API
// ========================================

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options
    });

    const text = await response.text();

    let result;

    try {
        result = JSON.parse(text);
    } catch (error) {
        throw new Error(
            "Server tidak mengirim JSON. HTTP " + response.status
        );
    }

    if (!response.ok) {
        throw new Error(
            result.error || "Terjadi kesalahan pada server."
        );
    }

    return result;
}


// ========================================
// CEK LOGIN DAN PROFIL PENJUAL
// ========================================

async function checkSeller() {
    try {
        const result = await apiRequest("/api/profile");

        currentUser = result.user;

        if (!currentUser || !currentUser.id) {
            throw new Error("Data akun tidak ditemukan.");
        }

        if (currentUser.role !== "seller" &&
            currentUser.role !== "admin") {

            alert("Halaman ini khusus untuk penjual.");

            window.location.href = "../index.html";
            return;
        }

        sellerName.textContent = currentUser.name || "Penjual";

        await loadCategories();
        await loadProducts();

    } catch (error) {
        console.error("Pemeriksaan akun gagal:", error);

        if (error.message.includes("masuk terlebih dahulu")) {
            window.location.href = "login.html";
            return;
        }

        productList.textContent =
            "Terjadi kesalahan: " + error.message;
    }
}


// ========================================
// MEMUAT KATEGORI PRODUK
// ========================================

async function loadCategories() {
    const categorySelect =
        document.getElementById("productCategory");

    try {
        const result = await apiRequest("/api/categories");

        categorySelect.innerHTML =
            '<option value="">Pilih kategori</option>';

        const categories = result.items || [];

        if (categories.length === 0) {
            categorySelect.innerHTML =
                '<option value="">Kategori belum tersedia</option>';

            return;
        }

        categories.forEach(category => {
            const option = document.createElement("option");

            option.value = category.name;
            option.textContent = category.name;

            categorySelect.appendChild(option);
        });

    } catch (error) {
        console.error("Gagal memuat kategori:", error);

        categorySelect.innerHTML =
            '<option value="">Gagal memuat kategori</option>';
    }
}


// ========================================
// MEMUAT PRODUK MILIK PENJUAL
// ========================================

async function loadProducts() {
    try {
        productList.textContent = "Memuat produk...";

        totalProducts.textContent = "0";
        pendingProducts.textContent = "0";
        activeProducts.textContent = "0";

        const result = await apiRequest("/api/my-products");

        const products = result.items || [];

        totalProducts.textContent = products.length;

        pendingProducts.textContent =
            products.filter(product =>
                product.status === "pending"
            ).length;

        activeProducts.textContent =
            products.filter(product =>
                product.status === "published"
            ).length;

        if (products.length === 0) {
            productList.textContent =
                "Anda belum memiliki produk.";

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

            const stock = document.createElement("p");
            stock.textContent =
                "Stok: " + (product.stock || 0) +
                " " + (product.unit || "");

            const status = document.createElement("p");

            let statusText = product.status;

            if (statusText === "pending") {
                statusText = "Menunggu persetujuan";
            } else if (statusText === "published") {
                statusText = "Aktif";
            }

            status.textContent = "Status: " + statusText;

            item.append(
                name,
                price,
                location,
                stock,
                status
            );

            if (product.image_url) {
                const image = document.createElement("img");

                image.src = product.image_url;
                image.alt = product.name;
                image.style.maxWidth = "150px";
                image.style.display = "block";

                item.prepend(image);
            }

            productList.appendChild(item);
        });

    } catch (error) {
        console.error("Gagal memuat produk:", error);

        productList.textContent =
            "Terjadi kesalahan: " + error.message;
    }
}


// ========================================
// TOMBOL TAMBAH PRODUK
// ========================================

addProductBtn.addEventListener("click", () => {
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

    formMessage.textContent = "";
});


// ========================================
// PROSES UNGGAH FOTO DAN SIMPAN PRODUK
// ========================================

productForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name =
        document.getElementById("productName").value.trim();

    const category =
        document.getElementById("productCategory").value;

    const price =
        document.getElementById("productPrice").value;

    const unit =
        document.getElementById("productUnit").value;

    const location =
        document.getElementById("productLocation").value.trim();

    const description =
        document.getElementById("productDescription").value.trim();

    const imageFile =
        document.getElementById("productImage").files[0];

    if (!imageFile) {
        alert("Pilih foto produk terlebih dahulu.");
        return;
    }

    if (imageFile.size > 5 * 1024 * 1024) {
        alert("Ukuran foto maksimal 5 MB.");
        return;
    }

    submitProductBtn.disabled = true;
    submitProductBtn.textContent = "Mengunggah...";

    formMessage.textContent = "Sedang mengunggah foto produk...";

    try {
        // UPLOAD FOTO

        const imageForm = new FormData();

        imageForm.append("image", imageFile);

        const uploadResult = await apiRequest(
            "/api/upload-image",
            {
                method: "POST",
                body: imageForm
            }
        );

        // SIMPAN DATA PRODUK

        formMessage.textContent = "Menyimpan produk...";

        const productResult = await apiRequest(
            "/api/products",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    category,
                    price: Number(price),
                    unit,
                    location,
                    description,
                    stock: 0,
                    image_url: uploadResult.image_url
                })
            }
        );

        alert(
            "Produk berhasil dikirim dan sedang menunggu persetujuan admin."
        );

        productForm.reset();

        productFormSection.hidden = true;

        formMessage.textContent = "";

        await loadProducts();

    } catch (error) {
        console.error("Gagal menyimpan produk:", error);

        formMessage.textContent =
            "Gagal: " + error.message;

        alert("Gagal menyimpan produk: " + error.message);

    } finally {
        submitProductBtn.disabled = false;
        submitProductBtn.textContent = "Simpan Produk";
    }
});


// ========================================
// LOGOUT
// ========================================

document.getElementById("logoutBtn").addEventListener(
    "click",
    async () => {
        try {
            await apiRequest("/api/auth/logout", {
                method: "POST"
            });
        } catch (error) {
            console.error("Logout gagal:", error);
        }

        window.location.href = "login.html";
    }
);


// ========================================
// JALANKAN DASHBOARD
// ========================================

checkSeller();
