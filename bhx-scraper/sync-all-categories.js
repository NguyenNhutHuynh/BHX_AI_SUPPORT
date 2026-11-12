/**
 * Đồng bộ toàn bộ danh mục từ Sitemap của Bách Hóa Xanh vào MySQL (bảng bhx_categories)
 */

const axios = require('axios');
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'bhx_master_db',
};

/**
 * Phân loại danh mục:
 * 1 (true) = danh mục thực phẩm, nguyên liệu nấu ăn (thịt, cá, rau, trứng, gia vị, gạo, v.v.)
 * 0 (false) = hóa mỹ phẩm, đồ gia dụng, vật dụng cá nhân
 */
function isFoodCategory(slug, name = '') {
  const text = (slug + ' ' + (name || '')).toLowerCase();

  // 1. Loại trừ hóa phẩm, tẩy rửa, chăm sóc cá nhân, đồ gia dụng
  const nonFoodRegex =
    /\b(bot-giat|nuoc-giat|nuoc-xa|nuoc-rua|lau-nha|tay-rua|ve-sinh|sua-tam|dau-goi|kem-danh-rang|khan-giay|giay-ve-sinh|ta-bim|khan-uot|tam-goi|cham-soc|my-pham|sua-rua-mat|duong-da|lan-khu-mui|bo-noi|chao-chong-dinh|lau-dien|gia-dung|pin|bat-dia|hop-dung|dao-keo|binh-giu-nhiet|mang-boc|khan-lau|tui-rac|moc-quan-ao|choi-quet|thung-rac|dien-gia-dung|bong-tay-trang|bang-ve-sinh|bao-cao-su|diet-con-trung|xa-bong|suc-mieng|tay-quan-ao|khau-trang|dung-cu|test-them)\b/i;
  if (nonFoodRegex.test(slug)) return false;

  // 2. Nhận diện các nguyên liệu nấu ăn và thực phẩm
  const foodRegex =
    /\b(thit|ca|hai-san|tom|muc|cua|oc|bo|ga|vit|heo|trung|rau|cu|qua|trai-cay|nam|dau-hu|dau-phu|cha|gio-cha|gia-vi|nuoc-mam|nuoc-tuong|dau-an|duong|muoi|hat-nem|bot-ngot|tieu|tuong-ot|sot|sa-te|giam|mam|gao|mi|bun|mien|pho|nui|banh-trang|do-kho|dau-hat|bot-che-bien|do-hop|xuc-xich|dong-lanh|thuc-pham|sua-tuoi|sua-chua|bo-pho-mai|tra-kho|ca-phe|ngu-coc|banh-keo|hu-tieu|thuc-uong|nuoc-ngot|bia)\b/i;

  return foodRegex.test(slug);
}

/**
 * Tải danh mục từ sitemap XML của BHX
 */
async function fetchCategoryUrlsFromSitemap() {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };

  let sitemapCateUrl = 'https://www.bachhoaxanh.com/sitemapnew/sitemap-cate';

  try {
    console.log(`> Đang kiểm tra sitemap chính https://www.bachhoaxanh.com/sitemapnew ...`);
    const rootRes = await axios.get('https://www.bachhoaxanh.com/sitemapnew', { headers, timeout: 15000 });
    const match = rootRes.data.match(/<loc>(https:\/\/www\.bachhoaxanh\.com\/sitemapnew\/sitemap-cate.*?)<\/loc>/);
    if (match) {
      sitemapCateUrl = match[1];
    }
  } catch (e) {
    console.log(`! Không đọc được sitemapnew, sử dụng URL mặc định: ${sitemapCateUrl}`);
  }

  console.log(`> Đang tải XML danh mục từ: ${sitemapCateUrl} ...`);
  const res = await axios.get(sitemapCateUrl, { headers, timeout: 20000 });
  const xml = res.data;

  // Trích xuất các URL từ thẻ <loc>
  const urlMatches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
  const urls = urlMatches.map((m) => m.replace(/<\/?loc>/g, '').trim()).filter(Boolean);

  console.log(`✓ Đã phân tích cú pháp sitemap XML: Tìm thấy ${urls.length} URLs danh mục.`);
  return urls;
}

/**
 * Lấy bảng ánh xạ tên tiếng Việt của danh mục từ Menu API
 */
async function fetchCategoryNames() {
  const map = new Map();
  try {
    const res = await axios.get(
      'https://api.bachhoaxanh.com/gw/Menu/GetMenuV2?ProvinceId=1027&WardId=0&StoreId=2546',
      { timeout: 10000 }
    );
    if (res.data && res.data.data) {
      function walk(item) {
        if (!item) return;
        if (item.url && item.name) {
          const slug = item.url.replace(/^\//, '').replace(/\.html$/, '');
          map.set(slug, item.name);
        }
        if (Array.isArray(item.menus)) item.menus.forEach(walk);
        if (Array.isArray(item.childrens)) item.childrens.forEach(walk);
        if (Array.isArray(item.child)) item.child.forEach(walk);
      }
      walk(res.data.data);
    }
  } catch (err) {
    console.log('! Không lấy được Menu API, sẽ tạo tên từ slug:', err.message);
  }
  return map;
}

/**
 * Chuyển đổi slug thành tên hiển thị nếu chưa có
 */
function slugToTitle(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function syncAllCategories() {
  console.log('=== BẮT ĐẦU ĐỒNG BỘ DANH MỤC TỪ SITEMAP BÁCH HÓA XANH ===\n');

  const pool = mysql.createPool(dbConfig);
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('✗ Lỗi kết nối MySQL:', err.message);
    process.exit(1);
  }

  // Đảm bảo bảng bhx_categories tồn tại
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bhx_categories (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(150) NOT NULL UNIQUE,
      name VARCHAR(150) NULL,
      url VARCHAR(255) NOT NULL,
      is_food_category TINYINT(1) DEFAULT 0,
      last_scraped_at TIMESTAMP NULL,
      created_at TIMESTAMP NULL,
      updated_at TIMESTAMP NULL,
      INDEX idx_is_food (is_food_category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 1. Tải danh sách URLs từ sitemap
  const urls = await fetchCategoryUrlsFromSitemap();

  // 2. Tải metadata tên danh mục từ Menu API
  const nameMap = await fetchCategoryNames();

  // 3. Chuẩn hóa dữ liệu danh mục
  const categories = [];
  const now = new Date();

  for (const fullUrl of urls) {
    const slug = fullUrl.replace('https://www.bachhoaxanh.com/', '').replace(/\/$/, '');
    if (!slug || slug.includes('sitemap')) continue;

    const name = nameMap.get(slug) || slugToTitle(slug);
    const isFood = isFoodCategory(slug, name) ? 1 : 0;

    categories.push([slug, name, fullUrl, isFood, null, now, now]);
  }

  // 4. Lưu danh mục vào MySQL với INSERT ... ON DUPLICATE KEY UPDATE
  console.log(`> Đang lưu ${categories.length} danh mục vào MySQL (bảng bhx_categories)...`);
  const insertSql = `
    INSERT INTO bhx_categories (slug, name, url, is_food_category, last_scraped_at, created_at, updated_at)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      url = VALUES(url),
      is_food_category = VALUES(is_food_category),
      updated_at = NOW()
  `;

  await pool.query(insertSql, [categories]);

  // 5. Thống kê kết quả
  const [counts] = await pool.query(`
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN is_food_category = 1 THEN 1 ELSE 0 END) AS food_count,
      SUM(CASE WHEN is_food_category = 0 THEN 1 ELSE 0 END) AS non_food_count
    FROM bhx_categories
  `);

  console.log('\n==================================================');
  console.log('       KẾT QUẢ ĐỒNG BỘ DANH MỤC TỪ SITEMAP        ');
  console.log('==================================================');
  console.log(`✓ Tổng danh mục đã lưu: ${counts[0].total}`);
  console.log(`✓ Danh mục Thực phẩm/Nấu ăn (is_food_category = 1): ${counts[0].food_count}`);
  console.log(`✓ Danh mục Hóa mỹ phẩm / Gia dụng (is_food_category = 0): ${counts[0].non_food_count}`);

  const [samples] = await pool.query(`
    SELECT id, slug, name, is_food_category, url
    FROM bhx_categories
    WHERE is_food_category = 1
    ORDER BY id ASC
    LIMIT 10
  `);
  console.log('\n10 danh mục thực phẩm mẫu:');
  console.table(samples);

  await pool.end();
  console.log('\n✓ Đồng bộ sitemap danh mục hoàn tất thành công!');
}

if (require.main === module) {
  syncAllCategories().catch((err) => {
    console.error('Fatal sync error:', err);
    process.exit(1);
  });
}

module.exports = { syncAllCategories, isFoodCategory };

