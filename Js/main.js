// main.js

let cart = JSON.parse(localStorage.getItem("cart")) || [];

document.addEventListener("DOMContentLoaded", function () {
    const addToCartButtons = document.querySelectorAll(".add-to-cart");

    addToCartButtons.forEach(button => {
        button.addEventListener("click", () => {
            const id = button.getAttribute("data-id");
            const name = button.getAttribute("data-name");
            const price = parseFloat(button.getAttribute("data-price"));

            const existingProduct = cart.find(p => p.id === id);

            if (existingProduct) {
                existingProduct.quantity += 1;
            } else {
                cart.push({ id, name, price, quantity: 1 });
            }

            localStorage.setItem("cart", JSON.stringify(cart));
            updateCartCount();
        });
    });

    const filterButtons = document.querySelectorAll('#categoryFilters button');
    const products = document.querySelectorAll('.product');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.getAttribute('data-filter');

            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            products.forEach(product => {
                const productCategory = product.getAttribute('data-category');
                if (category === 'all' || productCategory === category) {
                    product.style.display = '';
                } else {
                    product.style.display = 'none';
                }
            });
        });
    });

    updateCartCount(); // al cargar la página
});

function updateCartCount() {
    const cartCountElements = document.querySelectorAll(".cart-count");
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    cartCountElements.forEach(el => {
        el.textContent = totalItems;
    });
}
