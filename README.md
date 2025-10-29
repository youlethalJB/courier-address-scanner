# Courier Address Scanner

A client-only web app for UK and Northern Ireland couriers to quickly scan parcel address labels and open them in navigation apps, without typing.

## Features

- 📷 **Camera Capture**: Take a photo directly from your device camera
- 📁 **Image Upload**: Upload an image from your gallery
- 🔍 **OCR Processing**: Client-side OCR using Tesseract.js (runs entirely in your browser)
- 🇬🇧 **UK/NI Address Detection**: Automatically detects and extracts UK/Northern Ireland addresses using postcode patterns
- 🗺️ **Quick Navigation**: Open addresses in:
  - Google Maps
  - Waze
  - HERE WeGo
  - Apple Maps (iOS only)
- ✏️ **Editable Results**: Edit the detected address before navigating
- 📋 **Copy Address**: Quickly copy the address to clipboard
- 🔄 **Reset**: Scan another parcel with one click
- 🔒 **Privacy First**: All processing happens locally in your browser - no data is uploaded or stored

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. **Capture or Upload**: Either take a photo of the address label or upload an existing image
2. **Wait for Scanning**: The app will automatically process the image using OCR
3. **Review & Edit**: Check the detected address in the editable text field
4. **Navigate**: Click on your preferred navigation app to open the address
5. **Reset**: Click "Reset" to scan another parcel

## Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Tesseract.js** - Client-side OCR
- **react-webcam** - Camera access
- **Framer Motion** - Smooth animations

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari (iOS)
- Mobile browsers

**Note**: Camera access requires HTTPS in production (localhost works for development).

## Privacy

This app runs entirely in your browser. No images or data are sent to any server. All OCR processing happens locally on your device.

## License

MIT

