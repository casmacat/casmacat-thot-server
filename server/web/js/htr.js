$(function(){

  /*******************************************************************************/
  /*           create server connection and handle server events                 */
  /*******************************************************************************/

  // connect to a server. casmacatHtr will receive async server responses
  var casmacatHtr = new CasmacatClient('http://' + window.casmacatHtrServer + '/casmacat');

  // handle disconections and debug information
  casmacatHtr.on('disconnect', function(){ this.socket.reconnect(); });
  casmacatHtr.on('receive_log', function(msg) { console.log('server says:', msg); });
  
  $('#btn-decode, #btn-clear').attr('disabled', 'true');

  // helper function to limit the number of server requests
  // at least throttle_ms have to pass for events to trigger 
  var timerMs = 400;
  var decoderTimer = 0;

  // instantiate a drawable canvas 
  var cnv = $('#drawing-canvas').sketchable({
      interactive: true,
      events: {
        mouseDown: function(e) {
          e.preventDefault(); // prevent displaying caret
          clearTimeout (decoderTimer);
          var strokes = cnv.sketchable('strokes');
          if (strokes.length === 0) {
            var source = $('#source').editable('getText');
            var target = $('#target').editable('getText');
            var caret_pos = 0;
            casmacatHtr.startHtrSession(source, target, caret_pos);
            
            var data = { x: e.clientX, y: e.clientY, target: null};
            var tokens = $('#target').editable('getTokensAtXY', e.clientX, e.clientY);
            if (tokens.length > 0) {
              tokens = tokens.filter(function(a){ return a.distance.dx <= 0});
              if (tokens.length > 0) {
                tokens.sort(function(a,b){ return Math.abs(a.distance.dx) - Math.abs(b.distance.dx); });
                data.target = tokens[0];
              }            
            }
            if (!data.target) {
              data.target = {
                token: $('#target').editable('appendWord', '', (target)?' ':''),
                position: {d: 0, dx: 0, dy: 0}
              }
            }
            cnv.data('htr', data);

            $('#btn-decode, #btn-clear').removeAttr('disabled');
          }
        },
        mouseUp: function(e) {
          var strokes = cnv.sketchable('strokes');
          var stroke = strokes[strokes.length-1];
          casmacatHtr.addStroke(stroke, true);      
          decoderTimer = setTimeout(function () {
            $('#btn-decode').trigger('click');
          }, timerMs);

        },
        clear: function(elem, data) {
          cnv.removeData('htr');
          $('#htr-suggestions').empty();
          cnv.get(0).width = cnv.get(0).width;
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
    update_htr_suggestions(result, result_seg);
    $('#btn-clear').trigger('click');
    casmacat.getTokens($('#source').editable('getText'), $('#target').editable('getText'));
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


  function update_htr_suggestions(result, result_seg, color) {
    if (result === "") return;
    var is_final = false;
    if (!color) {
      color = "black";
      is_final = true;
    }
    console.log(result, result_seg);

    $('#htr-suggestions').text(result).css('color', color);
    var data = cnv.data('htr');
    
    if (data.target) {
      $('#target').editable('replaceText', result, result_seg, data.target.token, is_final);
    }
  }

  
});
