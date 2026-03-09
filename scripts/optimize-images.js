const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  inputDir: path.join(__dirname, '..', 'assets', 'img'),
  quality: 80,
  maxWidth: 1920,
  thumbnailWidth: 600,
  extensions: ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']
};

// Statistics tracking
const stats = {
  processed: 0,
  skipped: 0,
  errors: 0,
  totalOriginalSize: 0,
  totalOptimizedSize: 0
};

/**
 * Convert bytes to human readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get all image files recursively from a directory
 */
function getImageFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getImageFiles(filePath, fileList);
    } else if (CONFIG.extensions.includes(path.extname(file))) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

/**
 * Optimize a single image
 */
async function optimizeImage(inputPath) {
  const ext = path.extname(inputPath);
  const baseName = path.basename(inputPath, ext);
  const dirName = path.dirname(inputPath);
  const webpPath = path.join(dirName, `${baseName}.webp`);

  try {
    const originalStats = fs.statSync(inputPath);
    const originalSize = originalStats.size;
    stats.totalOriginalSize += originalSize;

    // Get image metadata
    const metadata = await sharp(inputPath).metadata();

    // Determine if we need to resize
    const needsResize = metadata.width > CONFIG.maxWidth;

    // Create WebP version
    let sharpInstance = sharp(inputPath);

    if (needsResize) {
      sharpInstance = sharpInstance.resize(CONFIG.maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside'
      });
    }

    await sharpInstance
      .webp({ quality: CONFIG.quality })
      .toFile(webpPath);

    const webpStats = fs.statSync(webpPath);
    const webpSize = webpStats.size;
    stats.totalOptimizedSize += webpSize;

    const savings = ((originalSize - webpSize) / originalSize * 100).toFixed(1);

    console.log(`[OK] ${path.relative(CONFIG.inputDir, inputPath)}`);
    console.log(`     ${formatBytes(originalSize)} -> ${formatBytes(webpSize)} (${savings}% smaller)`);

    stats.processed++;

    return {
      input: inputPath,
      output: webpPath,
      originalSize,
      optimizedSize: webpSize,
      savings: parseFloat(savings)
    };

  } catch (error) {
    console.error(`[ERROR] ${inputPath}: ${error.message}`);
    stats.errors++;
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Dreambite Image Optimizer');
  console.log('='.repeat(60));
  console.log(`\nInput directory: ${CONFIG.inputDir}`);
  console.log(`WebP quality: ${CONFIG.quality}%`);
  console.log(`Max width: ${CONFIG.maxWidth}px\n`);

  // Check if input directory exists
  if (!fs.existsSync(CONFIG.inputDir)) {
    console.error(`Error: Input directory does not exist: ${CONFIG.inputDir}`);
    process.exit(1);
  }

  // Get all image files
  const imageFiles = getImageFiles(CONFIG.inputDir);
  console.log(`Found ${imageFiles.length} images to process\n`);

  if (imageFiles.length === 0) {
    console.log('No images found to optimize.');
    return;
  }

  // Process images
  console.log('Processing images...\n');

  for (const imagePath of imageFiles) {
    await optimizeImage(imagePath);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('OPTIMIZATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nProcessed: ${stats.processed} images`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`\nTotal original size: ${formatBytes(stats.totalOriginalSize)}`);
  console.log(`Total optimized size: ${formatBytes(stats.totalOptimizedSize)}`);

  if (stats.totalOriginalSize > 0) {
    const totalSavings = ((stats.totalOriginalSize - stats.totalOptimizedSize) / stats.totalOriginalSize * 100).toFixed(1);
    console.log(`Total savings: ${formatBytes(stats.totalOriginalSize - stats.totalOptimizedSize)} (${totalSavings}%)`);
  }
}

// Run the script
main().catch(console.error);
