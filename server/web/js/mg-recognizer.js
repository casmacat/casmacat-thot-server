
function MinGestures(conf) {
  
  var g = {
     N: "n", 
    NW: "nw", 
     W: "w", 
    SW: "sw", 
     S: "s", 
    SE: "se", 
     E: "e",
    NE: "ne"
  };

  // gesture straigh line thresholds
  var xBackThr  = conf && conf.xBackThr   ? conf.xBackThr   : 3; 
  var yBackThr  = conf && conf.yBackThr   ? conf.yBackThr   : 10; 
  var aspectThr = conf && conf.aspectThr ? conf.aspectThr : 3; 
  var dotThr    = conf && conf.dotThr    ? conf.dotThr : 5; 

  // Main/Secondary Angular Thresholds
  var mat = conf && conf.mat ? conf.mat : 10, 
      sat = conf && conf.sat ? conf.sat : 35;
  // Fit Pearson (SD not tested yet)
  var fp = conf && conf.fp ? conf.fp : 0.3, 
      fs = conf && conf.fs ? conf.fs : 0.2;
  
  function getGestureByAngle(angle) {
    // convert from radians to degrees
    angle *=180/Math.PI;
    // normalize the angle between -180 and 180
    angle = (angle + 180)%360 - 180;
    var code;
    if (angle >= 90 - mat && angle <= 90 + mat) {
      code = g.N;
    } else if (angle >=   135 - sat && angle <=  135 + sat) {
      code = g.NW;
    } else if ((angle >=  180 - mat && angle <=  180 + mat) || 
               (angle >= -180 - mat && angle <= -180 + mat)) {
      code = g.W;
    } else if (angle >=  -135 - sat && angle <= -135 + sat) {
      code = g.SW;
    } else if (angle >=   -90 - mat && angle <=  -90 + mat) {
      code = g.S;
    } else if (angle >=   -45 - sat && angle <=  -45 + sat) {
      code = g.SE;
    } else if (angle >=     0 - mat && angle <=    0 + mat) {
      code = g.E;
    } else if (angle >=    45 - sat && angle <=   45 + sat) {
      code = g.NE;
    }
    return code;
  };
      
  this.recognize = function(strokes) {
    var stroke = [];
    // mirror y axis so that coordinate system us standard
    for (var i = 0; i < strokes[0].length; ++i) { 
      stroke.push([strokes[0][i][0], -strokes[0][i][1]]); 
    }

    var lied = MathLib.fastLieDown(stroke);

    var bb = MathLib.boundingBox(lied.stroke);
    var aspectRatio = bb.width/bb.height;

    if (strokes[0].length <= dotThr || (bb.width < dotThr && bb.height < dotThr)) {
      return { name: 'dot', score: 1 };
    }


    var pixBwd = MathLib.computePixelsBackwards(lied.stroke);

    var name;
    if (pixBwd.x <= xBackThr && pixBwd.y <= yBackThr && aspectRatio >= aspectThr) { // This is a straight line 
      name = getGestureByAngle(lied.fit.angle);
      return { name: name, score: (1 - 1/aspectRatio + Math.exp(-pixBwd.x) + Math.exp(-pixBwd.y))/3 };
    }
  };
  
};

var MathLib = 
{
  angle: function angle(stroke) {
    var ini = stroke[0], end = stroke[stroke.length - 1];
    var a = Math.atan2(end[1] - ini[1], end[0] - ini[0]);
    return a * -180/Math.PI; // Positive degrees
  },
    

  centroid: function(stroke) {
    if (stroke.length === 0)      return undefined;
    else if (stroke.length === 1) return stroke[0];
    else if (stroke.length === 2) return stroke[1];
    else {
      var x = 0.0, y = 0.0;
      for (var i = 0; i < stroke.length; i++) {
        x += stroke[i][0];
        y += stroke[i][1];
      }
      x /= stroke.length;
      y /= stroke.length;
      return [x, y];
    }
  },
  
  
  indicativeAngle: function(stroke) {
    if (stroke.length <= 0) return 0;
    var c = this.centroid(stroke);
    return Math.atan2(c[1] - stroke[0][1], c[0] - stroke[0][0]);
  },


  fastLieDown: function(stroke) {
    var newstroke = this.translateToOrigin(stroke, stroke[0]);
    var angle = this.indicativeAngle(newstroke);
    newstroke = this.rotate(newstroke, -angle); 

    var fit = { slope: Math.tan(angle), yintercept: 0, angle: angle, xintercept: 0 };
    return {stroke: newstroke, fit: fit};
  },

  verticalFit: function(stroke) {
    // Split strokes array
    var i, c, n = stroke.length, xv = [], yv = [];
    for (i = 0; i < n; ++i) {
      xv.push(stroke[i][0]);
      yv.push(stroke[i][1]);
    }
    n = xv.length;

    // Compute means
    var xavg = this.avg(xv), yavg = this.avg(yv), ssxx = 0, ssyy = 0, ssxy = 0;
    for (i = 0; i < n; ++i) {
      ssxx += xv[i] * xv[i];
      ssyy += yv[i] * yv[i];
      ssxy += xv[i] * yv[i];
    }
    ssxx -= n * (xavg * xavg);
    ssyy -= n * (yavg * yavg);
    ssxy -= n * (xavg * yavg);
    // Correlation coefficient
    var r = (ssxy * ssxy) / (ssxx * ssyy);
    // Variance estimator
    var s = Math.sqrt( (ssyy - (ssxy * ssxy)/ssxx) / (n-2) );
    if (ssxx === 0 || ssyy === 0 || r >= 1) {
      r = 1;
      s = 0;
    }

    return { centroidX: xavg, centroidY: yavg, pearson: r, sd: s }; 
  },
 

  lieDown: function(stroke) {
    var fit = this.fit(stroke);
    // rotate line to lie down on the x-axis over x-intercept
    var newstroke;
    if (fit.slope != 0) {
      newstroke = this.rotate(newstroke, -fit.angle, [fit.xintercept, 0]);
    }
    else {
      newstroke = this.rotate(newstroke, -fit.angle);
    }
    return {stroke: newstroke, fit: fit};
  },


  // http://mathworld.wolfram.com/LeastSquaresFittingPerpendicularOffsets.html
  fit: function(stroke) {
    var n = stroke.length;

    // Compute sums and sums of squares 
    var xsum = 0, ysum = 0, ssxx = 0, ssyy = 0, ssxy = 0;
    // accumulated delta x and y
    for (var i = 0; i < n; ++i) {
      xsum += stroke[i][0];
      ysum += stroke[i][1];
      ssxx += stroke[i][0] * stroke[i][0];
      ssyy += stroke[i][1] * stroke[i][1];
      ssxy += stroke[i][0] * stroke[i][1];
    }
    //console.log(xsum, ysum, ssxx, ssyy, ssxy);

    var dx = 0, dy = 0;
    for (var i = 1; i < n; ++i) {
      dx += stroke[i][0] - stroke[i-1][0];
      dy += stroke[i][1] - stroke[i-1][1];
    }
    //console.log('dx:', dx, 'dy:', dy);

    var Bn = (ssyy -ysum*ysum/n) - (ssxx - xsum*xsum/n);
    var Bd = xsum*ysum/n - ssxy;
    var  B = 0.5*Bn/Bd;

    // y = a + b*x
    var b  = -B + Math.sqrt(B*B + 1);
    var bm = -B - Math.sqrt(B*B + 1);
    var a  = (ysum - b*xsum)/n;
    var am = (ysum - bm*xsum)/n;
    var xintercept = -a/b;
    var xinterceptm = -am/bm;

    // if B is infinity then singularity: it is a vertical/hoizontal line
    if (Math.abs(B) === Infinity) {
      // horizontal line
      if (Bn < 0) {
        b = 0;
        a = ysum/n;
        xintercept = Infinity;
      }
      // vertical line
      else {
        b = Infinity;
        a = -Infinity;
        //console.log(xsum, n);
        xintercept = xsum/n;
      }
    }


    var R = 0, Rm = 0; 
    for (var i = 0; i < n; ++i) {
      R  += Math.abs(stroke[i][1] - (a + b*stroke[i][0]));
      Rm += Math.abs(stroke[i][1] - (am + bm*stroke[i][0]));
    }
    R /= (Math.sqrt(1 + b*b));
    Rm /= (Math.sqrt(1 + bm*bm));

    var angle  = Math.atan(b);
    var anglem = Math.atan(bm);


    //console.log('Bn:', Bn, 'Bd:', Bd, 'B:', B, 'b:', b, 'a:', a, 'xi:', xintercept, 'angle:', angle*180/Math.PI, 'R:', R, 'b-:', bm, 'a-:', am, 'xi-:', xinterceptm,  'angle-:', anglem*180/Math.PI, 'R-:', Rm);
    //console.log(stroke);
    //console.log('R:',R, 'b:', b, 'a:', a, 'angle:', angle*180/Math.PI);
    //console.log('R-:', Rm, 'b-:', bm, 'a-:', am, 'xi-:', xinterceptm,  'angle-:', anglem*180/Math.PI);
    //console.log('dx:', dx, 'dy:', dy);

    if (Rm < R) {
      b = bm; a = am; angle = anglem; R = Rm; xintercept = xinterceptm; 
    }

    // the stroke goes in the inverse direction
    var dir = Math.atan2(stroke[stroke.length-1][1] - stroke[0][1], stroke[stroke.length-1][0] - stroke[0][0]);
    //console.log(b, a, xintercept, angle*180/Math.PI, dir*180/Math.PI, Math.abs(dir - angle)*180/Math.PI);
    if (Math.abs(dir - angle) > Math.PI/2) angle += Math.PI;
    //if (dx === 0) {
    //  if      (angle > 0 && dy < 0) angle -= Math.PI;
    //  else if (angle < 0 && dy > 0) angle += Math.PI;
    //}
    if (angle > Math.PI) angle -= 2*Math.PI;
    return { slope: b, yintercept: a, angle: angle, xintercept: xintercept };
  },

  perpendicularLSE: function(stroke, fit) {
    var R = 0, LSE = 0, n = stroke.length;
    for (var i = 0; i < n; ++i) {
      var l = Math.abs(stroke[i][1] - (a + b*stroke[i][0]));
      R += l; 
      LSE += l*l; 
    }
    R /= (Math.sqrt(1 + b*b));
    return { lse: LSE, residuals: R };
  },

 // translates points 
  translateToOrigin: function(stroke, point)
  {
  	var newstroke = [];
  	for (var i = 0; i < stroke.length; ++i) {
  	  var qx = stroke[i][0] - point[0];
  	  var qy = stroke[i][1] - point[1];
  	  newstroke.push([qx, qy]);
  	}
  	return newstroke;
  },

  rotate: function (stroke, radians, center) { // rotates stroke around centroid
  	var c = (center)?center:[0,0];
  	var cos = Math.cos(radians);
  	var sin = Math.sin(radians);
  	
  	var newstroke = [];
  	for (var i = 0; i < stroke.length; i++)
  	{
  		var qx = (stroke[i][0] - c[0]) * cos - (stroke[i][1] - c[1]) * sin + c[0];
  		var qy = (stroke[i][0] - c[0]) * sin + (stroke[i][1] - c[1]) * cos + c[1];
  		newstroke.push([qx, qy]);
  	}
    //console.log(radians, c, cos, sin, newstroke);
  	return newstroke;
  },

  boundingBox: function(stroke) {
  	var minX = +Infinity, maxX = -Infinity, minY = +Infinity, maxY = -Infinity;
  	for (var i = 0; i < stroke.length; i++) {
  	  minX = Math.min(minX, stroke[i][0]);
  	  minY = Math.min(minY, stroke[i][1]);
  	  maxX = Math.max(maxX, stroke[i][0]);
  	  maxY = Math.max(maxY, stroke[i][1]);
  	}
  	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  },

  computePixelsBackwards: function(stroke) {
    var n = stroke.length;
    var xsum = 0, ysum = 0;
    
    for(var i=1; i < n; i++) {
      var dx = stroke[i][0] - stroke[i-1][0];
      var dy = stroke[i][1] - stroke[i-1][1];
      if (dx < 0) xsum += dx;
      if (dy < 0) ysum += dy;
    }
    return {x: -xsum, y: -ysum};
  },

  sum: function(arr, startIndex, endIndex) {
     var ini = startIndex || 0;
     var end = endIndex   || arr.length;
     var sum = 0;
     for (var i = ini; i < end; ++i) {
        sum += arr[i];
     }
     return sum;
  },
  
  avg: function(arr) {
     var s = this.sum(arr);
     return s / arr.length;
  },
  
  quartile: function(arr, q) {
    var pos = q * (arr.length + 1);
    return (arr[Math.floor(pos)-1] + arr[Math.ceil(pos)-1]) / 2;
  },

  median: function(arr) {
    arr.sort(function(a,b){
      return a - b;
    });
    var n = arr.length, half = Math.floor(n/2);
    if (n % 2) {
      med = arr[half];
    } else {
      med = (arr[half-1] + arr[half]) / 2;
    }
    return med;
  },  
  
  sd: function(arr, mean) {
    var variance = 0, elem;
    for (var i = 0; i < arr.length; ++i) {
      elem = arr[i];
      variance += (elem - mean) * (elem - mean);
    }
    return Math.sqrt(variance/arr.length);
  },
  
};


// Other function not used right now
/*
function translateToOrigin(stroke) // translates points' centroid
{
	//var c = centroid(stroke);
	var c = stroke[0];
	var newstroke = [];
	for (var i = 0; i < stroke.length; ++i) {
	  var qx = stroke[i][0] - c[0];
	  var qy = stroke[i][1] - c[1];
	  newstroke.push([qx, qy]);
	}
	return newstroke;
}

function scaleToModuleOne(stroke) // uniform scale for lines; assumes 2D gestures
{
	var b = boundingBox(stroke);
  var len = Math.sqrt((b.width * b.width) + (b.height * b.height));
  var xnorm = 1/len;
  var ynorm = 1/len;
  //console.log('BoundingBox', xnorm, ynorm, B);
	var newstroke = [];
	for (var i = 0; i < stroke.length; i++) {
	  var qx = stroke[i][0] * xnorm;
	  var qy = stroke[i][1] * ynorm;
	  newstroke.push([qx, qy]);
	}
	return newstroke;
}

function centroid(stroke) {
  if (stroke.length === 0)      return undefined;
  else if (stroke.length === 1) return stroke[0];
  else if (stroke.length === 2) return stroke[1];
  else {
	  var x = 0.0, y = 0.0;
	  for (var i = 0; i < stroke.length; i++) {
	  	x += stroke[i][0];
	  	y += stroke[i][1];
	  }
	  x /= stroke.length;
	  y /= stroke.length;
	  return [x, y];
  }
}	


function indicativeAngle(stroke)
{
  if (stroke.length <= 0) return 0;
	var c = centroid(stroke);
	return Math.atan2(stroke[0][1] - c[1], stroke[0][0] - c[0]);
}

function fourier(stroke, p) {
  var len = stroke.length;
  var output = [];
  var sum = 0;
  
  for(var k=0; k < len; k++) {
    var real = 0;
    var imag = 0;
    for(var n=0; n < len; n++) {
      real += stroke[n][p]*Math.cos(-2*Math.PI*k*n/len);
      imag += stroke[n][p]*Math.sin(-2*Math.PI*k*n/len);
    }
    sum += real;
    output.push([real, imag])
  }
  return sum;
}

function curvature(stroke) {
  var len = stroke.length;
  var sum = 0;
  
  var odx = stroke[1][0] - stroke[0][0], 
      ody = stroke[1][1] - stroke[0][1];
  for(var k=2; k < len; k++) {
    var dx = stroke[k][0] - stroke[k-1][0];
    var dy = stroke[k][1] - stroke[k-1][1];
    var a = (dx * ody - odx * dy), b = (dx * odx + dy * ody)
    sum += Math.abs(Math.atan2(a, b));
    odx = dx; ody = dy;
  }
  return Math.abs(sum);
}

*/
