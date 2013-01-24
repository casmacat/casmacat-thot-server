$(function(){

require(["jsketch", "jquery.sketchable"], function() {

  /*******************************************************************************/
  /*           create server connection and handle server events                 */
  /*******************************************************************************/

  // connect to a server. casmacatHtr will receive async server responses
  var casmacatHtr = new HtrClient();
  casmacatHtr.connect('http://' + window.casmacat.htrServer + '/casmacat');
  var $cnv = $('#drawing-canvas');

  casmacatHtr.configure({
      canvasSize: { width: $cnv.width(), height: $cnv.height() },
      device: window.navigator.userAgent
  });

  // Socket.IO callbacks -------------------------------------------------------
  // See https://github.com/LearnBoost/socket.io/wiki/Exposed-events
  casmacatHtr.on('disconnect', function(){ 
    casmacatHtr.checkConnection(); 
  });
  casmacatHtr.on('reconnect', function(){ 
    casmacatHtr.configure({
        canvasSize: { width: $cnv.width(), height: $cnv.height() },
        device: window.navigator.userAgent
    });
  });
  //casmacatHtr.on('receiveLog', function(msg) { console.log('server says:', msg); });


  var gestureRecognizer = new MinGestures();
    
  $('#btn-decode, #btn-clear').attr('disabled', 'true');

  function getRelativeXY(point) {
    var leftBorder  = parseInt(cnv.css('borderLeftWidth')) || 0;
    var topBorder   = parseInt(cnv.css('borderTopWidth'))  || 0;
    var leftPadding = parseInt(cnv.css('paddingLeft'))    || 0;
    var topPadding  = parseInt(cnv.css('paddingTop'))     || 0;
    var offset = cnv.offset();
    var mouseX = point[0] - offset.left - leftBorder - leftPadding;
    var mouseY = point[1] - offset.top - topBorder - topPadding;
    //console.log("Relative:", point, [mouseX, mouseY]);
    return [mouseX, mouseY];
  }

  function getAbsoluteXY(point) {
    var leftBorder  = parseInt(cnv.css('borderLeftWidth')) || 0;
    var topBorder   = parseInt(cnv.css('borderTopWidth'))  || 0;
    var leftPadding = parseInt(cnv.css('paddingLeft'))    || 0;
    var topPadding  = parseInt(cnv.css('paddingTop'))     || 0;
    var offset = cnv.offset();
    var mouseX = point[0] + offset.left + leftBorder + leftPadding;
    var mouseY = point[1] + offset.top + topBorder + topPadding;
    //console.log("Absolute:", point, [mouseX, mouseY]);
    return [mouseX, mouseY];
  }


  // helper function to limit the number of server requests
  // at least throttle_ms have to pass for events to trigger 
  var decoderTimer = 0, timerMs = 400;
  var insert_after_token, insertion_token, insertion_token_space;

  function getTokenDistanceAtPointer(e) {
    var $target = $('#target');
    var tokenDistance = {
      token: null,
      distance: {d: 0, dx: 0, dy: 0}
    }
    if (insert_after_token) {
      var res = $target.editable('appendWordAfter', '', insert_after_token, ($target.text() !== '')?' ':'');
      tokenDistance.token = insertion_token = res.$token;
      insertion_token_space = res.$spaces;
    }
    else {
      var $target = $('#target');
      var tokens = $target.editable('getTokensAtXY', [e.clientX, e.clientY]);
      if (tokens.length > 0) {
        // find the closest tokens to the right
        tokens = tokens.filter(function(a){ return a.distance.dx <= 0});
        // if any
        if (tokens.length > 0) {
          tokenDistance = tokens[0];
        }            
      
        // no tokens were found to the right so append at the end
        if (!tokenDistance.token) {
          $lastToken  = $('span.editable-token:last-child', $target);
          var res = $target.editable('appendWordAfter', '', $lastToken, ' ');
          tokenDistance.token = insertion_token = res.$token;
          insertion_token_space = res.$spaces;
        }
      }
      // no tokens were found so append at the beginnig 
      else {
        var res = $target.editable('appendWordAfter', '', null, '');
        tokenDistance.token = insertion_token = res.$token;
        insertion_token_space = res.$spaces;
      }
    }
    return tokenDistance;
  }


  function doRejectGesture($token) {
    var $source = $('#source');
    var $target = $('#target');
    casmacatItp.rejectSuffix({
      source: $source.text(),
      target: $target.text(),
      caretPos: $target.editable('getTokenPos', $token[0]),
      numResults: 1,
    });
    console.log('reject', $token);
  }

  function doDeleteGesture($token) {
    var $source = $('#source');
    var $target = $('#target');
    var t = $token, n;
    do {
      n = $(t[0].nextSibling);
      t.remove(); 
      t = n;
    } while (t.length && !t.is('.editable-token'));
    
    casmacatItp.setPrefix({
      source: $source.text(),
      target:   $target.text(),
      caretPos: $target.editable('getTokenPos', t.next()),
      numResults: 1,    
    });
    console.log('delete', $token);
  }

  function doInsertGesture($token) {
    //var $source = $('#source');
    //var $target = $('#target');
    //var query = {
    //  source: $source.text(),
    //  caretPos: 0,
    //  numResults: 2,
    //}

    insert_after_token = $token; 
    console.log('insertion token', insert_after_token);
    // decoderTimer = setTimeout(function () {
    //   $('#btn-decode').trigger('click');
    // }, timerMs);
  }

  function doValidateGesture($token) {
    //var $source = $('#source');
    //var $target = $('#target');
    //var query = {
    //  source: $source.text(),
    //  caretPos: 0,
    //  num_results: 1,
    //}

    console.log('validate');
  }

  function processGesture(gesture, stroke) {
    var $source = $('#source');
    var $target = $('#target');
    var centroid = MathLib.centroid(stroke);
    centroid = getAbsoluteXY(centroid);

    switch (gesture.name) {
      case 'dot': // reject 
        var tokenDistances = $target.editable('getTokensAtXY', centroid, 0);
        var tokenDistancesInLine = tokenDistances.filter(function(a){ return a.distance.dy === 0});;
        if (tokenDistancesInLine.length > 0 && tokenDistancesInLine[0].distance.d < 3) {
          var token = tokenDistancesInLine[0];
          doRejectGesture($(token.token));
        }
        break;
      case 'se': // delete
        var tokenDistances = $target.editable('getTokensAtXY', centroid, 0);
        var tokenDistancesInLine = tokenDistances.filter(function(a){ return a.distance.dy === 0});;
        if (tokenDistancesInLine.length > 0 && tokenDistancesInLine[0].distance.d < 3) {
          var token = tokenDistancesInLine[0];
          doDeleteGesture($(token.token));
        }
        break;
      case 's': // insert
        var tokenDistances = $target.editable('getTokensAtXY', centroid, -3);
        var tokenDistancesInLine = tokenDistances.filter(function(a){ return a.distance.dy === 0});;
        if (tokenDistancesInLine.length > 0 && tokenDistancesInLine[0].distance.d !== 0) {
          var leftTokens = tokenDistancesInLine.filter(function(a){ return a.distance.dx > 0});
          var $token = (leftTokens.length > 0)?$(leftTokens[0].token):null;
          console.log('left tokens', leftTokens);
          doInsertGesture($token);
        }
        break;
      case 'ne': // validate 
        var tokenDistances = $target.editable('getTokensAtXY', centroid, 0);
        if (tokenDistances[0].distance.dx < 0 || tokenDistances[0].distance.dy !== 0) {
          doValidateGesture();
        }
        break;
      default:
        console.log("Gesture not implemented or out of context", gesture, centroid, tokenDistances);
    }
    
      
    cnv.sketchable('clear');
  }

  var lastElementOnMouse;

  // instantiate a drawable canvas 
  var cnv = $('#drawing-canvas').sketchable({
      interactive: true,
      events: {
        mouseDown: function(e) {
          clearTimeout(decoderTimer); // this must preceed in order to cancel the timer
          e.preventDefault(); // prevent displaying caret
        },
        mouseUp: function(e) {
          var gesture, strokes = cnv.sketchable('strokes');

          if (!strokes || !strokes[0]) return false;

          // one stroke means either gesture or first HTR stroke
          if (strokes.length === 1) {
            gesture = gestureRecognizer.recognize(strokes);
            // first HTR stroke
            if (!gesture || insert_after_token) {
              var centroid = getAbsoluteXY(MathLib.centroid(strokes[0].slice(0, 20)));
              var tokenDistance = getTokenDistanceAtPointer({clientX: centroid[0], clientY: centroid[1]});
              casmacatHtr.startSession({
                  source: $('#source').editable('getText'),
                  target: $('#target').editable('getText'),
                  caretPos: 0,
              });
              
              cnv.data('htr', { 
                x: e.clientX, 
                y: e.clientY, 
                target: tokenDistance 
              });
          
              $('#btn-decode, #btn-clear').removeAttr('disabled');
            }
            else {
              processGesture(gesture, strokes[0]);
            }
          }

          //var s = strokes[strokes.length-1];
          //$('h1').text(1000*s.length/(s[s.length-1][2] - s[0][2]) + " " + s.length);

          // if it is not a gesture, then we are doing HTR. Append last stroke
          if (!gesture) {
            casmacatHtr.addStroke({points: strokes[strokes.length-1], is_pen_down: true});      
            decoderTimer = setTimeout(function () {
              $('#btn-decode').trigger('click');
            }, timerMs);
          }
        },

        clear: function(elem, data) {
          // cnv.removeData('htr');
          clearTimeout(decoderTimer);
          $('#htr-suggestions').empty();
          cnv.get(0).width = cnv.get(0).width;
        }
     },
  }).bind('mousemove', function (e) { 
    if (!cnv.data('sketchable').canvas.isDrawing) {
      var tokens = $('#target').editable('getTokensAtXY', [e.clientX, e.clientY]);
      var elem; 
      if (tokens.length > 0 && tokens[0].distance.d == 0) {
        elem = $(tokens[0].token);
      }

      //console.log(lastElementOnMouse, elem);
      if (elem != lastElementOnMouse) {
        if (lastElementOnMouse) lastElementOnMouse.mouseleave();
        if (elem) elem.mouseenter();
      }
      if (elem) {
        elem.mousemove()
      }
      lastElementOnMouse = elem;
    }

      //$('#info').text("m: " + getRelativeXY([e.clientX, e.clientY])); 
  });
  
  
  
  // handle HTR responses
  casmacatHtr.on('addStrokeResult', function(data, errors) {
    console.log('updated', data);
    if (data) {
      update_htr_suggestions(data, 'red');
    }
  });

  // handle post-editing (target has changed but not source)
  casmacatHtr.on('endSessionResult', function(data, errors) {
    console.log('recognized', data);
    update_htr_suggestions(data);
    $('#btn-clear').trigger('click');

    if (insertion_token && insertion_token.text().length === 0) {
      insertion_token.remove();
      if (insertion_token_space) {
        insertion_token_space.remove();
      }
    }
    insert_after_token = undefined;
    insertion_token = undefined;
    insertion_token_space = undefined;

    casmacatItp.getTokens({
      source: $('#source').editable('getText'),
      target: $('#target').editable('getText'),
    });
  });

  // on click send strokes to the htr server
  $('#btn-decode').click(function(e) {
    casmacatHtr.endSession();
    $(this).attr('disabled', 'true');
  });

  // clear canvas
  $('#btn-clear').click(function(e){
    cnv.sketchable('clear');
    $('#decode').attr('disabled', 'true');
    $(this).attr('disabled', 'true');
  });

  /*******************************************************************************/
  /*           update the HTML display and attach events                         */
  /*******************************************************************************/


  function update_htr_suggestions(data, color) {
    if (!data || !data.nbest) return;
    var best= data.nbest[0];
    if (!best.text || best.text === "") return;
    var is_final = false;
    if (!color) {
      color = "black";
      is_final = true;
    }
    console.log(best.text, best.textSegmentation);

    $('#htr-suggestions').text(best.text).css('color', color);
    var htrData = cnv.data('htr');
    
    if (htrData.target) {
      $('#target').editable('replaceText', best.text, best.textSegmentation, htrData.target.token, is_final);
    }
  }


}); // end require
  
});
