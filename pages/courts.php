<?php
/** TÌM KIẾM SÂN — PHP nạp danh sách sân, JS lọc / sắp xếp / phân trang tại trình duyệt. */
render_page([
    'title' => 'Tìm kiếm sân thể thao - ' . SITE_NAME,
    'script' => 'pages/courts.js',
    'data' => [
        'courts' => public_courts(),
        'areas' => court_areas(),
        'priceRanges' => PRICE_RANGES,
        'params' => [ 
            'sport' => $_GET['sport'] ?? 'all',
            'area' => $_GET['area'] ?? '',
            'q' => $_GET['q'] ?? '',
            'date' => $_GET['date'] ?? '',
            'time' => $_GET['time'] ?? '',
        ],
    ],
], function () {
    page_hero([['Trang chủ', '/'], ['Tìm kiếm sân thể thao']], 'Tìm kiếm sân thể thao',
        'Hơn 30 sân bóng đá và sân cầu lông tại Buôn Ma Thuột. Lọc theo khu vực, mức giá và trạng thái để chọn sân phù hợp nhất.',
        function () { ?>
<form id="keyword-form" class="w-full max-w-2xl">
  <div class="flex items-center gap-2 rounded-full border border-background-300 bg-background-100 p-1.5 shadow-lg shadow-background-50/40 transition-colors focus-within:border-primary-400">
    <i class="ri-search-line ml-2.5 text-lg text-primary-500" aria-hidden="true"></i>
    <input type="search" name="keyword" placeholder="Nhập tên sân, đường hoặc khu vực..." aria-label="Tìm kiếm sân theo tên hoặc khu vực" class="w-full min-w-0 bg-transparent py-2 text-sm text-foreground-950 placeholder:text-foreground-500 focus:outline-none">
    <button type="submit" class="whitespace-nowrap rounded-full bg-primary-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600">Tìm</button>
  </div>
</form> 
<?php });
    ?>
<div class="w-full px-4 md:px-8 py-8 md:py-10">
  <div class="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
    <aside class="hidden lg:block">
      <div class="sticky top-[88px] rounded-lg border border-background-200 bg-white p-5" data-filter-panel></div>
    </aside>
    <div>
      <div id="slot-hint"></div>
      <div class="flex flex-col gap-4 rounded-lg border border-background-200 bg-white px-4 py-3.5 md:flex-row md:items-center md:justify-between">
        <p class="text-sm text-foreground-600" id="result-summary"></p>
        <div class="flex items-center gap-2.5">
          <button type="button" id="open-drawer" class="relative flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-sm font-semibold text-foreground-800 lg:hidden"><i class="ri-filter-3-line" aria-hidden="true"></i>Bộ lọc<span id="filter-count"></span></button>
          <div class="relative ml-auto">
            <select id="sort" aria-label="Sắp xếp kết quả" class="cursor-pointer appearance-none rounded-md border border-background-300 bg-white py-2 pl-3 pr-9 text-sm font-medium text-foreground-800 focus:border-primary-400 focus:outline-none">
              <option value="featured">Sân nổi bật</option><option value="price-asc">Giá thấp đến cao</option><option value="price-desc">Giá cao đến thấp</option><option value="rating">Đánh giá cao nhất</option>
            </select>
            <i class="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400" aria-hidden="true"></i>
          </div>
        </div>
      </div>
      <div id="results"></div>
      <nav id="pager" class="mt-8 flex items-center justify-center gap-1.5" aria-label="Phân trang"></nav>
    </div>
  </div>
</div>
<div id="drawer" class="fixed inset-0 z-[60] hidden lg:hidden">
  <button type="button" aria-label="Đóng bộ lọc" data-close-drawer class="absolute inset-0 h-full w-full bg-background-50/60"></button>
  <div class="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-lg bg-white p-5 animate-fade-up">
    <div data-filter-panel></div>
    <button type="button" data-close-drawer id="drawer-apply" class="mt-5 w-full whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-white"></button>
  </div>
</div>
<?php
});
