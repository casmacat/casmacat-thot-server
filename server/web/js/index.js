$(function(){

      var casmacat = new CasmacatClient('http://' + window.casmacatServer + '/casmacat');

      casmacat.on('disconnect', function(){ this.socket.reconnect(); });
      casmacat.on('receive_log', function(msg) { 
        var txt = $('textarea');
        txt.val(txt.val() + "\n" + msg);
      });
      casmacat.on('translate_async', function(source, source_seg, target, target_seg) {
        // if the source has changed ignore the results
        if (source !== $('#source').editable('getText')) return;

        $('#source').editable('setText', source, source_seg);
        $('#target').editable('setText', target, target_seg);

        updateTable($('#demo-table'), tok(source, source_seg), tok(target, target_seg));
        //createTable($('#source'), $('#target'));

        casmacat.getAlignments(source, target);
        casmacat.getWordConfidences(source, target, []);
      });
      casmacat.on('get_tokens_async', function(source, source_seg, target, target_seg) {
        // make sure new data still applies to current text
        if (source !== $('#source').editable('getText')) return;
        if (target !== $('#target').editable('getText')) return;

        $('#source').editable('setText', source, source_seg);
        $('#target').editable('setText', target, target_seg);

        updateTable($('#demo-table'), tok(source, source_seg), tok(target, target_seg));
        //createTable($('#source'), $('#target'));

        casmacat.getAlignments(source, target);
        casmacat.getWordConfidences(source, target, []);
      });

      casmacat.on('get_alignments_async', function(alignments, source, source_seg, target, target_seg) {
        // make sure new data still applies to current text
        if (!(alignments.length > 0 && alignments[0].length > 0)) return;
        if (source !== $('#source').editable('getText')) return;
        if (target !== $('#target').editable('getText')) return;

        var sourcespans = $('#source > span');
        var targetspans = $('#target > span');
        
        var sourceal = new Array();
        sourceal.length = alignments.length;
        var targetal = new Array();
        targetal.length = alignments[0].length;
        for (var c = 0; c < alignments.length; ++c) {
          var alignment = alignments[c];          
          for (var v = 0; v < alignment.length; ++v) {
            if (!sourceal[c]) sourceal[c] = new Array();
            if (!targetal[v]) targetal[v] = new Array();

            if (alignment[v] > 0.5) {
              sourceal[c].push('#' + targetspans[v].id);
              targetal[v].push('#' + sourcespans[c].id);
            }
          }
        }

        for (var i = 0; i < sourcespans.length; i++) {
          $(sourcespans[i]).mouseenter(sourceal[i], function (e, data) {
            for (var j = 0; j < e.data.length; j++) {
              $(e.data[j]).toggleClass('align', true);
            }
          });
          $(sourcespans[i]).mouseout(sourceal[i], function (e, data) {
            for (var j = 0; j < e.data.length; j++) {
              $(e.data[j]).toggleClass('align', false);
            }
          });
        } 

        for (var i = 0; i < targetspans.length; i++) {
          $(targetspans[i]).mouseenter(targetal[i], function (e, data) {
            for (var j = 0; j < e.data.length; j++) {
              $(e.data[j]).toggleClass('align', true);
            }
          });
          $(targetspans[i]).mouseout(targetal[i], function (e, data) {
            for (var j = 0; j < e.data.length; j++) {
              $(e.data[j]).toggleClass('align', false);
            }
          });
        } 

        for (var c = 0; c < alignments.length; ++c) {
          var alignment = alignments[c];          
          for (var v = 0; v < alignment.length; ++v) {
            $("#demo-table tbody tr:eq("+c+") td:eq("+v+")")
              .css('background-color', grayColor(alignment[v]));
          }        
        }
      });

      casmacat.on('get_word_confidences_async', function(sent, confidences, source, source_seg, target, target_seg) {
        // make sure new data still applies to current text
        if (source !== $('#source').editable('getText')) return;
        if (target !== $('#target').editable('getText')) return;

        var spans = $('#target > span');
        //console.log(spans);
        for (var c = 0; c < confidences.length; ++c) {
          
          var conf = Math.round(confidences[c]*100)/100;
          var cssClass = "wordconf-" + (conf > 0.5 ? "ok" : "bad");
          var noCssClass = "wordconf-" + (conf <= 0.5 ? "ok" : "bad");

          $(spans[c]).addClass(cssClass);
          $(spans[c]).removeClass(noCssClass);
          $("#demo-table tfoot tr td:eq("+(c+1)+")").text(conf);
        }
      });

      $('#source').keydown(function(e) {
        if (e.which == 13) {
          casmacat.translate($(this).text());
          e.stopPropagation();
          e.preventDefault();
        }
      });
      $('#btn-translate').click(function() {
        casmacat.translate($('#source').text());
      });

      function update_caret_pos() {
        var pos = $("#target").editable('getCaretPos');
        var text = $("#target").editable('getElementAtCaretPos', pos)
          , elem = $(text).parent()
          , current = $("#target").data('currentElement');

        
        if (current !== elem) {
          if (current) {
            current.trigger('mouseout');
          }
          if (elem.is('span')) {
            elem.trigger('mouseenter');
            $("#target").data('currentElement', elem);
          }
          else {
            $("#target").data('currentElement', null);
          }
        }
        //console.log(pos);
        var text = $('#target').text();
        $('#caret').html('<span class="prefix">' + text.substr(0, pos) + '</span>' + '<span class="suffix">' + text.substr(pos) + "</span>");
      }

      $('#target').blur(function(e) {
        var current = $(this).data('currentElement');
        if (current) {
          current.trigger('mouseout');
          $(this).data('currentElement', null);
        }
      });

      var throttle = (function(){
        var timer = 0;
        return function(callback, ms){
          clearTimeout (timer);
          timer = setTimeout(callback, ms);
        };
      })();

      $('#target').keyup(function(e) {
        var $this = $(this),
            data = $this.data('editable'),
            str = $this.editable('getText');

        //console.log(e);
        update_caret_pos();

        //console.log(this);

        if (data['str'] != str) { 
          throttle(function () {
            casmacat_getTokens($('#source').text(), $('#target').text());
          }, 50);
        }
      });

      $('#target').keydown(function(e) {
        if (e.which == 13) {
          casmacat_getTokens($('#source').text(), $('#target').text());
          e.stopPropagation();
          e.preventDefault();
        }
      });

      $('#target').mouseup(function(e) {
        update_caret_pos();
      });

      function casmacat_getTokens(st, tt) {
        //console.log("getTokens", st, tt);
        casmacat.getTokens(st, tt);
      }

      $('#btn-set-translation').click(function() {
        casmacat_getTokens($('#source').text(), $('#target').text());
      });

      function grayColor(num) {
        var color = 255 - Math.floor(num * 255);
        return 'rgb('+color+','+color+','+color+')'; 
      };

      function updateTable(table, src, tgt) {
        //console.log(table);
        var src_tok = getTokens($('tbody tr', table).find('th.right:eq(0)'));
        var tgt_tok = getTokens($('thead th:gt(0)', table));

        var src_merge = merge_tokens(src_tok, src);
        var tgt_merge = merge_tokens(tgt_tok, tgt);

        //console.log("src", src);
        //console.log("tgt", tgt);
        //console.log("osrc", src_tok);
        //console.log("otgt", tgt_tok);
        //console.log("merge src", merge_tokens(src_tok, src));
        //console.log("merge tgt", merge_tokens(tgt_tok, tgt));

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

          if (merge_type == 'D') {
            merge_pos += nins - ndel ;
            $('thead tr th:eq(' + (merge_pos + 1) + '), tbody tr:last th:eq(' + (merge_pos + 1) + ')', table).remove();
            $('tbody tr', table).not(':last').each(function () { $('td:eq(' + merge_pos + ')', this).remove();});
            $('tfoot tr td:eq(' + (merge_pos + 1) + ')', table).remove();
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
              $('tfoot tr td:first', table).after('<td></td>');
            } else {
              $('thead tr th:eq(' + col + '), tbody tr:last th:eq(' + col + ')', table).each(function() {
                var th = $('<th class="vertical">' + tgt[col] + '</th>');
                $(this).after(th);
              });
              $('tbody tr', table).not(':last').each(function () { $('td:eq(' + (col - 1) + ')', this).after('<td>&nbsp;</td>');});
              $('tfoot tr td:eq(' + col + ')', table).after('<td></td>');
            }
            nins++;
          }
          
        }

        table.rotateCells();
      };
  
});
