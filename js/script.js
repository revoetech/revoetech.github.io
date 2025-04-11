// Função para carregar produtos do JSON
async function loadProducts() {
    try {
      const response = await fetch('data/products.json');
      if (!response.ok) throw new Error('Erro ao carregar produtos');
      return await response.json();
    } catch (error) {
      console.error(error);
      document.getElementById('products').innerHTML = '<p>Erro ao carregar produtos. Verifique o console.</p>';
      return [];
    }
  }
  
  // Função para exibir produtos na página inicial
  function displayProducts(products, page = 1, perPage = 6) {
    const productsContainer = document.getElementById('products');
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
        <div class="stars">${'★'.repeat(product.rating)}${'☆'.repeat(5 - product.rating)}</div>
        <button onclick="window.location.href='product.html?id=${product.id}'">Ver mais</button>
        <a href="${product.checkoutUrl}" target="_blank">Comprar</a>
      `;
      productsContainer.appendChild(card);
    });
  
    // Paginação
    const totalPages = Math.ceil(products.length / perPage);
    displayPagination(totalPages, page);
  }
  
  // Função para exibir paginação
  function displayPagination(totalPages, currentPage) {
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';
  
    for (let i = 1; i <= totalPages; i++) {
      const button = document.createElement('button');
      button.textContent = i;
      if (i === currentPage) button.style.backgroundColor = '#36b5b7';
      button.onclick = () => filterAndDisplay(i);
      paginationContainer.appendChild(button);
    }
  }
  
  // Função para carregar categorias no filtro
  async function loadCategories() {
    const products = await loadProducts();
    const categories = [...new Set(products.map(p => p.category))];
    const categorySelect = document.getElementById('category');
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categorySelect.appendChild(option);
    });
  }
  
  // Função para filtrar e exibir produtos
  async function filterAndDisplay(page = 1) {
    let products = await loadProducts();
    const search = document.getElementById('search').value.toLowerCase();
    const category = document.getElementById('category').value;
    const price = document.getElementById('price').value;
  
    if (search) {
      products = products.filter(p => p.name.toLowerCase().includes(search));
    }
    if (category) {
      products = products.filter(p => p.category === category);
    }
    if (price) {
      const [min, max] = price.split('-').map(Number);
      products = products.filter(p => max ? p.price >= min && p.price <= max : p.price >= min);
    }
  
    displayProducts(products, page);
  }
  
  // Função para carregar detalhes do produto
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
  
  // Inicialização
  if (document.getElementById('products')) {
    loadCategories();
    filterAndDisplay();
    document.getElementById('search').addEventListener('input', () => filterAndDisplay());
    document.getElementById('category').addEventListener('change', () => filterAndDisplay());
    document.getElementById('price').addEventListener('change', () => filterAndDisplay());
  } else if (document.getElementById('product-details')) {
    loadProductDetails();
  }