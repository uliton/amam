// Regenerate the app icons on macOS:
// swift scripts/generate-icons.swift public
import AppKit

let output = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "public", isDirectory: true)
try FileManager.default.createDirectory(at: output.appendingPathComponent("icons"), withIntermediateDirectories: true)

func render(size: Int, maskable: Bool = false, rounded: Bool = false) -> Data {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: size * 4, bitsPerPixel: 32)!
    let context = NSGraphicsContext(bitmapImageRep: bitmap)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    context.cgContext.scaleBy(x: CGFloat(size) / 1024, y: CGFloat(size) / 1024)
    NSColor(red: 232/255, green: 237/255, blue: 222/255, alpha: 1).setFill()
    let canvas = NSRect(x: 0, y: 0, width: 1024, height: 1024)
    if rounded {
        NSBezierPath(roundedRect: canvas, xRadius: 300, yRadius: 300).fill()
    } else {
        canvas.fill()
    }
    let text = NSAttributedString(string: "🍼", attributes: [.font: NSFont(name: "Apple Color Emoji", size: maskable ? 540 : 680)!])
    let bounds = text.size()
    context.cgContext.translateBy(x: 512, y: 512)
    context.cgContext.rotate(by: 9 * .pi / 180)
    text.draw(at: NSPoint(x: -bounds.width / 2, y: -bounds.height / 2 + 20))
    NSGraphicsContext.restoreGraphicsState()
    return bitmap.representation(using: .png, properties: [:])!
}

for (name, size, maskable, rounded) in [
    ("apple-touch-icon.png", 180, false, false),
    ("icons/icon-192.png", 192, false, false),
    ("icons/icon-512.png", 512, false, false),
    ("icons/icon-maskable-512.png", 512, true, false),
    ("icons/icon-1024.png", 1024, false, false),
    ("favicon-16.png", 16, false, true),
    ("favicon-32.png", 32, false, true),
    ("icons/favicon-48.png", 48, false, true),
] {
    try render(size: size, maskable: maskable, rounded: rounded).write(to: output.appendingPathComponent(name))
    print("Created \(name) (\(size)×\(size))")
}

// ICO directory with embedded PNG frames; supported by modern browsers.
var ico = Data([0, 0, 1, 0, 3, 0])
let frames = [(16, "favicon-16.png"), (32, "favicon-32.png"), (48, "icons/favicon-48.png")]
var payload = Data()
func appendLE(_ value: UInt32, to data: inout Data) {
    var number = value.littleEndian
    withUnsafeBytes(of: &number) { data.append(contentsOf: $0) }
}
for (size, path) in frames {
    let png = try Data(contentsOf: output.appendingPathComponent(path))
    ico.append(contentsOf: [UInt8(size), UInt8(size), 0, 0, 1, 0, 32, 0])
    appendLE(UInt32(png.count), to: &ico)
    appendLE(UInt32(6 + 16 * frames.count + payload.count), to: &ico)
    payload.append(png)
}
ico.append(payload)
try ico.write(to: output.appendingPathComponent("favicon.ico"))
