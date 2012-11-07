$(function(){

  /*******************************************************************************/
  /*           create server connection and handle server events                 */
  /*******************************************************************************/

  // connect to a server. casmacat will receive async server responses
  var casmacat = new CasmacatClient('http://' + window.casmacatServer + '/casmacat');

  // handle disconections and debug information
  casmacat.on('disconnect', function(){ this.socket.reconnect(); });
  casmacat.on('receive_log', function(msg) { console.log('server says:', msg); });

  // instantiate a drawable canvas 
  var cnv = $('#drawing-canvas').sketchable({
      interactive: true,
      events: {
        mouseDown: function(evt) {
          var strokes = cnv.sketchable('strokes');
          console.log('n srtokes', strokes.length);
          if (strokes.length === 0) {
            var source = '', target = '', caret_pos = 0;
            casmacat.startHtrSession(source, target, caret_pos);
            console.log('starting session');
          }
        },
        mouseUp: function(evt) {
          var strokes = cnv.sketchable('strokes');
          var stroke = strokes[strokes.length-1];
          console.log('adding strokes', stroke);
          casmacat.addStroke(stroke, true);      
        },
     },
  });
  
  
  
  // handle HTR responses
  casmacat.on('htrupdate', function(result, result_seg) {
    console.log('updated', result);
    update_suggestions(result, result_seg, 'red');
  });

  // handle post-editing (target has changed but not source)
  casmacat.on('htrchange', function(result, result_seg) {
    update_suggestions(result, result_seg);
  });

  // on click send strokes to the htr server
  $('#decode').click(function(e) {
    casmacat.endHtrSession();
  });

  // clear canvas
  $('#clear').click(function(e){
    cnv.sketchable('clear');
    $('#suggestions').empty();
  });

  /*******************************************************************************/
  /*           update the HTML display and attach events                         */
  /*******************************************************************************/


  function update_suggestions(result, result_seg, color) {
    if (!color) color = "black";
    console.log(result, result_seg);

    $('#suggestions').text(result).css('color', color);
  }

  
});
