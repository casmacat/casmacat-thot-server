$(function(){

  /*******************************************************************************/
  /*           create server connection and handle server events                 */
  /*******************************************************************************/

  // connect to a server. casmacatHtr will receive async server responses
  var casmacatHtr = new CasmacatClient('http://' + window.casmacatHtrServer + '/casmacat');

  // handle disconections and debug information
  casmacatHtr.on('disconnect', function(){ this.socket.reconnect(); });
  casmacatHtr.on('receive_log', function(msg) { console.log('server says:', msg); });
  
  // helper function to limit the number of server requests
  // at least throttle_ms have to pass for events to trigger 
  var timerMs = 400;
  var decoderTimer = 0;

  // gesture recognizer
  var gestureRecognizer = new MinGestures();
  
  // instantiate a drawable canvas 
  var cnv = $('#drawing-canvas').sketchable({
      interactive: true,
      events: {
        mouseDown: function(e) {
          clearTimeout (decoderTimer);
        },
        mouseUp: function(e) {
          var strokes = cnv.sketchable('strokes');
          var stroke = strokes[strokes.length-1];
          var gesture;
          if (strokes.length === 1) {
            gesture = gestureRecognizer.recognize(strokes);
            if (!gesture) {
              var data = {
                source: '',
                target: '',
                caret_pos: 0,
              }
              casmacatHtr.startHtrSession(data);
              
              var data = { x: e.clientX, y: e.clientY, target: null};
              cnv.data('htr', data);
              $('#htr-suggestions').text('Performing HTR recognition...').css('color', 'green');
            }
            else {
              cnv.sketchable('clear');
              $('#htr-suggestions').text('gesture: ' + gesture.name).css('color', 'green');
            }
          }

          if (!gesture) {
            casmacatHtr.addStroke({points: stroke, is_pen_down: true});
          }
        },
        clear: function(elem, data) {
          cnv.removeData('htr');
          $('#htr-suggestions').empty();
          //cnv.get(0).width = cnv.get(0).width; // This overwrites jSketch's clear() method
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
    if (obj.data) {
      update_htr_suggestions(obj.data);
    }
  });

  // on click send strokes to the htr server
  $('#btn-decode').click(function(e) {
    casmacatHtr.endHtrSession();
    console.log('end session');
  });

  // clear canvas
  $('#btn-clear').click(function(e){
    cnv.sketchable('clear');
    console.log('clear canvas');
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
  }

  
});
