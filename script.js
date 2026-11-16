const products = [
    {
        name: "Kentang Granola",
        category: "Sayuran",
        price: 18000,
        location: "Kayu Aro",
        image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500"
    },
    {
        name: "Cabai Merah",
        category: "Sayuran",
        price: 42000,
        location: "Siulak",
        image: "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=500"
    },
    {
        name: "Jeruk Kerinci",
        category: "Buah-buahan",
        price: 16000,
        location: "Danau Kerinci",
        image: "https://images.unsplash.com/photo-1547514701-42782101795e?w=500"
    },
    {
        name: "Sapi Bali",
        category: "Hewan ternak",
        price: 12500000,
        location: "Gunung Tujuh",
        image: "https://images.unsplash.com/photo-1527153857715-3908f2109d2?w=500"
    }
];

const productGrid = document.getElementById("productGrid");

function renderProducts(data = products) {

    productGrid.innerHTML = data.map(product => `

        <div class="product-card">

            <img src="${product.image}" alt="${product.name}">

            <div class="product-info">

                <h3>${product.name}</h3>

                <div class="product-price">
                    Rp ${product.price.toLocaleString("id-ID")}
                </div>

                <div class="product-location">
                    📍 ${product.location}
                </div>

            </div>

        </div>

    `).join("");

}

function searchProducts() {

    const keyword = document
        .getElementById("searchInput")
        .value
        .toLowerCase();

    const result = products.filter(product =>
        product.name.toLowerCase().includes(keyword) ||
        product.category.toLowerCase().includes(keyword) ||
        product.location.toLowerCase().includes(keyword)
    );

    renderProducts(result);
}

document.querySelectorAll("[data-category]").forEach(button => {

    button.addEventListener("click", () => {

        const category = button.dataset.category;

        const result = products.filter(product =>
            product.category === category
        );

        renderProducts(result);

    });

});

renderProducts();
