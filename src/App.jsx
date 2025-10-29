import { useState, useRef, useCallback } from 'react'
import { createWorker } from 'tesseract.js'
import Webcam from 'react-webcam'
import { motion, AnimatePresence } from 'framer-motion'

function App() {
  const [image, setImage] = useState(null)
  const [imageUrl, setImageUrl] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [detectedText, setDetectedText] = useState('')
  const [parsedAddress, setParsedAddress] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [showToast, setShowToast] = useState({ show: false, message: '' })
  const webcamRef = useRef(null)
  const fileInputRef = useRef(null)

  // UK/NI postcode regex: matches patterns like SW1A 1AA, BT1 1AA, etc.
  const POSTCODE_REGEX = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i

  const showToastMessage = (message) => {
    setShowToast({ show: true, message })
    setTimeout(() => setShowToast({ show: false, message: '' }), 3000)
  }

  const extractAddress = (text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    // Find the line with the postcode
    let postcodeIndex = -1
    for (let i = 0; i < lines.length; i++) {
      if (POSTCODE_REGEX.test(lines[i])) {
        postcodeIndex = i
        break
      }
    }

    if (postcodeIndex === -1) {
      // No postcode found, return original text
      return text
    }

    // Extract postcode from the line
    const postcodeMatch = lines[postcodeIndex].match(POSTCODE_REGEX)
    const postcode = postcodeMatch ? postcodeMatch[0] : lines[postcodeIndex]
    
    // Helper to check if a line is likely package metadata (not address)
    const isPackageMetadata = (line) => {
      const trimmed = line.trim()
      
      // Very short lines with weird characters (OCR noise like "3£")
      if (trimmed.length < 4 && /[£$€¥#@%&*+=<>]/.test(trimmed)) return true
      
      // Lines with too many special characters (likely OCR noise from barcodes/QR codes)
      const specialChars = trimmed.match(/[£$€¥#@%&*+=<>\[\]{}|\\\/~`^]/g) || []
      if (specialChars.length > 2 || (specialChars.length > 0 && trimmed.length < 8)) return true
      
      // Lines with random character patterns (no spaces, mixed case/number/special - OCR noise)
      if (trimmed.length > 3 && !/\s/.test(trimmed) && /[A-Za-z].*\d.*[£$€¥#@%&*]/.test(trimmed)) return true
      
      // Very long lines (likely tracking info or barcodes)
      if (trimmed.length > 40) return true
      
      // Long alphanumeric strings without spaces (tracking numbers)
      if (/^[A-Z0-9\-_]{15,}$/i.test(trimmed.replace(/\s/g, ''))) return true
      
      // Headers like "SHIP TO", "DELIVERY ADDRESS", etc.
      if (trimmed === trimmed.toUpperCase() && /^(SHIP|DELIVERY|ADDRESS|TO|FROM|ORDER|TRACKING|PARCEL|REF)/i.test(trimmed)) return true
      
      // Lines that are mostly numbers (tracking numbers)
      const numRatio = (trimmed.match(/\d/g) || []).length / trimmed.length
      if (numRatio > 0.8 && trimmed.length > 10) return true
      
      // Lines that don't have enough letters to be an address (likely OCR noise)
      const letterCount = (trimmed.match(/[A-Za-z]/g) || []).length
      if (letterCount < 2 && trimmed.length > 5) return true
      
      return false
    }
    
    // Helper to check if a line looks like a valid address line
    const isValidAddressLine = (line) => {
      const trimmed = line.trim()
      
      // Must have at least some letters (addresses need street names, town names, etc.)
      if (!/[A-Za-z]/.test(trimmed)) return false
      
      // Must be reasonable length (too short might be OCR fragments, too long might be something else)
      if (trimmed.length < 2 || trimmed.length > 50) return false
      
      // Should have reasonable letter-to-symbol ratio
      const letterCount = (trimmed.match(/[A-Za-z\s]/g) || []).length
      const letterRatio = letterCount / trimmed.length
      if (letterRatio < 0.4 && trimmed.length > 5) return false
      
      return true
    }
    
    // Work backwards from postcode, collecting address lines
    // UK addresses typically have: name, street, town/city, postcode (4-5 lines total with extra lines sometimes)
    const addressLines = []
    let linesToCheck = Math.min(8, postcodeIndex) // Check up to 8 lines before postcode
    
    for (let i = postcodeIndex - 1; i >= 0 && addressLines.length < 4 && linesToCheck > 0; i--) {
      const line = lines[i]
      
      // Skip package metadata and OCR noise
      if (isPackageMetadata(line)) {
        linesToCheck--
        continue
      }
      
      // Only add lines that look like valid address lines
      if (!isValidAddressLine(line)) {
        linesToCheck--
        continue
      }
      
      // If we already have 4 lines and this line doesn't look valid, stop
      if (addressLines.length >= 4) {
        break
      }
      
      // Add the line to address (working backwards, so insert at beginning)
      addressLines.unshift(line)
      linesToCheck--
    }
    
    // Add postcode at the end
    addressLines.push(postcode)
    
    return addressLines.join(', ')
  }

  const processImageWithOCR = async (imageSrc) => {
    setIsScanning(true)
    setDetectedText('')
    setParsedAddress('')

    try {
      const worker = await createWorker('eng')
      
      const { data: { text } } = await worker.recognize(imageSrc)
      
      await worker.terminate()

      setDetectedText(text)
      
      // Extract address if postcode is detected
      const address = extractAddress(text)
      setParsedAddress(address)
      
    } catch (error) {
      console.error('OCR Error:', error)
      showToastMessage('Failed to scan image. Please try again.')
    } finally {
      setIsScanning(false)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showToastMessage('Please select an image file.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result
      setImageUrl(url)
      setImage(file)
      setShowCamera(false)
      processImageWithOCR(url)
    }
    reader.readAsDataURL(file)
  }

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) {
      setImageUrl(imageSrc)
      setShowCamera(false)
      processImageWithOCR(imageSrc)
    }
  }, [])

  const openInMaps = (service) => {
    const address = parsedAddress || detectedText
    if (!address.trim()) {
      showToastMessage('No address detected. Please edit the address field.')
      return
    }

    const encodedAddress = encodeURIComponent(address)
    let url = ''

    switch (service) {
      case 'google':
        url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
        break
      case 'waze':
        url = `https://waze.com/ul?q=${encodedAddress}`
        break
      case 'here':
        // Use HERE WeGo app deep link - try app first, fallback to web if needed
        // Android and iOS both support heremaps://
        url = `heremaps://directions?daddr=${encodedAddress}`
        // If app isn't installed, user will need to install it or use web version
        break
      case 'apple':
        url = `https://maps.apple.com/?q=${encodedAddress}`
        break
      default:
        return
    }

    // For HERE WeGo app link, try location.href instead of window.open for better app opening
    if (service === 'here') {
      window.location.href = url
    } else {
      window.open(url, '_blank')
    }
  }

  const copyAddress = () => {
    const address = parsedAddress || detectedText
    if (!address.trim()) {
      showToastMessage('No address to copy.')
      return
    }

    navigator.clipboard.writeText(address)
      .then(() => showToastMessage('Address copied to clipboard!'))
      .catch(() => showToastMessage('Failed to copy address.'))
  }

  const reset = () => {
    setImage(null)
    setImageUrl(null)
    setDetectedText('')
    setParsedAddress('')
    setShowCamera(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Courier Address Scanner</h1>
          <p className="text-sm text-blue-100 mt-1">Scan & navigate quickly</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Privacy Notice */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
          <p className="text-sm text-green-800">
            🔒 <strong>Privacy:</strong> All image processing occurs locally in your browser. No data is uploaded or stored.
          </p>
        </div>

        {/* Image Upload/Camera Section */}
        {!imageUrl && !showCamera && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Scan Address Label</h2>
              
              <div className="space-y-3">
                <button
                  onClick={() => setShowCamera(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  📷 Capture Photo
                </button>
                
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="block w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg cursor-pointer transition-colors text-center"
                  >
                    📁 Upload from Gallery
                  </label>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Camera View */}
        {showCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-lg shadow-md p-4"
          >
            <div className="relative">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  facingMode: 'environment'
                }}
                className="w-full rounded-lg"
              />
              <div className="mt-4 flex gap-3">
                <button
                  onClick={capturePhoto}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  📸 Capture
                </button>
                <button
                  onClick={() => setShowCamera(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Image Preview & Results */}
        {imageUrl && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Image Preview */}
              <div className="bg-white rounded-lg shadow-md p-4">
                <img
                  src={imageUrl}
                  alt="Scanned label"
                  className="w-full rounded-lg border border-gray-200"
                />
              </div>

              {/* Loading Indicator */}
              {isScanning && (
                <div className="bg-white rounded-lg shadow-md p-6 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                  <p className="text-gray-600">Scanning...</p>
                </div>
              )}

              {/* Detected Text & Address */}
              {!isScanning && (
                <>
                  <div className="bg-white rounded-lg shadow-md p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Detected Address (editable)
                    </label>
                    <textarea
                      value={parsedAddress || detectedText}
                      onChange={(e) => setParsedAddress(e.target.value)}
                      className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Address will appear here..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="bg-white rounded-lg shadow-md p-4 space-y-3">
                    <h3 className="font-semibold text-gray-800 mb-2">Open in Navigation App</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => openInMaps('google')}
                        className="bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-lg transition-colors text-sm"
                      >
                        🗺️ Google Maps
                      </button>
                      
                      <button
                        onClick={() => openInMaps('waze')}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors text-sm"
                      >
                        🧭 Waze
                      </button>
                      
                      <button
                        onClick={() => openInMaps('here')}
                        className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors text-sm"
                      >
                        📍 HERE WeGo
                      </button>
                      
                      {isIOS && (
                        <button
                          onClick={() => openInMaps('apple')}
                          className="bg-gray-800 hover:bg-gray-900 text-white font-medium py-3 px-4 rounded-lg transition-colors text-sm"
                        >
                          🍎 Apple Maps
                        </button>
                      )}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={copyAddress}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-lg transition-colors"
                      >
                        📋 Copy Address
                      </button>
                      
                      <button
                        onClick={reset}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                      >
                        🔄 Reset
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50"
          >
            {showToast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
