<?php
/** Nội dung tĩnh của website (ảnh, lợi ích, quy trình, đánh giá mẫu...). */

const HERO_IMAGE = 'https://readdy.ai/api/search-image?query=Wide%20shot%20of%20a%20floodlit%20artificial%20turf%20football%20pitch%20at%20night%20in%20a%20tropical%20Vietnamese%20city%2C%20deep%20green%20grass%2C%20white%20line%20markings%2C%20glowing%20stadium%20lights%2C%20dramatic%20dark%20sky%2C%20atmospheric%20haze%2C%20cinematic%20sports%20photography&width=1600&height=900&seq=bmt-hero-pitch-01&orientation=landscape';
const CATEGORY_IMAGE_FOOTBALL = 'https://readdy.ai/api/search-image?query=Modern%20artificial%20grass%20football%20field%20with%20white%20goal%20net%20at%20golden%20hour%2C%20trimmed%20green%20turf%2C%20surrounding%20green%20mesh%20fence%2C%20warm%20sunlight%2C%20clean%20editorial%20sports%20photography%2C%20no%20people&width=900&height=700&seq=bmt-cat-football-01&orientation=landscape';
const CATEGORY_IMAGE_BADMINTON = 'https://readdy.ai/api/search-image?query=Indoor%20badminton%20court%20with%20polished%20wooden%20flooring%2C%20green%20court%20mat%2C%20net%20in%20center%2C%20high%20ceiling%20with%20bright%20sports%20lighting%2C%20clean%20modern%20sports%20hall%2C%20wide%20angle%2C%20no%20people&width=900&height=700&seq=bmt-cat-badminton-01&orientation=landscape';
const ACCOUNT_IMAGE = 'https://readdy.ai/api/search-image?query=Vietnamese%20amateur%20football%20team%20group%20photo%20on%20a%20green%20artificial%20turf%20pitch%20at%20dusk%2C%20players%20in%20green%20jerseys%20smiling%2C%20warm%20floodlights%2C%20documentary%20sports%20photography%2C%20friendly%20atmosphere&width=1200&height=700&seq=bmt-account-banner-01&orientation=landscape';
const FACILITY_IMAGES = ['https://readdy.ai/api/search-image?query=Clean%20modern%20sports%20changing%20room%20with%20light%20wood%20lockers%2C%20benches%2C%20bright%20neutral%20lighting%2C%20minimal%20interior%20photography%2C%20no%20people&width=1000&height=700&seq=bmt-facility-locker-01&orientation=landscape', 'https://readdy.ai/api/search-image?query=Small%20sports%20club%20canteen%20counter%20with%20water%20bottles%20and%20energy%20drinks%2C%20wooden%20shelves%2C%20warm%20ambient%20lighting%2C%20clean%20minimal%20interior%2C%20no%20people&width=1000&height=700&seq=bmt-facility-drinks-01&orientation=landscape'];
const SITE_BENEFITS = [
    [
        'icon' => 'ri-search-eye-line',
        'title' => 'Tìm sân dễ dàng',
        'description' => 'Hơn 30 sân bóng đá và cầu lông tại Buôn Ma Thuột được cập nhật liên tục, tìm theo khu vực chỉ trong vài giây.',
    ],
    [
        'icon' => 'ri-price-tag-3-line',
        'title' => 'Giá thuê minh bạch',
        'description' => 'Giá niêm yết rõ ràng theo từng khung giờ, không phụ phí ẩn, giúp bạn chủ động tính toán chi phí cho cả đội.',
    ],
    [
        'icon' => 'ri-flashlight-line',
        'title' => 'Đặt sân nhanh chóng',
        'description' => 'Chọn ngày, chọn giờ và gửi yêu cầu trong chưa đến 2 phút. Chủ sân phản hồi trực tiếp qua điện thoại.',
    ],
    [
        'icon' => 'ri-shield-check-line',
        'title' => 'Thông tin rõ ràng',
        'description' => 'Hình ảnh thực tế, tiện ích, giờ mở cửa và đánh giá từ người chơi trước giúp bạn chọn đúng sân ngay lần đầu.',
    ],
];
const SITE_STEPS = [
    [
        'number' => '01',
        'icon' => 'ri-search-line',
        'title' => 'Tìm sân phù hợp',
        'description' => 'Lọc theo môn thể thao, khu vực và khoảng giá để tìm sân gần bạn nhất tại Buôn Ma Thuột.',
    ],
    [
        'number' => '02',
        'icon' => 'ri-calendar-check-line',
        'title' => 'Chọn ngày và khung giờ',
        'description' => 'Xem khung giờ còn trống theo thời gian thực, chọn thời lượng chơi mong muốn cho đội của bạn.',
    ],
    [
        'number' => '03',
        'icon' => 'ri-checkbox-circle-line',
        'title' => 'Xác nhận và ra sân',
        'description' => 'Điền thông tin liên hệ, nhận mã đặt sân và có mặt đúng giờ. Thanh toán tại sân hoặc chuyển khoản.',
    ],
];
const SITE_REVIEWS = [
    [
        'name' => 'Nguyễn Minh Quân',
        'role' => 'Đội trưởng FC Ea Tam',
        'initials' => 'MQ',
        'rating' => 5,
        'content' => 'Mình đặt sân BMT Arena cho đội mỗi thứ Ba hằng tuần. Thao tác nhanh, giá hiển thị rõ ràng và chủ sân xác nhận rất sớm. Không còn cảnh gọi điện hỏi từng sân như trước.',
    ],
    [
        'name' => 'Trần Thu Hà',
        'role' => 'Nhóm cầu lông Phố Núi',
        'initials' => 'TH',
        'rating' => 5,
        'content' => 'Nhóm mình toàn người mới chơi, nhờ xem trước khung giờ trống và tiện ích nên chọn được sân Victory có điều hòa, chơi rất thoải mái. Giao diện dễ dùng, mẹ mình cũng đặt được.',
    ],
    [
        'name' => 'Phạm Đức Long',
        'role' => 'Cầu thủ phong trào TP. Buôn Ma Thuột',
        'initials' => 'ĐL',
        'rating' => 4,
        'content' => 'Điểm mình thích là thông tin sân rõ: mặt cỏ, giờ mở cửa, chỗ để xe. Đặt sân Thắng Lợi lúc 22 giờ vẫn nhận, rất hợp với người đi làm về muộn.',
    ],
];
const SITE_STATS = [
    [
        'value' => '30+',
        'label' => 'Sân thể thao tại Buôn Ma Thuột',
    ],
    [
        'value' => '1.200+',
        'label' => 'Lượt đặt sân mỗi tháng',
    ],
    [
        'value' => '4.8/5',
        'label' => 'Điểm đánh giá trung bình',
    ],
    [
        'value' => '24/7',
        'label' => 'Hỗ trợ đặt sân mọi lúc',
    ],
];
const SPORT_OPTIONS = [
    [
        'value' => 'all',
        'label' => 'Tất cả loại sân',
    ],
    [
        'value' => 'football',
        'label' => 'Sân bóng đá',
    ],
    [
        'value' => 'badminton',
        'label' => 'Sân cầu lông',
    ],
];
const PRICE_RANGES = [
    [
        'id' => 'all',
        'label' => 'Tất cả mức giá',
        'min' => 0,
        'max' => 1000000,
    ],
    [
        'id' => 'low',
        'label' => 'Dưới 100.000đ',
        'min' => 0,
        'max' => 100000,
    ],
    [
        'id' => 'mid',
        'label' => '100.000 - 200.000đ',
        'min' => 100000,
        'max' => 200000,
    ],
    [
        'id' => 'high',
        'label' => '200.000 - 350.000đ',
        'min' => 200000,
        'max' => 350000,
    ],
    [
        'id' => 'premium',
        'label' => 'Trên 350.000đ',
        'min' => 350000,
        'max' => 1000000,
    ],
];
const DEFAULT_SLOTS = ['05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
const CANCEL_REASONS = ['Bận việc gia đình, không thể ra sân', 'Thay đổi kế hoạch của đội', 'Muốn đổi sang khung giờ khác', 'Đặt nhầm sân hoặc nhầm ngày', 'Thời tiết xấu, không thể thi đấu', 'Lý do khác'];
const OWNER_REJECT_REASONS = ['Khung giờ này đã có khách khác giữ sân', 'Sân trùng lịch bảo trì, cần khắc phục mặt cỏ', 'Thông tin liên hệ chưa hợp lệ, không gọi được cho khách', 'Số lượng người vượt quá sức chứa của sân', 'Chủ sân tạm nghỉ trong khung giờ này'];
const CANCEL_OTHER_REASON = 'Lý do khác';
