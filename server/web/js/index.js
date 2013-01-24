if (typeof casmacat === 'undefined') throw "casmacat object not defined";

var casmacatItp; // To be reused by other scripts

$(function(){
   
  blockUI("Connecting...");

  function firstConnection() {
    updateConfidenceSlider();
    updatePrioritySlider();
    toggleControlPanel();
    $('#matrix, #btn-alignments, #btn-updatedsentences, #updatedsentences').hide();
    casmacatItp.ping({
      ms: new Date().getTime()
    });
    casmacatItp.getServerConfig();
    if (casmacat.htrServer) {
      $('#btn-epen').click();
    }
  }

  // Connect to a server; casmacat will receive async server responses
  casmacatItp = new PredictiveCatClient(true);
  casmacatItp.connect('http://' + casmacat.itpServer + '/casmacat');

  // Socket.IO callbacks -------------------------------------------------------
  // See https://github.com/LearnBoost/socket.io/wiki/Exposed-events
  casmacatItp.on('connect', function() {
    firstConnection();
    unblockUI();
  });
  
  casmacatItp.on('disconnect', function() {
    blockUI("Server disconnected");
    casmacatItp.checkConnection();
  });
  
  casmacatItp.on('reconnecting', function() { 
    blockUI("Reconnecting...");
  });
  
  casmacatItp.on('reconnect_failed', function() { 
    blockUI("Reconnect failed");
  });

  casmacatItp.on('reconnect', function() { 
    unblockUI();
    casmacatItp.configure({
      suggestions: $('#opt-suggestions').is(':checked'), 
      mode: $('input[@name=show]:checked').val()
    });
  });

  casmacatItp.on('anything', function(data) {
    console.info("anything:", obj);
  });

  casmacatItp.on('message', function(msg, callback) {
    console.info("message:", msg);
  });
  
  
  // CatClient callbacks -------------------------------------------------------
  
  //casmacatItp.on('receiveLog', function(msg) { console.log('server says:', msg); });

  casmacatItp.on('resetResult', function(data, err) {
    unblockUI();
    var cfg = {
      suggestions: $('#opt-suggestions').is(':checked'), 
      mode: $('input[@name=show]:checked').val()
    };
    casmacatItp.configure(cfg);
  });
  
  // Handle translation responses
  casmacatItp.on('decodeResult', function(data, err) {
    var bestResult = data.nbest[0];
    // make sure new data still applies to current source
    if (data.source !== $('#source').editable('getText')) return;

    //console.log('contribution changed', data);
    $('#btn-translate').val("Translate").attr("disabled", false);

  	update_translation_display(data);
    update_suggestions(data);
    
    if ($('#opt-itp, #opt-itp-ol').is(':checked')) {
      startImt(bestResult.target);
    }
    
    mousewheel.addElement(data);
  });

  // Handle post-editing (target has changed but not source)
  casmacatItp.on('getTokensResult', function(data, err) {
    // make sure new data still applies to current source and target texts
    if (data.source !== $('#source').editable('getText')) return;
    if (data.target !== $('#target').editable('getText')) return;

  	update_translation_display(data);
  	
  	//mousewheel.addElement(data);
  });

  // Handle alignment changes (updates highlighting and alignment matrix) 
  casmacatItp.on('getAlignmentsResult', function(data, err) {
    update_alignment_display(data.alignments, data.source, data.sourceSegmentation, data.target, data.targetSegmentation);
  });

  // Handle confidence changes (updates highlighting) 
  casmacatItp.on('getConfidencesResult', function(data, err) {
    //var start_time = new Date().getTime();
    update_word_confidences_display(data.quality, data.confidences, data.source, data.sourceSegmentation, data.target, data.targetSegmentation);
    //console.log("update_word_confidences_display:", new Date().getTime() - start_time, obj.data.elapsed_time);
  });

  // Handle confidence changes (updates highlighting) 
  casmacatItp.on(['setPrefixResult', 'rejectSuffixResult'], function(data, err) {
    console.log('prediction changed', data);
    update_suggestions(data);
    
    mousewheel.addElement(data);
  });

  // Measure network latency
  casmacatItp.on('pingResult', function(data, err) {
    console.log("Received ping:", new Date().getTime() - data.ms);
  });


  // Receive server configuration 
  casmacatItp.on('getServerConfigResult', function(data, err) {
    var c = data.config;
    if (c) {
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
      reposHtrCanvas();
    }
  });

  // Handle updates changes (show a list of updated sentences) 
  casmacatItp.on('getValidatedContributionsResult', function(data, err) {
    var contribs = data.contributions;
    console.log('Validated contributions:', contribs);
    if (contribs.length > 0) {
      var list = '<dl>';
      for (var i = 0; i < contribs.length; ++i) {
        var sentence = [i];
        list += '<dt>' + sentence[0] + '</dt>';
        list += '<dd>' + sentence[1] + '</dd>';
      }
      list += '</dl>';
      $('#updatedsentences').html(list).toggle();
    }
  });

  // Handle models changes (after OL) 
  casmacatItp.on('validateResult', function(data, err) {
    //console.log('models:', data);
    $('#btn-update').val('Update').attr('disabled', false);
  });
  

  // UI events -----------------------------------------------------------------

  // Helper function to limit the number of server requests;
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
  .keydown(function(e) {
    // prevent new lines
    if (e.which === 13) {
      e.stopPropagation();
      e.preventDefault();
    } 
    // prevent tabs that move to the next word or to the next priority word
    else if (false && e.which === 9) {
      e.stopPropagation();
      e.preventDefault();
      var res = $('#target').editable('getTokenAtCaret');
      console.log(res);
      
      

      var $elem = $(res.elem)
        , $curr = $(res.elem.parentNode);

      if (!$curr.hasClass('editable-token') || res.pos === res.elem.length) {
        $curr = $elem.next('.editable-token');
      }

      if ($curr) {
        var $next = $curr.next('span.editable-token')
          , priority = $next.data('priority');
        console.log($elem, $curr, $next);
        if (priority) {
          var rightSiblings = $next.nextAll();
          for (var i = 0; i < rightSiblings.length; ++i) {
            if ($(rightSiblings[i]).data('priority') > priority) break;
          }
          $next = $(rightSiblings[i]);
        }
        console.log($next);
        $('#target').editable('setCaretAtToken', $next.get(0));
      }
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
            source: source,
            //num_results: 2,
          }
          casmacatItp.decode(query);
        }
      }, throttle_ms);
    }
  });



  function reject() {
    if ($('#opt-itp, #opt-itp-ol').is(':checked')) {
      var target = $('#target').editable('getText'),
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

      casmacatItp.rejectSuffix({
        target: target,
        caretPos: pos,
        numResults: 1,
      });
    }
  };

  
  var typedWords = {};
  // caretmove is a new event from jquery.editable that is triggered
  // whenever the caret has changed position
  $('#target').bind('caretmove', function(e, d) {
    //var text = $(this).text();
    //$('#caret').html('<span class="prefix">' + text.substr(0, d.pos) + '</span>' + '<span class="suffix">' + text.substr(d.pos) + "</span>");
    // If cursor pos has chaged, invalidate previous states
    if (typeof currentCaretPos != 'undefined' && d.pos !== currentCaretPos) {
      mousewheel.invalidate();
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
            target: target,
            caretPos: pos,
            numResults: 1
          }
          //casmacatItp.getTokens(query);
          //console.log("query prefix:", query.target);
          if ($('#opt-itp, #opt-itp-ol').is(':checked')) {
            casmacatItp.setPrefix(query);
          }
        }
      }, throttle_ms);
    }
  });

  $('#btn-epen').click(function(e) {
    var $this = $('img', this), $epen = $('#epen'), $canvas = $('#drawing-canvas'), $target = $('#target');
    
    if ($this.data('mode') === 'epen') {
      $this.attr('src', 'images/epen.png');
      $this.data('mode', 'keyboard');
      $epen.css({ visibility: 'hidden' });
      $target.css({ borderColor:'steelBlue', backgroundColor:'whiteSmoke' });
    } else {
      $this.attr('src', 'images/keyboard.png');
      $this.data('mode', 'epen');
      $target.css({ borderColor:'white' }); // add backgroundColor:'white' ?
      $epen.css({ visibility: 'visible' });
      reposHtrCanvas();
    }
    
    $target.blur();
  });

  $('#btn-alignments').click(function(e) {
    $('#matrix').toggle();
  });

  $('#btn-updatedsentences').click(function(e) {
    casmacatItp.getValidatedContributions();
  });
  
  $('#btn-reset').click(function(e) {
    if (!window.confirm("Are you sure you want to reset the models?")) return;
    blockUI("Reseting server...");
    casmacatItp.reset();
  });

/*
  $('#epen').mousedown(function(e) {
    var $epen = $(this);
    var $target = $('#target');
    
    var tokens = $target.editable('getTokensAtXY', [e.clientX, e.clientY]);
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
    $('.drawhere').remove();
    $('#target').editable('setText', "");
    var query = {
      source: $('#source').text(),
      //num_results: 2,
    }
    casmacatItp.decode(query);
    $(this).val("Loading...").attr("disabled", true);
    
    mousewheel.invalidate();
  });

  $('#btn-update').click(function(e) {
    $(this).val('Updating...').attr('disabled', true);
    var query = {
      source: $('#source').text(),
      target: $('#target').text(),
    }
    casmacatItp.validate(query);
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
      casmacatItp.configure({suggestions:$('#opt-suggestions').is(':checked'), mode:show_type});
    //}
  });

  function startImt(txt) {
    var query = {
      source: txt
    }
    casmacatItp.startSession(query);
  };


  /*******************************************************************************/
  /*           update the HTML display and attach events                         */
  /*******************************************************************************/

  
  function update_suggestions(data) {
    var $target = $('#target'), 
        targetText = $target.text(),
        d = $target.editable('getCaretXY'),
        show_type = $('input[@name=show]:checked').val(),
        count = 0,
        list = $('<dl/>');
        
    if (!data || !data.nbest) return;
    for (var i = 0; i < data.nbest.length; i++) {
      var match = data.nbest[i];
      // XXX: If prediction came from click in the middle of a token, then the
      // sentence is not updated; since the following condition does not match:
      // The prefix in the sentence does not match the prefix in the prediction.
      if (targetText.substr(0, d.pos) === match.target.substr(0, d.pos)) {
        if (show_type === match.author) {
          $target.editable('setText', match.target, match.targetSegmentation);

          if (match.priorities) {
            update_word_priority_display($target, match.priorities);
          }
      
          // requests the server for new alignment and confidence info
          var query = {
            source: $('#source').editable('getText'),
            target: match.target,
          }
          if ($('#opt-alignments').is(':checked')) {
            casmacatItp.getAlignments(query);
          }
          if ($('#opt-confidences').is(':checked')) {
            casmacatItp.getConfidences(query);
          }
        } else if ($('#opt-suggestions').is(':checked')) {
          list.append($('<dt/>').text(match.author));
          list.append($('<dd/>').text(match.target.substr(d.pos)));
          count++;
        }
      }
    }

    if (count > 0 && $('#btn-epen > img').data('mode') !== 'epen') {
      var ofs = 50, pos = $target.offset(), siz = { width: $target.width() + ofs, height: $target.height() + ofs*2 };
      $('#suggestions').css({top: d.caretRect.bottom, left: d.caretRect.left - siz.width/2, visibility: 'visible'}).html(list);
      //$('#target').editable('setText', target, targetSegmentation);
    }
    else {
      $('#suggestions').css({'visibility': 'hidden'}).html('');
    }
  };


  // updates the translation display and queries for new alignments and word confidences
  function update_translation_display(data) {
    // getTokens doesn't have nbest, so this check is required
    var bestResult = data.nbest ? data.nbest[0] : data;
    var source     = data.source,
        sourceSeg  = data.sourceSegmentation,
        target     = bestResult.target,
        targetSeg  = bestResult.targetSegmentation;
    
    // sets the text in the editable div. It tokenizes the sentence and wraps tokens in spans
    $('#source').editable('setText', source, sourceSeg);
    $('#target').editable('setText', target, targetSeg);

    // resizes the alignment matrix in a smoothed manner but it does not fill missing alignments 
    // (makes a diff between previous and current tokens and inserts/replaces/deletes columns and rows)
    updateTable($('#demo-table'), tokenize_by_segments(source, sourceSeg), tokenize_by_segments(target, targetSeg));

    // requests the server for new alignment and confidence info
    var query = {
      source: source,
      target: target,
      //validated_words: []
    }
    if ($('#opt-alignments').is(':checked')) {
      casmacatItp.getAlignments(query);
    }
    if ($('#opt-confidences').is(':checked')) {
      casmacatItp.getConfidences(query);
    }
  };


  // get the aligned html ids for source and target tokens
  function get_alignment_ids(alignments, sourcespans, targetspans) {
    // sourceal stores ids of target spans aligned to it
    var sourceal = [];
    sourceal.length = alignments.length;
    for (var c = 0; c < alignments.length; ++c) sourceal[c] = [];

    // targetal stores ids of source spans aligned to it
    var targetal = [];
    targetal.length = alignments[0].length;
    for (var v = 0; v < alignments[0].length; ++v) targetal[v] = [];
    
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
  };

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
  };

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
  };

  // updates the alignment display with new alignment info      
  function update_alignment_display(alignments, source, sourceSegmentation, target, targetSegmentation) {
    // make sure new data still applies to current text
    console.log(arguments)
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
  };


  function update_word_priority_display($target, priorities) {
    // get target span tokens 
    var spans = $('.editable-token', $target), 
        userPriority = parseInt($('#slider-priority-text').text()),
        currentSpan = $('#target').editable('getTokenAtCaret').elem.parentNode;
        currentPriority = priorities[$(currentSpan).index()];
    // add class to color tokens 'wordconf-ok', 'wordconf-doubt' or 'wordconf-bad'
    for (var c = 0; c < priorities.length; ++c) {
      var $span = $(spans[c]), opacity = 1.0, scale = 2.0;
      if (priorities[c] >= currentPriority + userPriority) {
        opacity = 0.5; //Math.pow(2, (-priorities[c] + 2) * scale);
      }

      $span.data('priority', priorities[c])
           .css({ opacity: opacity });
    }
    //console.log("user priority:", userPriority, "word priorities:", priorities);
  }
 
  var confThreshold = {};
  // updates the confidence display with new confidence info      
  function update_word_confidences_display(sent, confidences, source, sourceSegmentation, target, targetSegmentation) {
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
  };
      
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
    };

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
    reposHtrCanvas();
  };
  
  function makeControlPanelSummary() {
    $('#set-mode').text( $('#show-options input[@name=show]:checked').val() );
    $('#set-suggestions').text( $('#opt-suggestions').is(':checked') );
    $('#set-confidences').text( $('#opt-confidences').is(':checked') + " ["+ confThreshold.bad*100 + "/"+ confThreshold.doubt*100 +"]" );
    $('#set-alignments').text( $('#opt-alignments').is(':checked') + " [matrix: "+ $('#matrix').is(':hidden') +"]" );
  };

  function reposHtrCanvas() {
    var $canvas = $('#drawing-canvas'), $target = $('#target'), $epen = $('#epen');
    
    var ofs = 50, pos = $target.offset(), siz = { width: $target.width() + ofs, height: $target.height() + ofs*2 };
    $epen.css({
      top: pos.top - ofs,
      height: siz.height,
      left: 2, // FIXME: Review this
      width: siz.width,
    });

    $canvas.attr('width', $canvas.width());
    $canvas.attr('height', $canvas.height());
    //$canvas.sketchable('clear');
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
  };

  // This function only works with keypress events
  function isPrintableChar(evt) {
    if (typeof evt.which == "undefined") {
      return true;
    } else if (typeof evt.which == "number" && evt.which > 0) {
      return evt.which == 32 || evt.which == 13 || evt.which > 46;
    }
    return false;
  };

  function blockUI(msg, fn) {
    $('#global').block({
      message: '<h2>' + msg + '</h2>',
      centerY: false, // Fix weird position issue in some modern browsers
      css: { fontSize:'150%', padding:'1% 2%', top:'45%', borderWidth:'3px', borderRadius:'10px', '-webkit-border-radius':'10px', '-moz-border-radius':'10px' },
//      onUnblock: fn
    });  
  };
  
  function unblockUI() {
    $('#global').unblock();
  };


  /*******************************************************************************/
  /*                                 Init calls                                  */
  /*******************************************************************************/ 

  require(["jquery.rotatecells"]);
  //require(["jquery.blockUI"], function(){
  //});
 
  // TODO: Load modules from here onwards --------------------------------------
  
  var mousewheel;
  require(["jquery.mousewheel", "jquery.hotkeys", "module.mousewheel"], function(){
    mousewheel = new MouseWheel();
    mousewheel.init('#target', {
      change: function(data) {
        if (!Boolean($('#target').editable('getText'))) {
          return false;
        }
        if (data) {
          console.log("Loading previous data...");
          update_suggestions(data);
        } else {
          console.log("Rejecting...");
          reject();
        }
      }
    });    
  });

  var memento;
  require(["jquery.editable", "module.memento"], function(){
    memento = new Memento();
    memento.init('#target');
  });
  
});
