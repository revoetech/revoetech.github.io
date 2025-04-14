async function loadProducts() {
  try {
    const response = await fetch('data/products.json');
    if (!response.ok) throw new Error('Erro ao carregar produtos');
    return await response.json();
  } catch (error) {
    console.error(error);
    document.getElementById('fix-12-12').innerHTML = '<p>Erro ao carregar produtos. Verifique o console.</p>';
    return [];
  }
}

function displayProducts(products, page = 1, perPage = 8) {
  const productsContainer = document.getElementById('fix-12-12');
  productsContainer.innerHTML = '';

  const start = (page - 1) * perPage;
  const end = start + perPage;
  const paginatedProducts = products.slice(start, end);

  paginatedProducts.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <h3>${product.name}</h3>
      <p>R$${product.price.toFixed(2)}</p>
      <!--<div class="stars">${'★'.repeat(product.rating)}${'☆'.repeat(5 - product.rating)}</div> -->
      <button onclick="window.location.href='product.html?id=${product.id}'">Detalhes</button>
      <!-- <a href="${product.checkoutUrl}" target="_blank">Comprar</a> -->
    `;
    productsContainer.appendChild(card);
  });

}

async function filterAndDisplay(page = 1) {
  let products = await loadProducts();
  const search = document.getElementById('search').value.toLowerCase();
  const category = document.getElementById('category').value;

  if (search) {
    products = products.filter(p => p.name.toLowerCase().includes(search));
  }
  if (category) {
    products = products.filter(p => p.category === category);
  }

  displayProducts(products, page);
}

async function loadProductDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');
  const products = await loadProducts();
  const product = products.find(p => p.id == productId);

  if (product) {
    const detailsContainer = document.getElementById('product-details');
    detailsContainer.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <h2>${product.name}</h2>
      <p><strong>Categoria:</strong> ${product.category}</p>
      <p><strong>Preço:</strong> R$${product.price.toFixed(2)}</p>
      <div class="stars">${'★'.repeat(product.rating)}${'☆'.repeat(5 - product.rating)}</div>
      <p>${product.description}</p>
      <a href="${product.checkoutUrl}" target="_blank">Comprar</a>
    `;
  }
}

if (document.getElementById('products')) {
  loadCategories();
  filterAndDisplay();
  document.getElementById('search').addEventListener('input', () => filterAndDisplay());
  document.getElementById('category').addEventListener('change', () => filterAndDisplay());
  document.getElementById('price').addEventListener('change', () => filterAndDisplay());
} else if (document.getElementById('product-details')) {
  loadProductDetails();
}