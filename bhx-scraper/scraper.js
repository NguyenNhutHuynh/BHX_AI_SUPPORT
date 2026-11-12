/**
 * Bách Hóa Xanh Monorepo Scraper (Nâng cấp)
 * - Tự động đọc danh mục từ bảng bhx_categories (ưu tiên is_food_category = 1)
 * - Cơ chế delay ngẫu nhiên 2 - 4 giây giữa các trang để tránh bị chặn IP
 * - Cập nhật last_scraped_at sau khi cào xong mỗi danh mục
 * - Kết hợp 2 cơ chế: API response capture + DOM/SSR parsing
 */

const { chromium } = require('playwright');
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'bhx_master_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

/**
 * Tách khối lượng/trọng lượng và đơn vị từ tên sản phẩm tiếng Việt
 * Quy đổi: kg -> g (* 1000), l/lít -> ml (* 1000)
 * Nhận diện: g, ml, quả, trái, vỉ, hộp, gói, khay, bó, túi
 */
function extractWeight(productName) {
  if (!productName || typeof productName !== 'string') {
    return { value: null, unit: null };
  }

  const name = productName.toLowerCase().trim();

  // 1. Trọng lượng/Thể tích kèm số: kg, kilo, g, gr, l, lít, ml
  const weightRegex = /(?:^|[^\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*(kg|kilo(?:gam)?|kí|ki|g(?:ram)?|gr|l(?:ít|it)?|ml|mili(?:lít|lit))(?=$|[^\p{L}\p{N}])/iu;
  const weightMatch = name.match(weightRegex);
  if (weightMatch) {
    const num = parseFloat(weightMatch[1].replace(',', '.'));
    const rawUnit = weightMatch[2].toLowerCase();

    if (['kg', 'kilo', 'kilogam', 'kí', 'ki'].includes(rawUnit)) {
      return { value: Math.round(num * 1000), unit: 'g' };
    }
    if (['l', 'lit', 'lít'].includes(rawUnit)) {
      return { value: Math.round(num * 1000), unit: 'ml' };
    }
    if (['g', 'gram', 'gr'].includes(rawUnit)) {
      return { value: num, unit: 'g' };
    }
    if (['ml', 'mililit', 'milit'].includes(rawUnit)) {
      return { value: num, unit: 'ml' };
    }
  }

  // 2. Đơn vị số lượng đếm kèm số: quả, trái, vỉ, hộp, gói, khay, bó, túi
  const countRegex = /(?:^|[^\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*(quả|trái|vỉ|hộp|gói|khay|bó|túi|lon|chai)(?=$|[^\p{L}\p{N}])/iu;
  const countMatch = name.match(countRegex);
  if (countMatch) {
    const num = parseFloat(countMatch[1].replace(',', '.'));
    const unit = countMatch[2].toLowerCase();
    return { value: num, unit };
  }

  // Đơn vị trước số: ví dụ "hộp 10", "vỉ 6"
  const containerCountRegex = /(?:^|[^\p{L}\p{N}])(vỉ|hộp|khay|gói|bó|túi)\s*(\d+)(?=$|[^\p{L}\p{N}])/iu;
  const containerCountMatch = name.match(containerCountRegex);
  if (containerCountMatch) {
    const unit = containerCountMatch[1].toLowerCase();
    const num = parseInt(containerCountMatch[2], 10);
    return { value: num, unit };
  }

  // 3. Fallback: Đơn vị định danh đứng độc lập không kèm số (mặc định là 1)
  const standaloneRegex = /(?:^|[^\p{L}\p{N}])(quả|trái|vỉ|hộp|gói|khay|bó|túi)(?=$|[^\p{L}\p{N}])/iu;
  const standaloneMatch = name.match(standaloneRegex);
  if (standaloneMatch) {
    return { value: 1, unit: standaloneMatch[1].toLowerCase() };
  }

  return { value: null, unit: null };
}

/**
 * Lưu hoặc cập nhật danh sách sản phẩm vào MySQL bằng lệnh INSERT ... ON DUPLICATE KEY UPDATE
 */
async function saveProducts(pool, products) {
  if (!products || products.length === 0) return 0;

  const sql = `
    INSERT INTO bhx_products (
      bhx_sku, name, slug, category_id, category_name,
      price, original_price, unit_label, in_stock, is_cooking_ingredient,
      net_weight_value, net_weight_unit, image_url, last_synced_at,
      created_at, updated_at
    ) VALUES ?
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      slug = VALUES(slug),
      category_id = COALESCE(VALUES(category_id), category_id),
      category_name = COALESCE(VALUES(category_name), category_name),
      price = VALUES(price),
      original_price = VALUES(original_price),
      unit_label = COALESCE(VALUES(unit_label), unit_label),
      in_stock = VALUES(in_stock),
      is_cooking_ingredient = VALUES(is_cooking_ingredient),
      net_weight_value = COALESCE(VALUES(net_weight_value), net_weight_value),
      net_weight_unit = COALESCE(VALUES(net_weight_unit), net_weight_unit),
      image_url = COALESCE(VALUES(image_url), image_url),
      last_synced_at = NOW(),
      updated_at = NOW()
  `;

  const now = new Date();
  const values = products.map((p) => [
    String(p.bhx_sku).slice(0, 50),
    String(p.name).slice(0, 255),
    p.slug ? String(p.slug).slice(0, 255) : null,
    p.category_id || null,
    p.category_name ? String(p.category_name).slice(0, 100) : null,
    Math.round(p.price || 0),
    p.original_price ? Math.round(p.original_price) : null,
    p.unit_label ? String(p.unit_label).slice(0, 50) : null,
    p.in_stock ? 1 : 0,
    p.is_cooking_ingredient !== undefined ? (p.is_cooking_ingredient ? 1 : 0) : 1,
    p.net_weight_value !== undefined ? p.net_weight_value : null,
    p.net_weight_unit ? String(p.net_weight_unit).slice(0, 20) : null,
    p.image_url ? String(p.image_url).slice(0, 500) : null,
    now,
    now,
    now,
  ]);

  const [result] = await pool.query(sql, [values]);
  return result.affectedRows;
}

/**
 * Trích xuất sản phẩm từ API payload JSON của Bách Hóa Xanh
 */
function parseApiProduct(item, defaultCategory = {}) {
  if (!item || (!item.name && !item.fullName)) return null;

  const name = (item.fullName || item.name || '').trim();
  const sku = item.productCode || (item.id ? String(item.id) : null);
  if (!sku || !name) return null;

  let price = 0;
  let originalPrice = null;

  if (item.productPrices && item.productPrices.length > 0) {
    const pr = item.productPrices[0];
    price = pr.price || pr.sysPrice || 0;
    if (pr.sysPrice && pr.sysPrice > price) {
      originalPrice = pr.sysPrice;
    }
  } else if (item.price) {
    price = item.price;
    if (item.sysPrice && item.sysPrice > price) {
      originalPrice = item.sysPrice;
    }
  }

  const weight = extractWeight(name + (item.canonical ? ` ${item.canonical}` : ''));
  const inStock = item.productPrices?.[0]?.isCanBuy ?? (item.status !== 0);
  const slug = item.url ? item.url.replace(/^\//, '') : null;

  return {
    bhx_sku: String(sku),
    name,
    slug,
    category_id: item.category?.id || defaultCategory.id || null,
    category_name: item.category?.name || defaultCategory.name || null,
    price,
    original_price: originalPrice,
    unit_label: item.unit || weight.unit || null,
    in_stock: inStock,
    is_cooking_ingredient: true,
    net_weight_value: weight.value,
    net_weight_unit: weight.unit,
    image_url: item.avatar || null,
  };
}

/**
 * Hàm sleep tạo delay ngẫu nhiên
 */
function randomDelay(minMs = 2000, maxMs = 4000) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeAll() {
  console.log('=== KHỞI ĐỘNG BÁCH HÓA XANH SCRAPER (NÂNG CẤP) ===\n');

  const pool = mysql.createPool(dbConfig);
  try {
    await pool.query('SELECT 1');
    console.log('✓ Kết nối MySQL thành công tới database:', dbConfig.database);
  } catch (err) {
    console.error('✗ Lỗi kết nối MySQL:', err.message);
    process.exit(1);
  }

  // Phân tích tham số dòng lệnh:
  // --all: cào tất cả danh mục thực phẩm
  // --limit=N: số lượng danh mục cần cào
  // --food-only: chỉ cào is_food_category = 1 (mặc định)
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const isAll = args.includes('--all');
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : (isAll ? 1000 : 8);

  // Đọc danh mục từ bảng bhx_categories (ưu tiên chưa cào last_scraped_at IS NULL)
  let [categories] = await pool.query(
    `
    SELECT id, slug, name, url, is_food_category, last_scraped_at 
    FROM bhx_categories 
    WHERE is_food_category = 1 
    ORDER BY (last_scraped_at IS NULL) DESC, last_scraped_at ASC 
    LIMIT ?
  `,
    [limit]
  );

  // Nếu bảng bhx_categories chưa có dữ liệu, dùng fallback 4 danh mục cốt lõi
  if (categories.length === 0) {
    console.log('! Chưa có danh mục trong bảng bhx_categories, sử dụng danh sách mặc định...');
    categories = [
      { id: 8781, slug: 'thit-heo', name: 'Thịt heo', url: 'https://www.bachhoaxanh.com/thit-heo' },
      { id: 8782, slug: 'thit-ga', name: 'Thịt gà', url: 'https://www.bachhoaxanh.com/thit-ga' },
      { id: 8783, slug: 'trung', name: 'Trứng', url: 'https://www.bachhoaxanh.com/trung' },
      { id: 8820, slug: 'rau-sach', name: 'Rau lá', url: 'https://www.bachhoaxanh.com/rau-sach' },
    ];
  }

  console.log(`> Sẽ tiến hành cào ${categories.length} danh mục thực phẩm từ cơ sở dữ liệu.\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 850 },
  });

  for (let idx = 0; idx < categories.length; idx++) {
    const cat = categories[idx];
    console.log(`--------------------------------------------------`);
    console.log(`[${idx + 1}/${categories.length}] Đang cào danh mục: "${cat.name}" (${cat.url})`);

    const page = await context.newPage();
    const productsMap = new Map();

    // Cơ chế 1: Bắt response API JSON
    page.on('response', async (res) => {
      try {
        const u = res.url();
        if (
          u.includes('api.bachhoaxanh.com') &&
          (u.includes('Cate') || u.includes('Product') || u.includes('Search') || u.includes('Vegetable'))
        ) {
          const json = await res.json();
          if (json && json.data) {
            let items = [];
            if (Array.isArray(json.data)) items = json.data;
            else if (Array.isArray(json.data.products)) items = json.data.products;

            for (const item of items) {
              const parsed = parseApiProduct(item, cat);
              if (parsed && parsed.bhx_sku) {
                productsMap.set(parsed.bhx_sku, parsed);
              }
            }
          }
        }
      } catch (e) {}
    });

    try {
      await page.goto(cat.url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      console.log(`! goto networkidle timeout cho ${cat.url}, tiếp tục phân tích...`);
    }

    // Cuộn trang 3 lần
    for (let s = 1; s <= 3; s++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(1000);
    }

    // Cơ chế 2: Bóc tách SSR/DOM
    const domItems = await page.evaluate(() => {
      const list = [];
      const titleElements = document.querySelectorAll('h3.product_name, [class*="product_name"]');
      titleElements.forEach((titleEl) => {
        const name = titleEl.innerText.trim();
        if (!name) return;

        let card = titleEl;
        let depth = 0;
        while (card.parentElement && depth < 6 && !card.innerText.includes('₫') && !card.innerText.includes('đ')) {
          card = card.parentElement;
          depth++;
        }

        const cardText = card ? card.innerText : '';
        const linkEl = card ? (card.querySelector('a[href]') || titleEl.closest('a')) : titleEl.closest('a');
        const href = linkEl ? linkEl.getAttribute('href') : '';
        const imgEl = card ? card.querySelector('img') : null;
        const imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';

        const priceMatches = Array.from(cardText.matchAll(/(\d{1,3}(?:\.\d{3})+)\s*[₫đ]/g));
        let price = 0;
        let originalPrice = null;
        if (priceMatches.length >= 1) {
          price = parseInt(priceMatches[0][1].replace(/\./g, ''), 10);
        }
        if (priceMatches.length >= 2) {
          originalPrice = parseInt(priceMatches[1][1].replace(/\./g, ''), 10);
        }

        let unitLabel = null;
        const unitMatch = cardText.match(/\/\s*([A-Za-zÀ-ỹ0-9]+)/);
        if (unitMatch) unitLabel = unitMatch[1];

        const sku = href ? href.replace(/^\/[^/]+\//, '').replace(/\//g, '-').replace(/\.html$/, '') : name;

        if (name && (price > 0 || href)) {
          list.push({ sku, name, slug: href ? href.replace(/^\//, '') : null, price, originalPrice, unitLabel, imageUrl });
        }
      });
      return list;
    });

    for (const d of domItems) {
      if (d.sku && !productsMap.has(d.sku)) {
        const weight = extractWeight(d.name + (d.unitLabel ? ` ${d.unitLabel}` : ''));
        productsMap.set(d.sku, {
          bhx_sku: d.sku,
          name: d.name,
          slug: d.slug,
          category_id: cat.id,
          category_name: cat.name,
          price: d.price || 0,
          original_price: d.originalPrice,
          unit_label: d.unitLabel || weight.unit,
          in_stock: true,
          is_cooking_ingredient: true,
          net_weight_value: weight.value,
          net_weight_unit: weight.unit,
          image_url: d.imageUrl || null,
        });
      }
    }

    await page.close();

    const categoryProducts = Array.from(productsMap.values());
    console.log(`✓ Thu thập được ${categoryProducts.length} sản phẩm.`);

    if (categoryProducts.length > 0) {
      const saved = await saveProducts(pool, categoryProducts);
      console.log(`✓ Đã lưu/cập nhật vào MySQL (${saved} affected rows).`);
    }

    // Cập nhật last_scraped_at cho danh mục trong bảng bhx_categories
    if (cat.id) {
      await pool.query('UPDATE bhx_categories SET last_scraped_at = NOW() WHERE id = ?', [cat.id]);
      console.log(`✓ Đã cập nhật last_scraped_at cho danh mục id ${cat.id}.`);
    }

    // Delay ngẫu nhiên 2 - 4 giây giữa các trang để bảo vệ IP
    if (idx < categories.length - 1) {
      const delay = Math.floor(Math.random() * 2000) + 2000;
      console.log(`⏳ Tạm dừng ${delay}ms trước khi sang danh mục tiếp theo...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  await browser.close();

  // Báo cáo tổng thể
  const [totalRows] = await pool.query('SELECT COUNT(*) AS total FROM bhx_products');
  console.log('\n==================================================');
  console.log('            BÁO CÁO CÀO DỮ LIỆU HOÀN TẤT         ');
  console.log('==================================================');
  console.log(`✓ Tổng số sản phẩm hiện có trong bảng bhx_products: ${totalRows[0].total}`);

  const [topCats] = await pool.query(`
    SELECT category_name, COUNT(*) as product_count, AVG(price) as avg_price 
    FROM bhx_products 
    GROUP BY category_name 
    ORDER BY product_count DESC 
    LIMIT 10
  `);
  console.table(topCats);

  await pool.end();
}

if (require.main === module) {
  scrapeAll().catch((err) => {
    console.error('Fatal scrape error:', err);
    process.exit(1);
  });
}

module.exports = { scrapeAll, extractWeight };
