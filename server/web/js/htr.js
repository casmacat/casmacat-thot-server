$(function(){

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

  // instantiate a drawable canvas 
  var cnv = $('#drawing-canvas').sketchable({
      interactive: true,
      events: {
        mouseDown: function(e) {
          e.preventDefault(); // prevent displaying caret
          clearTimeout(decoderTimer);
        },
        mouseUp: function(e) {
          var strokes = cnv.sketchable('strokes');
          var stroke = strokes[strokes.length-1];
          var gesture;
          if (strokes.length === 1) {
            gesture = gestureRecognizer.recognize(strokes);
            if (!gesture) {
              var data = {
                  source: $('#source').editable('getText'),
                  target: $('#target').editable('getText'),
                  caret_pos: 0,
              }
              casmacatHtr.startHtrSession(data);
              
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
            else {
              cnv.sketchable('clear');
            }
          }

          if (!gesture) {
            casmacatHtr.addStroke({points: stroke, is_pen_down: true});      
            decoderTimer = setTimeout(function () {
              $('#btn-decode').trigger('click');
            }, timerMs);
          }
        },
        clear: function(elem, data) {
          // cnv.removeData('htr');
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

  
});
