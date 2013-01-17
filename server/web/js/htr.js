$(function(){
  require(["jsketch", "jquery.sketchable"], function() {

  /*******************************************************************************/
  /*           create server connection and handle server events                 */
  /*******************************************************************************/

  // connect to a server. casmacatHtr will receive async server responses
  var casmacatHtr = new CasmacatClient('http://' + window.casmacatHtrServer + '/casmacat');
  var gestureRecognizer = new MinGestures();

  // handle disconections and debug information
  casmacatHtr.on('disconnect', function(){ this.socket.reconnect(); });
  casmacatHtr.on('receive_log', function(msg) { console.log('server says:', msg); });
  
  $('#btn-decode, #btn-clear').attr('disabled', 'true');

  // helper function to limit the number of server requests
  // at least throttle_ms have to pass for events to trigger 
  var timerMs = 400;
  var decoderTimer = 0;
  var insert_after_token = undefined;
  var insertion_token = undefined;
  var insertion_token_space = undefined;


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
    var query = {
      action: 'rejectSuffix',
      id_segment: 607906,
      text: $source.text(),
      target: $target.text(),
      caret_pos: $target.editable('getTokenPos', $token[0]),
      id_job: 1135,
      num_results: 2,
      id_translator: "me!"
    }
    casmacat.rejectSuffix(query);
    console.log('reject', $token);
  }

  function doDeleteGesture($token) {
    var $source = $('#source');
    var $target = $('#target');
    var query = {
      action: 'getSuggestions',
      id_segment: 607906,
      text: $source.text(),
      id_job: 1135,
      num_results: 2,
      id_translator: "me!"
    }

    var t = $token, n;
    do {
      n = $(t[0].nextSibling);
      t.remove(); 
      t = n;
    } while (!t.is('.editable-token'));
    
    query.target = $target.text(),
    query.caret_pos = $target.editable('getTokenPos', t.next());
    casmacat.setPrefix(query);
    console.log('delete', $token);
  }

  function doInsertGesture($token) {
    //var $source = $('#source');
    //var $target = $('#target');
    //var query = {
    //  action: 'getSuggestions',
    //  id_segment: 607906,
    //  text: $source.text(),
    //  caret_pos: 0,
    //  id_job: 1135,
    //  num_results: 2,
    //  id_translator: "me!"
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
    //  action: 'update',
    //  id_segment: 607906,
    //  text: $source.text(),
    //  caret_pos: 0,
    //  id_job: 1135,
    //  num_results: 2,
    //  id_translator: "me!"
    //}

    console.log('validate');
  }

  function processGesture(gesture, stroke) {
    var $source = $('#source');
    var $target = $('#target');
    var centroid = MathLib.centroid(stroke);
    var offset = cnv.offset();
    centroid[0] += offset.left; 
    centroid[1] += offset.top;  

    // obtain closest tokens to centroid with up to 3 pixels inside token boxes 
    var tokenDistances = $target.editable('getTokensAtXY', centroid, -3);
    //console.log(stroke[0].slice(),  centroid.slice(), stroke[stroke.length-1].slice());

    //var _tl = $(tokenDistances.filter(function(a){ return a.distance.dx >= 0})[0].token);
    //var _tr = $(tokenDistances.filter(function(a){ return a.distance.dx <  0})[0].token);
    //console.log('gesture recognized', gesture, getRect(_tl), centroid, getRect(_tr));
    //console.log('gesture recognized', gesture, centroid, getRect($(tokenDistances[0].token)));

    // if there are no tokens, then ignore the gesture
    if (tokenDistances.length === 0) {
      console.log('There are no tokens for gesture', gesture, 'context');
    }
    // gestures that are issued over a token
    else if (tokenDistances[0].distance.d === 0) {
      var token = tokenDistances[0];
      switch (gesture.name) {
        case 'dot': // reject 
          doRejectGesture($(token.token));
          break;
        case 'se': // delete
          doDeleteGesture($(token.token));
          break;
        default:
          console.log("Gesture not implemented or out of context", gesture, centroid, tokenDistances);
      }
    }
    // gestures that are issued between tokens
    else if (tokenDistances[0].distance.dy === 0) {
      switch (gesture.name) {
        case 's': // insert
          var leftTokens = tokenDistances.filter(function(a){ return a.distance.dx >= 0});
          var $token = (leftTokens.length > 0)?$(leftTokens[0].token):null;
          doInsertGesture($token);
          break;
        default:
          console.log("Gesture not implemented or out of context", gesture, centroid, tokenDistances);
      }
    }
    // gestures that are issued appart from text 
    else if (tokenDistances[0].distance.dx < 0 || tokenDistances[0].distance.dy !== 0) {
      switch (gesture.name) {
        case 'ne': // validate 
          doValidateGesture();
          break;
        default:
          console.log("Gesture not implemented or out of context", gesture, centroid, tokenDistances);
      }
    }
    else  console.log("Gesture not implemented or out of context", gesture, centroid, tokenDistances);
      
    cnv.sketchable('clear');
  }


  // instantiate a drawable canvas 
  var cnv = $('#drawing-canvas').sketchable({
      interactive: true,
      events: {
        mouseDown: function(e) {
          e.preventDefault(); // prevent displaying caret
          clearTimeout(decoderTimer);
        },
        mouseUp: function(e) {
          var gesture, strokes = cnv.sketchable('strokes');

          // one stroke means either gesture or first HTR stroke
          if (strokes.length === 1) {
            gesture = gestureRecognizer.recognize(strokes);
            // first HTR stroke
            if (!gesture || insert_after_token) {
              var tokenDistance = getTokenDistanceAtPointer(e);
              casmacatHtr.startHtrSession({
                  source: $('#source').editable('getText'),
                  target: $('#target').editable('getText'),
                  caret_pos: 0,
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
  });
  
  
  
  // handle HTR responses
  casmacatHtr.on('htrupdate', function(obj) {
    console.log('updated', obj);
    if (obj.data) {
      update_htr_suggestions(obj.data, 'red');
    }
  });

  // handle post-editing (target has changed but not source)
  casmacatHtr.on('htrchange', function(obj) {
    console.log('changed', obj);
    update_htr_suggestions(obj.data);
    $('#btn-clear').trigger('click');

    if (insertion_token && insertion_token.text().length === 0) {
      insertion_token.remove();
      insertion_token_space.remove();
    }
    insert_after_token = undefined;
    insertion_token = undefined;
    insertion_token_space = undefined;


    var query = {
      action: "getTokens",
      id_segment: 607906,
      text: $('#source').editable('getText'),
      // since we are listening on keypress, target must include last typed char
      target: $('#target').editable('getText'),
      id_job: 1135,
      num_results: 2,
      id_translator: "me!"
    }
    casmacat.getTokens(query);
  });

  // on click send strokes to the htr server
  $('#btn-decode').click(function(e) {
    casmacatHtr.endHtrSession();
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
    if (!data.text || data.text === "") return;
    var is_final = false;
    if (!color) {
      color = "black";
      is_final = true;
    }
    console.log(data.text, data.text_seg);

    $('#htr-suggestions').text(data.text).css('color', color);
    var htrData = cnv.data('htr');
    
    if (htrData.target) {
      $('#target').editable('replaceText', data.text, data.text_seg, htrData.target.token, is_final);
    }
  }

  
}) });
