// ========================================
// SUPABASE CONFIGURATION
// ========================================

const SUPABASE_URL = "https://ipxywljkorzvyoukfoaw.supabase.co";

const SUPABASE_KEY = "sb_publishable_K3UGmk7U-eBSUbJ3ysmOlQ_ysM2PMER";

// ========================================
// MENGAMBIL DATA PRODUK DARI SUPABASE
// ========================================

let products = [];

const productGrid = document.getElementById("productGrid");

async function loadProducts() {
    try {
        productGrid.innerHTML = "<p>Memuat produk...</p>";

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/products?select=*,categories(name)&status=eq.active&order=created_at.desc`,
            {
                headers: {
                    "apikey": SUPABASE_KEY
                }
            }
        );

        if (!response.ok) {
            throw new Error("Gagal mengambil data produk");
        }

        products = await response.json();

        renderProducts();

    } catch (error) {
        console.error("Supabase Error:", error);

        productGrid.innerHTML =
            "<p>Produk belum dapat dimuat. Silakan coba beberapa saat lagi.</p>";
    }
}

// ========================================
// MENAMPILKAN PRODUK
// ========================================

function renderProducts(data = products) {

    if (data.length === 0) {
        productGrid.innerHTML =
            "<p>Belum ada produk yang tersedia.</p>";
        return;
    }

    productGrid.innerHTML = data.map(product => {

        const categoryName =
            product.categories?.name || "Produk Pertanian";

        const image =
            product.image_url ||
            "https://placehold.co/500x350?text=Produk+Petani";

        return `
            <div class="product-card">

                <img
                    src="${image}"
                    alt="${product.name}"
                    onerror="this.src='https://placehold.co/500x350?text=Produk+Petani'"
                >

                <div class="product-info">

                    <h3>${product.name}</h3>

                    <div class="product-category">
                        ${categoryName}
                    </div>

                    <div class="product-price">
                        Rp ${Number(product.price).toLocaleString("id-ID")}
                        / ${product.unit || "unit"}
                    </div>

                    <div class="product-location">
                        📍 ${product.location || "Kerinci"}
                    </div>

                </div>

            </div>
        `;

    }).join("");

}

// ========================================
// PENCARIAN PRODUK
// ========================================

function searchProducts() {

    const searchInput = document.getElementById("searchInput");

    if (!searchInput) return;

    const keyword = searchInput.value.toLowerCase();

    const result = products.filter(product => {

        const category =
            product.categories?.name || "";

        return (
            product.name.toLowerCase().includes(keyword) ||
            category.toLowerCase().includes(keyword) ||
            (product.location || "").toLowerCase().includes(keyword)
        );

    });

    renderProducts(result);
}

// ========================================
// FILTER KATEGORI
// ========================================

document.querySelectorAll("[data-category]").forEach(button => {

    button.addEventListener("click", () => {

        const category = button.dataset.category;

        const result = products.filter(product => {

            const categoryName =
                product.categories?.name || "";

            return categoryName === category;

        });

        renderProducts(result);

    });

});

// ========================================
// MULAI WEBSITE
// ========================================

loadProducts();
