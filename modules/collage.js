/**
 * Smile!! Collage Maker Module
 */

export const THEME_CONFIGS = {
  classic: {
    bracketColor: 'rgba(255, 255, 255, 0.5)',
    downloadBg: '#f7f6f0',
    downloadInk: '#1a1a1a',
    downloadMetaInk: '#555555'
  },
  neon: {
    bracketColor: '#00f2fe',
    downloadBg: '#0e0d16',
    downloadInk: '#00f2fe',
    downloadMetaInk: '#9d4edd'
  },
  sage: {
    bracketColor: 'rgba(142, 168, 157, 0.6)',
    downloadBg: '#e5ece9',
    downloadInk: '#2e3b35',
    downloadMetaInk: '#556b60'
  }
};

export function drawImageContain(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let drawW = w;
  let drawH = h;
  let drawX = x;
  let drawY = y;
  
  if (imgRatio > targetRatio) {
    drawH = w / imgRatio;
    drawY = y + (h - drawH) / 2;
  } else {
    drawW = h * imgRatio;
    drawX = x + (w - drawW) / 2;
  }
  
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

export function renderCollage(canvas, photos, title, activeTheme, collageLayout) {
  return new Promise((resolve) => {
    const dc = canvas.getContext('2d');
    const layout = collageLayout;
    const cfg = THEME_CONFIGS[activeTheme] || THEME_CONFIGS.classic;
    const selectedPhotos = photos.slice(0, 12); // Take up to 12

    if (selectedPhotos.length === 0) {
      dc.clearRect(0, 0, canvas.width, canvas.height);
      resolve();
      return;
    }

    const targetCount = layout === 'contact' ? Math.min(selectedPhotos.length, 12) : Math.min(selectedPhotos.length, 4);
    let loadedCount = 0;
    const checkResolve = () => {
      loadedCount++;
      if (loadedCount === targetCount) {
        resolve();
      }
    };

  // 1. Grid layout (2x2 Polaroids collage)
  if (layout === 'grid') {
    canvas.width = 1000;
    canvas.height = 1000;

    dc.fillStyle = cfg.downloadBg;
    dc.fillRect(0, 0, canvas.width, canvas.height);

    dc.font = 'bold 32px Courier New, monospace';
    dc.fillStyle = cfg.downloadInk;
    dc.textAlign = 'center';
    dc.fillText(title.toUpperCase(), 500, 70);

    dc.font = '16px Courier New, monospace';
    dc.fillStyle = cfg.downloadMetaInk;
    dc.fillText(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase(), 500, 105);

    const cells = [
      { x: 80, y: 150, w: 380, h: 360 },
      { x: 540, y: 150, w: 380, h: 360 },
      { x: 80, y: 550, w: 380, h: 360 },
      { x: 540, y: 550, w: 380, h: 360 }
    ];

    const drawGridCell = (photo, cell) => {
      // Draw white paper base shadow card
      dc.fillStyle = '#ffffff';
      dc.fillRect(cell.x, cell.y, cell.w, cell.h);
      
      dc.strokeStyle = '#e2e2d9';
      dc.lineWidth = 1;
      dc.strokeRect(cell.x, cell.y, cell.w, cell.h);

      const img = new Image();
      img.onload = () => {
        const pad = 12;
        const photoH = cell.h - 60;
        drawImageContain(dc, img, cell.x + pad, cell.y + pad, cell.w - pad * 2, photoH);

        dc.font = 'bold 13px Courier New, monospace';
        dc.fillStyle = '#222';
        dc.textAlign = 'left';
        dc.fillText(photo.caption || `SNAP #${String(photo.frameNum).padStart(2, '0')}`, cell.x + pad + 2, cell.y + cell.h - 36);
        dc.font = '10px Courier New, monospace';
        dc.fillStyle = '#666';
        dc.fillText(`${photo.date}  ${photo.time}`, cell.x + pad + 2, cell.y + cell.h - 18);
        
        checkResolve();
      };
      img.src = photo.dataUrl;
    };

    for (let i = 0; i < Math.min(selectedPhotos.length, 4); i++) {
      drawGridCell(selectedPhotos[i], cells[i]);
    }
  }
  
  // 2. Strip layout (Vertical 35mm photobooth cut)
  else if (layout === 'strip') {
    canvas.width = 460;
    canvas.height = 1380;

    dc.fillStyle = '#0a0a0d';
    dc.fillRect(0, 0, canvas.width, canvas.height);

    // Left and right sprocket hole strips
    const drawSprockets = (x) => {
      dc.fillStyle = '#17161b';
      dc.fillRect(x, 0, 32, canvas.height);
      dc.fillStyle = '#000000';
      for (let y = 15; y < canvas.height; y += 40) {
        dc.fillRect(x + 8, y, 16, 20);
      }
    };
    drawSprockets(10);
    drawSprockets(canvas.width - 42);

    const imgH = 240;
    const gap = 55;
    const startY = 70;

    const drawStripCell = (photo, i) => {
      const y = startY + i * (imgH + gap);
      const x = 60;
      const w = 340;

      dc.strokeStyle = 'rgba(255,176,0,0.15)';
      dc.lineWidth = 1;
      dc.strokeRect(x - 1, y - 1, w + 2, imgH + 2);

      const img = new Image();
      img.onload = () => {
        drawImageContain(dc, img, x, y, w, imgH);

        dc.font = 'bold 11px Courier New, monospace';
        dc.fillStyle = '#d97e2b';
        dc.textAlign = 'left';
        dc.fillText('SNIP SNAP! SAFETY FILM', x, y - 8);
        dc.textAlign = 'right';
        dc.fillText(String(photo.frameNum).padStart(2, '0'), x + w, y - 8);
        dc.textAlign = 'left';
        dc.fillText(`SNP35-${photo.time}`, x, y + imgH + 14);

        checkResolve();
      };
      img.src = photo.dataUrl;
    };

    for (let i = 0; i < Math.min(selectedPhotos.length, 4); i++) {
      drawStripCell(selectedPhotos[i], i);
    }
  }

  // 3. Contact Sheet (3x4 photographer's proof sheet)
  else if (layout === 'contact') {
    canvas.width = 960;
    canvas.height = 1250;

    dc.fillStyle = '#111111';
    dc.fillRect(0, 0, canvas.width, canvas.height);

    dc.font = 'bold 22px Courier New, monospace';
    dc.fillStyle = '#7c7c7c';
    dc.textAlign = 'left';
    dc.fillText(title.toUpperCase(), 50, 55);
    
    dc.textAlign = 'right';
    dc.fillText(new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }), 910, 55);

    dc.strokeStyle = '#222';
    dc.lineWidth = 1.5;
    dc.beginPath();
    dc.moveTo(50, 75);
    dc.lineTo(910, 75);
    dc.stroke();

    const cellW = 250;
    const cellH = 220;
    const startX = 65;
    const startY = 110;
    const gapX = 40;
    const gapY = 50;

    const drawThumb = (photo, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = startX + col * (cellW + gapX);
      const y = startY + row * (cellH + gapY);

      dc.strokeStyle = '#1d1d1d';
      dc.lineWidth = 2;
      dc.strokeRect(x, y, cellW, cellH);

      const img = new Image();
      img.onload = () => {
        drawImageContain(dc, img, x, y, cellW, cellH);

        // Handwritten red numbers and indicators
        dc.font = 'italic bold 13px Comic Sans MS, Courier New, monospace';
        dc.fillStyle = '#eb4c56';
        dc.textAlign = 'left';
        dc.fillText(`#${String(photo.frameNum).padStart(2, '0')}`, x + 6, y + cellH - 10);

        if (photo.frameNum % 3 === 0) {
          dc.strokeStyle = 'rgba(235, 76, 86, 0.4)';
          dc.lineWidth = 2;
          dc.beginPath();
          dc.moveTo(x + cellW - 20, y + 10);
          dc.lineTo(x + cellW - 8, y + 22);
          dc.moveTo(x + cellW - 8, y + 10);
          dc.lineTo(x + cellW - 20, y + 22);
          dc.stroke();
        }

        checkResolve();
      };
      img.src = photo.dataUrl;
    };

    for (let i = 0; i < Math.min(selectedPhotos.length, 12); i++) {
      drawThumb(selectedPhotos[i], i);
    }
  });
}
