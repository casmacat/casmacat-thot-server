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

  // instantiate a drawable canvas 
  var cnv = $('#drawing-canvas').sketchable({
      interactive: true,
      events: {
        mouseDown: function(e) {
          clearTimeout (decoderTimer);
          var strokes = cnv.sketchable('strokes');
          if (strokes.length === 0) {
            var source = '';
            var target = ''; 
            var caret_pos = 0;
            casmacatHtr.startHtrSession(source, target, caret_pos);
            
            var data = { x: e.clientX, y: e.clientY, target: null};
            cnv.data('htr', data);
          }
        },
        mouseUp: function(e) {
          var strokes = cnv.sketchable('strokes');
          var stroke = strokes[strokes.length-1];
          casmacatHtr.addStroke(stroke, true);      
        },
        clear: function(elem, data) {
          cnv.removeData('htr');
          $('#htr-suggestions').empty();
          //cnv.get(0).width = cnv.get(0).width; // This overwrites jSketch's clear() method
        }
     },
  });
  
  
  
  // handle HTR responses
  casmacatHtr.on('htrupdate', function(result, result_seg) {
    console.log('updated', result);
    update_htr_suggestions(result, result_seg, 'red');
  });

  // handle post-editing (target has changed but not source)
  casmacatHtr.on('htrchange', function(result, result_seg) {
    console.log('changed', result);
    update_htr_suggestions(result, result_seg);
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


  function update_htr_suggestions(result, result_seg, color) {
    if (result === "") return;
    var is_final = false;
    if (!color) {
      color = "black";
      is_final = true;
    }
    console.log(result, result_seg);

    $('#htr-suggestions').text(result).css('color', color);
  }

  
});
