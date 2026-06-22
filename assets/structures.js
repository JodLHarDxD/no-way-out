(() => {
  // Simple deterministic PRNG
  function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }

  // Draw a jittery line
  function drawJitterLine(ctx, x1, y1, x2, y2, segments, rand) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const lx = x1 + (x2 - x1) * t;
      const ly = y1 + (y2 - y1) * t;
      const jx = (rand() - 0.5) * 4;
      const jy = (rand() - 0.5) * 4;
      ctx.lineTo(lx + jx, ly + jy);
    }
    ctx.stroke();
  }

  // Abstract, geometric hut drawn with jittery strokes
  function drawHutGeometry(ctx, cx, cy, w, h, rand) {
    // A-frame roof
    drawJitterLine(ctx, cx, cy - h, cx - w/2, cy - h/3, 4, rand);
    drawJitterLine(ctx, cx, cy - h, cx + w/2, cy - h/3, 4, rand);
    drawJitterLine(ctx, cx - w/2, cy - h/3, cx + w/2, cy - h/3, 4, rand);
    
    // Cross beams on roof
    for(let i=0; i<3; i++) {
      const t = 0.3 + rand() * 0.4;
      const span = w * t * 0.8;
      drawJitterLine(ctx, cx - span/2, cy - h + h*t, cx + span/2, cy - h + h*t, 2, rand);
    }

    // Stilts / base
    drawJitterLine(ctx, cx - w*0.3, cy - h/3, cx - w*0.3, cy, 3, rand);
    drawJitterLine(ctx, cx + w*0.3, cy - h/3, cx + w*0.3, cy, 3, rand);

    // Inner abstract geometry (door/window structure)
    if (rand() > 0.5) {
      drawJitterLine(ctx, cx - w*0.1, cy - h*0.2, cx - w*0.1, cy - h*0.1, 2, rand);
      drawJitterLine(ctx, cx + w*0.1, cy - h*0.2, cx + w*0.1, cy - h*0.1, 2, rand);
      drawJitterLine(ctx, cx - w*0.1, cy - h*0.2, cx + w*0.1, cy - h*0.2, 2, rand);
    }
  }

  // Draw the entire village perspective
  function drawVillagePerspective(ctx, width, height, opts, rand) {
    const vpX = width / 2;
    const vpY = opts.baseBand[0]; // Vanishing point height
    const bottomY = opts.baseBand[1]; // Bottom of the path

    ctx.lineWidth = 1;
    
    // Draw the subtle path lines leading to vanishing point
    ctx.strokeStyle = opts.palette[0];
    ctx.globalAlpha = 0.2;
    drawJitterLine(ctx, vpX, vpY, vpX - width*0.15, bottomY, 8, rand);
    drawJitterLine(ctx, vpX, vpY, vpX + width*0.15, bottomY, 8, rand);

    // Generate houses along both sides
    // Z from 0 (closest) to 1 (furthest)
    const houseCount = opts.count; // say 30
    const houses = [];
    for(let i=0; i<houseCount; i++) {
      houses.push({
        z: rand(), // Depth 
        side: rand() > 0.5 ? 1 : -1, // Right or Left
        offset: 0.15 + rand() * 0.35 // Distance from center path
      });
    }

    // Sort by Z descending (draw furthest first)
    houses.sort((a, b) => b.z - a.z);

    houses.forEach(h => {
      // Perspective calculations
      const t = 1 - h.z; // 1 is closest, 0 is furthest
      const y = vpY + (bottomY - vpY) * Math.pow(t, 1.5); // Exponential depth
      const pathWidthAtY = width * 0.15 * Math.pow(t, 1.5);
      const x = vpX + h.side * (pathWidthAtY + width * h.offset * t);
      
      const scale = opts.scaleRange[0] + (opts.scaleRange[1] - opts.scaleRange[0]) * t;
      const w = 40 * scale;
      const h_hut = 60 * scale;

      const ci = Math.min(opts.palette.length - 1, Math.floor(h.z * opts.palette.length));
      ctx.strokeStyle = opts.palette[ci];
      
      // Far houses are faint, close are stark
      ctx.globalAlpha = 0.15 + t * 0.55;
      
      drawHutGeometry(ctx, x, y, w, h_hut, rand);
    });
  }

  // Draw the Creature Bust
  // Massive, shadowy, zombie-like structure from chest up
  function drawCreatureBust(ctx, width, height, opts, rand) {
    const cx = width / 2;
    const bottomY = height;
    
    const count = opts.count || 3;
    
    for (let c = 0; c < count; c++) {
      const offsetX = cx + (rand() - 0.5) * width * 0.8;
      const offsetY = bottomY + rand() * height * 0.2;
      const scale = opts.scaleRange[0] + rand() * (opts.scaleRange[1] - opts.scaleRange[0]);
      
      const bustW = 150 * scale;
      const bustH = 300 * scale;
      
      const headY = offsetY - bustH * 0.8;
      const headR = 40 * scale;
      
      ctx.globalAlpha = 0.15; // very faint layers
      const palIndex = Math.floor(rand() * opts.palette.length);
      ctx.strokeStyle = opts.palette[palIndex];
      ctx.lineWidth = 1;

      // Draw shadow structure (Chest/Shoulders/Neck) - hundreds of frantic strokes
      for(let i=0; i<300; i++) {
        // Spine
        if (rand() > 0.8) {
          drawJitterLine(ctx, offsetX + (rand()-0.5)*20, offsetY, offsetX + (rand()-0.5)*10, headY + headR, 4, rand);
        }
        // Shoulders
        if (rand() > 0.7) {
          const sx = offsetX + (rand() > 0.5 ? 1 : -1) * rand() * bustW/2;
          const sy = headY + headR * 1.5 + rand() * bustH*0.3;
          drawJitterLine(ctx, offsetX, headY + headR, sx, sy, 3, rand);
        }
        // Shadow/Gore strands around head
        const hx = offsetX + (rand() - 0.5) * headR * 2;
        const hy = headY + (rand() - 0.5) * headR * 2;
        drawJitterLine(ctx, offsetX, headY, hx, hy, 2, rand);
      }

      // Add the white, stark structural details (The Smile/Teeth)
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      
      // Jagged Smile
      const smileY = headY + headR * 0.3;
      const smileW = headR * 0.8;
      
      ctx.beginPath();
      // Draw the jagged smile line
      ctx.moveTo(offsetX - smileW/2, smileY - headR*0.2);
      ctx.lineTo(offsetX - smileW*0.3, smileY);
      ctx.lineTo(offsetX, smileY + headR*0.1);
      ctx.lineTo(offsetX + smileW*0.3, smileY);
      ctx.lineTo(offsetX + smileW/2, smileY - headR*0.2);
      ctx.stroke();

      // Teeth struts
      ctx.lineWidth = 1;
      for(let t=-2; t<=2; t++) {
        const tx = offsetX + t * (smileW * 0.15);
        drawJitterLine(ctx, tx, smileY - headR*0.15, tx + (rand()-0.5)*4, smileY + headR*0.15, 2, rand);
      }
      
      // Hollow, staring eye sockets (empty geometric frames)
      const eyeOffset = headR * 0.35;
      const eyeY = headY - headR * 0.2;
      // Left eye
      drawJitterLine(ctx, offsetX - eyeOffset, eyeY, offsetX - eyeOffset + 8*scale, eyeY - 6*scale, 1, rand);
      drawJitterLine(ctx, offsetX - eyeOffset + 8*scale, eyeY - 6*scale, offsetX - eyeOffset + 12*scale, eyeY + 4*scale, 1, rand);
      drawJitterLine(ctx, offsetX - eyeOffset + 12*scale, eyeY + 4*scale, offsetX - eyeOffset, eyeY, 1, rand);
      // Right eye
      drawJitterLine(ctx, offsetX + eyeOffset, eyeY, offsetX + eyeOffset - 8*scale, eyeY - 6*scale, 1, rand);
      drawJitterLine(ctx, offsetX + eyeOffset - 8*scale, eyeY - 6*scale, offsetX + eyeOffset - 12*scale, eyeY + 4*scale, 1, rand);
      drawJitterLine(ctx, offsetX + eyeOffset - 12*scale, eyeY + 4*scale, offsetX + eyeOffset, eyeY, 1, rand);
    }
  }

  window.NWOStructures = {
    renderStructures: function(canvas, opts) {
      canvas.width = opts.width;
      canvas.height = opts.height;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const rand = mulberry32(opts.seed);

      if (opts.type === "huts") {
        drawVillagePerspective(ctx, opts.width, opts.height, opts, rand);
      } else if (opts.type === "creatures") {
        drawCreatureBust(ctx, opts.width, opts.height, opts, rand);
      }
    }
  };
})();
