// ========================================
// SUPABASE CONFIGURATION
// ========================================

const SUPABASE_URL = "https://pzgjlotpgdmbqfqouihk.supabase.co";
const SUPABASE_KEY = "sb_publishable_YVctx86LRETCyp8LFE-xPg_DRtOm2dq";

const token = localStorage.getItem("access_token");
const userData = localStorage.getItem("user");

const productList = document.getElementById("productList");

// ========================================
// CEK LOGIN DAN ROLE
// ========================================

if (!token || !userData) {
  window.location.href = "login.html";
}

const user = JSON.parse(userData);

if (user.user_metadata?.role !== "seller") {
  alert("Halaman ini khusus untuk penjual.");
  window.location.href = "../index.html";
} else {
  document.getElementById("sellerName").textContent =
    user.user_metadata.full_name || "Penjual";

  loadProducts();
}

// ========================================
// MEMUAT PRODUK PENJUAL
// ========================================

async function loadProducts() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,price,unit,stock,location,status,created_at,categories(name)&seller_id=eq.${user.id}&order=created_at.desc`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("Gagal mengambil data produk.");
    }

    const products = await response.json();

    const total = products.length;
    const pending = products.filter(p => p.status === "pending").length;
    const active = products.filter(p => p.status === "active").length;

    document.getElementById("totalProducts").textContent = total;
    document.getElementById("pendingProducts").textContent = pending;
    document.getElementById("activeProducts").textContent = active;

    if (products.length === 0) {
      productList.textContent = "Anda belum memiliki produk.";
      return;
    }

    productList.innerHTML = "";

    products.forEach(product => {
      const item = document.createElement("div");
      item.style.padding = "15px";
      item.style.marginBottom = "12px";
      item.style.background = "#ffffff";
      item.style.borderRadius = "8px";

      const name = document.createElement("h3");
      name.textContent = product.name;

      const price = document.createElement("p");
      price.textContent =
        `Harga: Rp ${Number(product.price).toLocaleString("id-ID")} / ${product.unit || ""}`;

      const stock = document.createElement("p");
      stock.textContent = `Stok: ${product.stock ?? "-"}`;

      const location = document.createElement("p");
      location.textContent = `Lokasi: ${product.location || "-"}`;

      const status = document.createElement("p");
      status.textContent = `Status: ${product.status}`;

      item.append(name, price, stock, location, status);
      productList.appendChild(item);
    });

  } catch (error) {
    console.error(error);
    productList.textContent = "Gagal memuat produk. Silakan coba lagi.";
  }
}

// ========================================
// TOMBOL TAMBAH PRODUK
// ========================================

document.getElementById("addProductBtn").addEventListener("click", () => {
  alert("Fitur tambah produk akan kita buat pada tahap berikutnya.");
});

// ========================================
// LOGOUT
// ========================================

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");

  window.location.href = "login.html";
});
