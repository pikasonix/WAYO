# PDPTW Visualizer Frontend

Ứng dụng visualizer cho bài toán Pickup and Delivery Problem with Time Windows (PDPTW) với các tính năng tích hợp bản đồ và traffic monitoring.

## 🚀 Tính năng chính

### 1. PDPTW Solver
- Giải bài toán PDPTW sử dụng thuật toán Hybrid ACO-Greedy
- Visualize kết quả trên bản đồ Leaflet
- Tạo instance mới thông qua giao diện drag-and-drop
- Import/Export instance và solution

### 2. Map Integration
- **Leaflet Maps** - Bản đồ chính cho PDPTW visualization
- **OpenStreetMap** - Dữ liệu bản đồ mở miễn phí
- **OSRM Routing** - Tính toán tuyến đường thực tế
- Real-time routing với cache optimization

### 3. Traffic Monitoring
- **🇻🇳 Track Asia Maps** - Giải pháp bản đồ số Việt Nam (Khuyên dùng)
- **Google Maps** - Traffic layer và real-time data
- **Multi-provider** - OpenStreetMap, Mapbox, HERE APIs
- Real-time traffic conditions và incident reporting

## 🇻🇳 Track Asia Maps - Recommended Solution

Track Asia là giải pháp bản đồ số được phát triển tại Việt Nam, tối ưu cho khu vực Đông Nam Á:

### Ưu điểm:
- ✅ **Made in Vietnam** - Không bị chặn, dữ liệu tối ưu cho VN
- ✅ **Chi phí thấp** - Rẻ hơn Google Maps 3-5 lần
- ✅ **API đầy đủ** - Maps, Routing, Geocoding, Traffic
- ✅ **Hỗ trợ tiếng Việt** - Documentation và support bằng tiếng Việt
- ✅ **Dùng thử miễn phí** - Không cần thẻ tín dụng

### Quick Setup:
```bash
# Cài đặt Track Asia GL JS
npm install trackasia-gl

# Tạo file .env
echo "VITE_TRACK_ASIA_API_KEY=your_api_key" > .env
```

📖 **Chi tiết setup**: Xem [TRACK_ASIA_SETUP.md](./TRACK_ASIA_SETUP.md)

## 🛠️ Technology Stack

### Frontend Framework
- **React 18+** - Modern React with functional components và hooks
- **Vite** - Fast build tool và development server
- **Tailwind CSS** - Utility-first CSS framework
- **ESLint** - Code linting và formatting

### Maps & Routing
- **Leaflet** - Primary map library cho PDPTW visualization
- **Track Asia GL JS** - Advanced mapping cho traffic monitoring
- **Google Maps API** - Alternative traffic solution
- **OSRM** - Open source routing machine
- **Nominatim** - Geocoding service

### State Management
- React Hooks (useState, useEffect, useCallback)
- Custom hooks cho file reading và map controls
- Context API cho global state

## 📦 Installation & Setup

### Prerequisites
- Node.js 16+
- npm hoặc yarn
- API keys (optional cho enhanced features)

### Installation
```bash
# Clone repository
git clone <repository-url>
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables
Tạo file `.env` với các biến sau:

```bash
# Track Asia (Recommended for Vietnam)
VITE_TRACK_ASIA_API_KEY=your_track_asia_key

# Google Maps (Optional)
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_key

# Mapbox (Optional)
REACT_APP_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

## 🗺️ Map Providers Comparison

| Provider | Cost | Vietnam Data | Support | Recommended |
|----------|------|--------------|---------|-------------|
| Track Asia | 💰 Low | ⭐⭐⭐⭐⭐ | 🇻🇳 Vietnamese | ✅ **Best for VN** |
| Google Maps | 💰💰💰 High | ⭐⭐⭐⭐ | 🇺🇸 English | ⚠️ Expensive |
| OpenStreetMap | 🆓 Free | ⭐⭐⭐ | 🌍 Community | ✅ Good backup |
| Mapbox | 💰💰 Medium | ⭐⭐⭐ | 🇺🇸 English | ⚠️ Complex pricing |

## 📋 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors

# Testing (when implemented)
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
```

## 📁 Project Structure

```
frontend/
├── public/               # Static assets
├── src/
│   ├── components/       # React components
│   │   ├── MapComponent.jsx
│   │   ├── TrackAsiaTrafficPage.jsx
│   │   ├── GoogleTrafficMonitoringPage.jsx
│   │   └── AddInstancePage.jsx
│   ├── services/         # API services
│   │   ├── TrackAsiaTrafficService.js
│   │   └── GoogleMapsTrafficService.js
│   ├── utils/           # Utilities
│   │   ├── TrackAsiaLoader.js
│   │   └── dataModels.js
│   ├── styles/          # CSS files
│   │   ├── track-asia.css
│   │   └── App.css
│   ├── hooks/           # Custom React hooks
│   ├── config/          # Configuration
│   └── data/            # Sample data
├── .env.example         # Environment template
├── TRACK_ASIA_SETUP.md  # Track Asia setup guide
└── README.md
```

## 🎯 Usage Guide

### 1. PDPTW Problem Solving
1. **Load Instance**: Upload .txt file hoặc tạo mới qua "Tạo Instance"
2. **Configure Parameters**: Điều chỉnh các tham số ACO-Greedy
3. **Run Solver**: Click "Chạy thuật toán" để giải bài toán
4. **View Results**: Kết quả hiển thị trên bản đồ với routes và statistics

### 2. Creating New Instance
1. **Add Instance Page**: Click tab "Tạo Instance"
2. **Map Interaction**: Click trên bản đồ để thêm nodes
3. **Configure Nodes**: Set pickup/delivery points, time windows, demands
4. **Export**: Save instance để sử dụng sau

### 3. Traffic Monitoring
1. **Track Asia**: Tab "🇻🇳 Track Asia" - Recommended cho Việt Nam
2. **Google Traffic**: Tab "Google Traffic" - Requires billing setup
3. **Search Locations**: Tìm kiếm địa điểm và xem traffic conditions
4. **Real-time Data**: Theo dõi tình trạng giao thông thời gian thực

## 🔑 API Keys Setup

### Track Asia (Recommended)
1. Đăng ký tại [Track Asia Account](https://account.track-asia.com/)
2. Tạo API key miễn phí
3. Thêm vào .env: `VITE_TRACK_ASIA_API_KEY=your_key`

### Google Maps (Optional)
1. Tạo project tại [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Maps JavaScript API, Places API, Directions API
3. **⚠️ Cần kích hoạt billing** (bắt buộc)
4. Thêm vào .env: `REACT_APP_GOOGLE_MAPS_API_KEY=your_key`

## 🐛 Troubleshooting

### Common Issues

**Map không hiển thị:**
- Kiểm tra API key trong .env
- Restart development server sau khi thay đổi .env
- Kiểm tra browser console để xem lỗi

**Track Asia không load:**
- Verify API key tại [Track Asia Account](https://account.track-asia.com/)
- Kiểm tra network connectivity
- Thử refresh trang

**Google Maps billing error:**
- Enable billing tại [Google Cloud Console](https://console.cloud.google.com/billing)
- Chờ 5-10 phút để changes có hiệu lực
- Hoặc sử dụng Track Asia thay thế

## 🌟 Recommended Setup for Vietnam

Cho dự án tại Việt Nam, chúng tôi khuyên dùng:

1. **Primary**: Track Asia Maps - Chi phí thấp, dữ liệu tốt, hỗ trợ tiếng Việt
2. **Backup**: OpenStreetMap - Miễn phí, reliable
3. **Optional**: Google Maps - Chỉ khi cần advanced features và có budget

## 📞 Support

- **Track Asia**: support@track-asia.com | 093.182.4182
- **GitHub Issues**: [Create issue](../../issues) cho bugs và feature requests
- **Documentation**: [Track Asia Docs](https://docs.track-asia.com/)

## 📄 License

Dự án này sử dụng MIT License - xem [LICENSE](LICENSE) file để biết chi tiết.

---

**🇻🇳 Made for Vietnam** - Tối ưu cho các doanh nghiệp và developer Việt Nam với Track Asia Maps integration.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
