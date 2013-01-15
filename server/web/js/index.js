var casmacat;

$(function(){

  var currentCaretPos;
  
  /*******************************************************************************/
  /*           create server connection and handle server events                 */
  /*******************************************************************************/

  // connect to a server. casmacat will receive async server responses
  casmacat = new CasmacatClient('http://' + window.casmacatServer + '/casmacat');

  casmacat.on('disconnect', function(){ 
    blockUI("Server disconnected");
    this.socket.reconnect();
  });
  
  casmacat.on('reconnecting', function(){ 
    blockUI("Reconnecting...");
  });
  
  casmacat.on('reconnect_failed', function(){ 
    blockUI("Reconnect failed");
  });

  casmacat.on('reconnect', function() { 
    unblockUI();
    // Send initial config
    casmacat.configure({
      suggestions: $('#opt-suggestions').is(':checked'), 
      mode: $('input[@name=show]:checked').val()
    });
  });

  casmacat.on('anything', function(data, callback) { 
    console.info("anything:", data);
  });

  casmacat.on('message', function(message, callback) { 
    console.info("message:", data);
  });
      
  //casmacat.on('receive_log', function(msg) { console.log('server says:', msg); });

  casmacat.on('serverready', function() {
    unblockUI();
    var cfg = {
      suggestions: $('#opt-suggestions').is(':checked'), 
      mode: $('input[@name=show]:checked').val()
    };
    casmacat.configure(cfg);
  });
  

  // handle translation responses
  casmacat.on('contributionchange', function(obj) {
    var data = obj.data;
    // make sure new data still applies to current source
    if (data.text !== $('#source').editable('getText')) return;

    console.log('contribution changed', data);
    $('#btn-translate').val("Translate").attr("disabled", false);

  	update_translation_display(data);
    update_suggestions(data);
    
    if ($('#opt-itp, #opt-itp-ol').is(':checked')) {
      startImt(data.text);
    }
    
    //mw.addElement(data);
  });

  // handle post-editing (target has changed but not source)
  casmacat.on('translationchange', function(obj) {
    var data = obj.data;
    // make sure new data still applies to current source and target texts
    if (data.text !== $('#source').editable('getText')) return;
    if (data.translatedText !== $('#target').editable('getText')) return;

  	update_translation_display(data);
  });

  // handle alignment changes (updates highlighting and alignment matrix) 
  casmacat.on('alignmentchange', function(obj) {
    var data = obj.data;
    update_alignment_display(data.matrix, data.source, data.source_seg, data.target, data.target_seg);
  });

  // handle confidence changes (updates highlighting) 
  casmacat.on('confidencechange', function(obj) {
    var data = obj.data;
    var start_time = new Date().getTime();
    update_word_confidences_display(data.quality, data.word_confidences, data.source, data.source_seg, data.target, data.target_seg);
    //console.log("update_word_confidences_display:", new Date().getTime() - start_time, obj.data.elapsed_time);
  });

  // handle confidence changes (updates highlighting) 
  casmacat.on('predictionchange', function(obj) {
    var data = obj.data;
    console.log('prediction changed', data);
    update_suggestions(data);
  });

  // measures network latency
  casmacat.on('pong', function(ms) {
    console.log("Received ping:", new Date().getTime() - ms);
  });


  // receive server configuration 
  casmacat.on('configurationchange', function(obj) {
    if (obj.config) {
      var c = obj.config;
      if (c.sentences && c.sentences.length > 0) {
        var $select = $('select#source-list');
        $select.empty();
        $('#source, #target').empty();
        $.each(c.sentences, function(index, value) {
          $select.append( $('<option value="'+value+'">'+trimText(value, 12)+'</option>') );
        });
        $('#source').text( $select.first().val() );
      }
      if (c.confidencer && c.confidencer.threshold) {
        updateConfidenceSlider(c.confidencer.thresholds);
      }
      if (c.prioritizer && c.prioritizer.threshold) {
        updatePrioritySlider(c.prioritizer.threshold);
      }
    }
  });

  // handle updates changes (show a list of updated sentences) 
  casmacat.on('updateschange', function(obj) {
    console.log('updates:', obj.data.updates);
    if (obj.data.updates.length > 0) {
      var list = '<dl>';
      for (var i = 0; i < obj.data.updates.length; ++i) {
        var sentence = obj.data.updates[i];
        list += '<dt>' + sentence[0] + '</dt>';
        list += '<dd>' + sentence[1] + '</dd>';
      }
      list += '</dl>';
      $('#updatedsentences').html(list).toggle();
    }
  });

  // handle models changes (after OL) 
  casmacat.on('modelchange', function(obj) {
    console.log('models:', obj.data);
    $('#btn-update').val('Update').attr('disabled', false);
  });
  

  /*******************************************************************************/
  /*           handle UI events                                                  */
  /*******************************************************************************/

  // helper function to limit the number of server requests
  // at least throttle_ms have to pass for events to trigger 
  var throttle_ms = 50;
  var throttle = (function(){
    var timer = 0;
    return function(callback, ms){
      clearTimeout (timer);
      timer = setTimeout(callback, ms);
    };
  })();


  // #source and #target events
  // caretenter is a new event from jquery.editable that is triggered
  // whenever the caret enters in a new token span
  $('#source, #target').bind('caretenter', function(e, d) {
      $(d.token).trigger('mouseenter');
  })
  // caretleave is a new event from jquery.editable that is triggered
  // whenever the caret leaves a token span
  .bind('caretleave', function(e, d) {
      $(d.token).trigger('mouseleave');
  })
  // prevent new lines
  .keydown(function(e) {
    if (e.which === 13) {
      e.stopPropagation();
      e.preventDefault();
    }
  });

  // #source events
  // on key up throttle a new translation
  $('#source').keyup(function(e) {
    var $this = $(this),
        data = $this.data('editable'),
        source = $this.editable('getText');

    if (isPrintableChar(e)) {
      throttle(function() {
        if (data.str != source) {
          var query = {
            action: "getContribution",
            id_segment: 607906,
            // since we are listeing on keypress, source must include last typed char
            text: source,
            id_job: 1135,
            num_results: 2,
            id_translator: "me!"
          }
          casmacat.translate(query);
        }
      }, throttle_ms);
    }
  });



  function reject() {
    if ($('#opt-itp, #opt-itp-ol').is(':checked')) {
      var $this = $(this),
          data = $this.data('editable'),
          target = $this.editable('getText'),
          source = $('#source').editable('getText'),
          pos = $('#target').editable('getCaretPos');

      /* If click needs to go to the begining of the word
      var tokpos = $('#target').editable('getTokenAtCaretPos', pos),
          token = $(tokpos.elem);
      // is real token
      if (token.parent().hasClass('editable-token') && token.text().length !== tokpos.pos) {
        //rejected element is the next token from the cursor
        // token = token.parent(); 
        //var elem = token.next('.editable-token'); 
        //pos = $('#target').editable('getTokenPos', elem),

        // rejected element is token at cursor
        // so place at the beginning of the token 
        pos -= tokpos.pos;
      }
      // is space or filler or at the end of token
      else {
        // place at the end of the space
        pos += token.text().length - tokpos.pos;
      }
      console.log("reject suffix:", pos, tokpos);
      */

      var query = {
        action: "rejectSuffix",
        id_segment: 607906,
        text: source,
        // since we are listening on keypress, target must include last typed char
        target: target,
        caret_pos: pos,
        id_job: 1135,
        num_results: 2,
        id_translator: "me!"
      }

      casmacat.rejectSuffix(query);
    }
  };

  
  var typedWords = {};
  // caretmove is a new event from jquery.editable that is triggered
  // whenever the caret has changed position
  $('#target').bind('caretmove', function(e, d) {
    //var text = $(this).text();
    //$('#caret').html('<span class="prefix">' + text.substr(0, d.pos) + '</span>' + '<span class="suffix">' + text.substr(d.pos) + "</span>");
    // If cursor pos has chaged, invalidate previous states
    if (d.pos !== currentCaretPos) {
      console.log("Invalidating...");
      //mw.invalidate();
    }
    currentCaretPos = d.pos;
  })
  // on blur hide suggestions
  .blur(function(e) {
    $('#suggestions').css({'visibility': 'hidden'});
  })
  // on click reject suffix 
  .click(function(e) {
    reject();
  })
  // on keyup throttle a new translation
  .keyup(function(e) {
    var $this = $(this),
        data = $this.data('editable'),
        target = $this.editable('getText'),
        source = $('#source').editable('getText'),
        pos = $('#target').editable('getCaretPos');
        
    var spanElem = $('#target').editable('getTokenAtCaretPos', pos).elem.parentNode;
    var targetId = $(spanElem).attr("id");
    // Remember interacted words only when the user types in the right span
    var numInStr = targetId ? targetId.match(/(\d+)$/) : null;
    if (numInStr && parseInt(numInStr[0], 10)) {
      typedWords[ $(spanElem).attr("id") ] = true;
    }
    
    if (isPrintableChar(e)) {
      throttle(function () {
        if (data.str != target) {
          var query = {
            action: "getTokens",
            id_segment: 607906,
            text: source,
            // since we are listening on keypress, target must include last typed char
            target: target,
            caret_pos: pos,
            id_job: 1135,
            num_results: 2,
            id_translator: "me!"
          }
          //casmacat.getTokens(query);
          //console.log("query prefix:", query.target);
          if ($('#opt-itp, #opt-itp-ol').is(':checked')) {
            query.action = "getSuggestions";
            casmacat.setPrefix(query);
          }
        }
      }, throttle_ms);
    }
  });

  $('#btn-epen').click(function(e) {
    var $this = $('img', this);
    var $epen = $('#epen');
    var $canvas = $('#drawing-canvas');
    var $target = $('#target');
    
    if ($this.data('mode') === 'epen') {
      $this.attr('src', 'images/epen.png');
      $this.data('mode', 'keyboard');
      $epen.css({ visibility: 'hidden' });
    } else {
      $this.attr('src', 'images/keyboard.png');
      $this.data('mode', 'epen');
      $target.blur();

      var ofs = 50, pos = $target.offset(), siz = { width: $target.width() + ofs, height: $target.height() + ofs*2 };
      $epen.css({
        visibility: 'visible',
        top: pos.top - ofs,
        height: siz.height,
        left: -1, // FIXME: Review this
        width: siz.width,
      });

      $canvas.attr('width', $canvas.width());
      $canvas.attr('height', $canvas.height());
      $canvas.sketchable('clear');
    }
  });

  $('#btn-alignments').click(function(e) {
    $('#matrix').toggle();
  });

  $('#btn-updatedsentences').click(function(e) {
    casmacat.getUpdatedSentences();
  });
  
  $('#btn-reset').click(function(e) {
    if (!window.confirm("Are you sure you want to reset the models?")) return;
    blockUI("Reseting server...");
    casmacat.reset();
  });

/*
  $('#epen').mousedown(function(e) {
    var $epen = $(this);
    var $target = $('#target');
    
    var tokens = $target.editable('getTokensAtXY', e.clientX, e.clientY);
    if (tokens.length > 0 && tokens[0].distance.d === 0) {
      var $token = $(tokens[0].token);
      var newtok = $token.clone();
      console.log($token.offset());
      console.log(newtok.offset());
      $token.fadeOut(200).fadeIn(200).fadeOut(200).fadeIn(200);
    }
  });
*/

  $('#btn-translate').click(function(e) {
    $('#target').editable('setText', "");
    var query = {
      action: "getContribution",
      id_segment: 607906,
      text: $('#source').text(),
      id_job: 1135,
      num_results: 2,
      id_translator: "me!"
    }
    casmacat.translate(query);
    $(this).val("Loading...").attr("disabled", true);
  });

  $('#btn-update').click(function(e) {
    $(this).val('Updating...').attr('disabled', true);
    var query = {
      action: "update",
      id_segment: 607906,
      text: $('#source').text(),
      target: $('#target').text(),
      id_job: 1135,
      num_results: 2,
      id_translator: "me!"
    }
    casmacat.update(query);
  });

  $('#show-options input').change(function() {
    var show_type = $('input[@name=show]:checked').val();
    switch(show_type) {
      case 'PE':
      case 'ITP':
        $('#btn-update').attr("disabled", true);
        $('#btn-updatedsentences, #updatedsentences').hide();
        break;
      case 'ITP-OL':
        $('#btn-update').attr("disabled", false);
        $('#btn-updatedsentences').show();
        break;
      default:
        console.warning("#show-options changed, but no action was performed");
        break;
    }
    //if (!$('#target').is(':empty')) {
      casmacat.configure({suggestions:$('#opt-suggestions').is(':checked'), mode:show_type});
    //}
  });

  function startImt(txt) {
    var query = {
      action: "startImtSession",
      id_segment: 607906,
      text: txt,
      id_job: 1135,
      num_results: 2,
      id_translator: "me!"
    }
    casmacat.startImtSession(query);
  };


  /*******************************************************************************/
  /*           update the HTML display and attach events                         */
  /*******************************************************************************/


  
  function update_suggestions(data) {
    $target = $('#target');
    var d = $target.editable('getCaretXY');
    var targetText = $target.text();
    
    var show_type = $('input[@name=show]:checked').val();

    var count = 0;
    var list = $('<dl/>');
    for (var i = 0; i < data.matches.length; i++) {
      var match = data.matches[i];
      // XXX: If prediction came from click in the middle of a token, then the
      // sentence is not updated; since the following condition does not match:
      // The prefix in the sentence does not match the prefix in the prediction.
      if (targetText.substr(0, d.pos) === match.translation.substr(0, d.pos)) {
        if (show_type === match.created_by) {
          $target.editable('setText', match.translation, match.translationTokens);

          if (match.wordPriority) {
            update_word_priority_display($target, match.wordPriority);
          }
      
          // requests the server for new alignment and confidence info
          source = $('#source').editable('getText');
          var query = {
            action: "getAlignments",
            id_segment: 607906,
            text: source,
            target: match.translation,
            validated_words: [],
            id_job: 1135,
            num_results: 2,
            id_translator: "me!"
          }
          if ($('#opt-alignments').is(':checked')) casmacat.getAlignments(query);
          
          query.action = "getWordConfidences";
          if ($('#opt-confidences').is(':checked')) casmacat.getWordConfidences(query);
        }
        else if ($('#opt-suggestions').is(':checked')) {
          list.append($('<dt/>').text(match.created_by));
          list.append($('<dd/>').text(match.translation.substr(d.pos)));
          count++;
        }
      }
    }

    if (count > 0 && $('#btn-epen > img').data('mode') !== 'epen') {
      var ofs = 50, pos = $target.offset(), siz = { width: $target.width() + ofs, height: $target.height() + ofs*2 };
      $('#suggestions').css({top: d.caretRect.bottom, left: d.caretRect.left - siz.width/2, visibility: 'visible'}).html(list);
      //$('#target').editable('setText', target, target_seg);
    }
    else {
      $('#suggestions').css({'visibility': 'hidden'}).html('');
    }
  }


  // updates the translation display and queries for new alignments and word confidences
  function update_translation_display(data) {
    var source = data.text
      , source_seg = data.textTokens
      , target = data.translatedText
      , target_seg = data.translatedTextTokens;

    // sets the text in the editable div. It tokenizes the sentence and wraps tokens in spans
    $('#source').editable('setText', source, source_seg);
    $('#target').editable('setText', target, target_seg);

    // resizes the alignment matrix in a smoothed manner but it does not fill missing alignments 
    // (makes a diff between previous and current tokens and inserts/replaces/deletes columns and rows)
    updateTable($('#demo-table'), tokenize_by_segments(source, source_seg), tokenize_by_segments(target, target_seg));

    // requests the server for new alignment and confidence info
    var query = {
      action: "getAlignments",
      id_segment: 607906,
      text: source,
      target: target,
      validated_words: [],
      id_job: 1135,
      num_results: 2,
      id_translator: "me!"
    }

    if ($('#opt-alignments').is(':checked')) casmacat.getAlignments(query);
    
    query.action = "getWordConfidences";
    if ($('#opt-confidences').is(':checked')) casmacat.getWordConfidences(query);
  }


  // get the aligned html ids for source and target tokens
  function get_alignment_ids(alignments, sourcespans, targetspans) {
    // sourceal stores ids of target spans aligned to it
    var sourceal = new Array();
    sourceal.length = alignments.length;
    for (var c = 0; c < alignments.length; ++c) sourceal[c] = new Array();

    // targetal stores ids of source spans aligned to it
    var targetal = new Array();
    targetal.length = alignments[0].length;
    for (var v = 0; v < alignments[0].length; ++v) targetal[v] = new Array();
    
    for (var c = 0; c < alignments.length; ++c) {
      var alignment = alignments[c];          
      for (var v = 0; v < alignment.length; ++v) {
        if (alignment[v] > 0.5) {
          sourceal[c].push('#' + targetspans[v].id);
          targetal[v].push('#' + sourcespans[c].id);
        }
      }
    }
    
    return {sourceal: sourceal, targetal: targetal};	  	
  }

  // add alignment events so that aligned words are highlighted
  function add_alignment_events(spans, aligids) {
    // add mouseenter mouseleave events to token spans
    //XXX: what happens is the span had already been assigned align visualization events? 
    // many event (equal) handlers are called?
    for (var i = 0; i < spans.length; i++) {
      $(spans[i]).mouseenter(aligids[i], function (e) {
        for (var j = 0; j < e.data.length; j++) {
          $(e.data[j]).toggleClass('align', true);
        }
      });
      $(spans[i]).mouseleave(aligids[i], function (e) {
        if (this.parentNode && $(this.parentNode).is('.editable')) {
          var data = $(this.parentNode).data('editable');
          if (data.currentElement != this) {
            for (var j = 0; j < e.data.length; j++) {
              $(e.data[j]).toggleClass('align', false);
            }
          }
        }
      });
    } 
  }

  // update the alignments in the alignment matrix
  function update_aligment_matrix(alignments) {
    // update alignment matrix info
    for (var c = 0; c < alignments.length; ++c) {
      var alignment = alignments[c];          
      for (var v = 0; v < alignment.length; ++v) {
        $("#demo-table tbody tr:eq("+c+") td:eq("+v+")")
          .css('background-color', grayColor(alignment[v]));
      }        
    }
  }

  // updates the alignment display with new alignment info      
  function update_alignment_display(alignments, source, source_seg, target, target_seg) {
    // make sure new data still applies to current text
    if (!(alignments.length > 0 && alignments[0].length > 0)) return;
    if (source !== $('#source').editable('getText')) return;
    if (target !== $('#target').editable('getText')) return;

    // get span tokens 
    var sourcespans = $('#source > .editable-token');
    var targetspans = $('#target > .editable-token');
  
    var aligids = get_alignment_ids(alignments, sourcespans, targetspans);  

    // sourceal stores ids of target spans aligned to it
    var sourceal = aligids.sourceal;
    var targetal = aligids.targetal;

    // add mouseenter mouseleave events to source spans
    add_alignment_events(sourcespans, sourceal);

    // add mouseenter mouseleave events to target spans
    add_alignment_events(targetspans, targetal);

    if ($('#opt-alignments').is(':checked') && $('#matrix').is(":visible")) {
      update_aligment_matrix(alignments);
    }
  }


  function update_word_priority_display($target, priorities) {
    // get target span tokens 
    var spans = $('.editable-token', $target), scale = 2.0, userPriority = parseInt($('#slider-priority-text').text());
        
    // add class to color tokens 'wordconf-ok', 'wordconf-doubt' or 'wordconf-bad'
    for (var c = 0; c < priorities.length; ++c) {
      var $span = $(spans[c]), opacity = 1.0;

      if (priorities[c] >= userPriority) {
        opacity = Math.pow(2, (-priorities[c] + 2) * scale);
      }

      $span.data('priority', priorities[c])
           .css({ opacity: opacity });
    }
    console.log("word priorities:", priorities);
  }
 
  var confThreshold = {};
  // updates the confidence display with new confidence info      
  function update_word_confidences_display(sent, confidences, source, source_seg, target, target_seg) {
    // make sure new data still applies to current text
    if (source !== $('#source').editable('getText')) return;
    if (target !== $('#target').editable('getText')) return;

    // get target span tokens 
    var spans = $('#target > .editable-token');
    // add class to color tokens 'wordconf-ok', 'wordconf-doubt' or 'wordconf-bad'
    for (var c = 0; c < confidences.length; ++c) {
      var $span = $(spans[c]), conf = Math.round(confidences[c]*100)/100, cssClass;
      if (conf > confThreshold.doubt /*|| typedWords.hasOwnProperty($span.attr("id"))*/) {
        cssClass = "wordconf-ok";
      }
      else if (conf > confThreshold.bad) {
        cssClass = "wordconf-doubt";
      }
      else {
        cssClass = "wordconf-bad";
      }

      $span.attr('title', 'conf: ' + Math.round(conf*100))
           .data('confidence', conf)
           .removeClass("wordconf-ok wordconf-doubt wordconf-bad")
           .addClass(cssClass);

      // also update bottom of alignment matrix with values
      $("#demo-table tfoot tr td:eq("+(c+1)+")").text(conf);
    }
  }
      
  function grayColor(num) {
    var color = 255 - Math.floor(num * 255);
    return 'rgb('+color+','+color+','+color+')'; 
  };

  function updateTable(table, src, tgt) {
    if (!$('#matrix').is(":visible")) return;
    //console.log(table);
    var src_tok = getTokens($('tbody tr', table).find('th.right:eq(0)'));
    var tgt_tok = getTokens($('thead th:gt(0)', table));

    var src_merge = merge_tokens(src_tok, src);
    var tgt_merge = merge_tokens(tgt_tok, tgt);

    var ndel = 0, nins = 0;
    for (var ml = 0; ml < src_merge.length; ml++) {
      var merge_pos  = src_merge[ml][0], 
          row        = src_merge[ml][1];
          merge_type = src_merge[ml][2];

      //console.log(merge_pos, row, merge_type);

      if (merge_type === 'D') {
        merge_pos += nins - ndel ;
        $('tbody tr:eq(' + merge_pos + ')', table).remove();
        ndel++;
      }
      else if (merge_type === 'S') {
        merge_pos += nins - ndel;
        $('tbody tr:eq(' + merge_pos + ') th', table).text(src[row]).rotateCells();
      }
      else if (merge_type === 'I') {
        var row_html =     '<tr>';
        row_html +=        '<th class="right">' + $('<span/>').text(src[row]).text() + '</th>';
        for (var t = 0; t < tgt_tok.length; ++t) {
          row_html +=      '<td>&nbsp;</td>';
        }
        row_html +=        '<th class="left">' + $('<span/>').text(src[row]).text() + '</th>';
        row_html +=      '</tr>';

        $('tbody tr:eq(' + row + ')', table).before(row_html);

        nins++;
      }
    }

    var ndel = 0, nins = 0;
    for (var ml = 0; ml < tgt_merge.length; ml++) {
      var merge_pos  = tgt_merge[ml][0], 
          col        = tgt_merge[ml][1];
          merge_type = tgt_merge[ml][2];

      if (merge_type === 'D') {
        merge_pos += nins - ndel ;
        $('thead tr th:eq(' + (merge_pos + 1) + '), tbody tr:last th:eq(' + (merge_pos + 1) + ')', table).remove();
        $('tbody tr', table).not(':last').each(function () { $('td:eq(' + merge_pos + ')', this).remove();});
        //$('tfoot tr td:eq(' + (merge_pos + 1) + ')', table).remove();
        ndel++;
      }
      else if (merge_type === 'S') {
        merge_pos += nins - ndel;
        $('thead tr th:eq(' + (merge_pos + 1) + '), tbody tr:last th:eq(' + (merge_pos + 1) + ')', table).text(tgt[col]).data('rotated', false);
      }
      else if (merge_type === 'I') {
        //console.log(merge_pos, col, merge_type);
        if (col === 0) {
          $('thead tr th:first, tbody tr:last th:first', table).each(function() {
            var th = $('<th class="vertical">' + tgt[col] + '</th>');
            $(this).after(th);
          });
          $('tbody tr', table).not(':last').each(function () { $('th:eq(0)', this).after('<td>&nbsp;</td>');});
          //$('tfoot tr td:first', table).after('<td></td>');
        } else {
          $('thead tr th:eq(' + col + '), tbody tr:last th:eq(' + col + ')', table).each(function() {
            var th = $('<th class="vertical">' + tgt[col] + '</th>');
            $(this).after(th);
          });
          $('tbody tr', table).not(':last').each(function () { $('td:eq(' + (col - 1) + ')', this).after('<td>&nbsp;</td>');});
          //$('tfoot tr td:eq(' + col + ')', table).after('<td></td>');
        }
        nins++;
      }
      
    }

    table.rotateCells();
  };


  $("#opt-suggestions").click(function(e){
  });

  $("#opt-confidences").click(function(e){
    $('#conf-thresholds').toggle();
  });
    
  $("#opt-alignments").click(function(e){
    if ($(this).is(':checked')) {
      $('#btn-alignments, #matrix').show();
    } else {
      $('#btn-alignments, #matrix').hide();
    }
  });


  $('#source').text($('#source-list').val());
  $('#source-list').change(function(e) {
    $('#source').text($('#source-list').val());
    $('#btn-translate').click();
    $('#target').focus();
  });

  
  var $ctrlLegend = $('#control-panel legend');
  $ctrlLegend.wrapInner('<a href="#toggle-options"/>');
  $ctrlLegend.find('a').click(function(e){
    e.preventDefault();
    toggleControlPanel();
  });

	$('#slider-conf').slider({
    range: true,
    min: 0,
    max: 100,
    values: [ 3, 30 ],
    slide: function(event, ui) {
      updateConfidenceSlider(ui.values);
    }
  });

	$('#slider-priority').slider({
    min: 1,
    max: 10,
    value: 1,
    slide: function(event, ui) {
      updatePrioritySlider(ui.value);
    }
  });
    
  function updateConfidenceSlider(values) {
    if (!values) values = $('#slider-conf').slider("option", "values");
    confThreshold = {
      bad: values[0]/100,
      doubt: values[1]/100
    };
    
    $('#slider-bad').text(values[0]);
    $('#slider-doubt').text(values[1]);

    // get target span tokens 
    var spans = $('#target > .editable-token');    
    // add class to color tokens 'wordconf-ok', 'wordconf-doubt' or 'wordconf-bad'
    for (var c = 0; c < spans.length; ++c) {
      $span = $(spans[c]);
      $span.removeClass('wordconf-ok wordconf-doubt wordconf-bad');
      var conf = $span.data('confidence');
      if (conf) {
        var cssClass;
        if (conf > confThreshold.doubt /*|| typedWords.hasOwnProperty($span.attr("id"))*/) {
          cssClass = 'wordconf-ok';
        }
        else if (conf > confThreshold.bad) {
          cssClass = 'wordconf-doubt';
        }
        else {
          cssClass = 'wordconf-bad';
        }
        $(spans[c]).addClass(cssClass);
      }
    }            
  };

  function updatePrioritySlider(value) {
    if (!value) value = $('#slider-priority').slider("option", "value");
    $('#slider-priority-text').text(value);
  };
    
  function toggleControlPanel() {
    var $options = $('#options'), $summary = $('#options-summary');
    $options.toggle();
    if (!$options.is(':visible')) {
      makeControlPanelSummary();
      $summary.show();
    } else {
      $summary.hide();
    }
  };
  
  function makeControlPanelSummary() {
    $('#set-mode').text( $('#show-options input[@name=show]:checked').val() );
    $('#set-suggestions').text( $('#opt-suggestions').is(':checked') );
    $('#set-confidences').text( $('#opt-confidences').is(':checked') + " ["+ confThreshold.bad*100 + "/"+ confThreshold.doubt*100 +"]" );
    $('#set-alignments').text( $('#opt-alignments').is(':checked') + " [matrix: "+ $('#matrix').is(':hidden') +"]" );
  };

  function trimText(text, numWords, delimiter) {
    if (!numWords)  numWords  = 5;
    if (!delimiter) delimiter = " ";    
    
    var words = text.split(delimiter), trimmed = "";
    for (var i = 0; i < words.length; ++i) {
      if (i <= numWords) {
        trimmed += words[i] + delimiter;
      } else break;
    }
    if (i > numWords) {
      trimmed += delimiter + "[...]"; 
    }

    return trimmed;
  }

  // This function only works with keypress events
  function isPrintableChar(evt) {
    if (typeof evt.which == "undefined") {
      return true;
    } else if (typeof evt.which == "number" && evt.which > 0) {
      return evt.which == 32 || evt.which == 13 || evt.which > 46;
    }
    return false;
  }

  function blockUI(msg) {
    $('#global').block({
      message: '<h2>' + msg + '</h2>',
      css: { fontSize:'150%', padding:'1% 2%', borderWidth:'3px', borderRadius:'10px', '-webkit-border-radius':'10px', '-moz-border-radius':'10px' }
    });  
  }
  function unblockUI() {
    $('#global').unblock();
  }


  /*******************************************************************************/
  /*                                 Init calls                                  */
  /*******************************************************************************/ 
  
  updateConfidenceSlider();
  updatePrioritySlider();
  toggleControlPanel();
  $('#matrix, #btn-alignments, #btn-updatedsentences, #updatedsentences').hide();
  casmacat.ping(new Date().getTime());
  casmacat.getServerConfig();
  blockUI("Connecting...");
  
});
