  function getTokens(elems) {
    var tokens = new Array();
    for (var i = 0; i < elems.length; i++) {
      tokens.push($(elems[i]).text());
    }
    return tokens;
  }

  function tokenize_by_segments(str, segs) {
    var tokens = [];
    for (var tok_id = 0; tok_id < segs.length; tok_id++) {
      var pos = segs[tok_id];
      var tok = str.slice(pos[0], pos[1]);
      tokens.push(tok);
    }
    return tokens;
  };

  function edit_distance(s1, s2) {
    if (s1 == s2) return 0;

    var s1_len = s1.length, 
        s2_len = s2.length;
    if (s1_len === 0) return s2_len;
    if (s2_len === 0) return s1_len;

    var v0 = new Array(s1_len+1);
    var v1 = new Array(s1_len+1);

    var cost=0;
    for (var s1_idx = 0; s1_idx < s1_len + 1; s1_idx++) {
        v0[s1_idx] = s1_idx;
    }
    for (var s2_idx = 1; s2_idx <= s2_len; s2_idx++) {
        v1[0] = s2_idx;
        var char_s2 = s2[s2_idx - 1];

        for (var s1_idx = 0; s1_idx < s1_len; s1_idx++) {
            var char_s1 = s1[s1_idx];
            cost = (char_s1 == char_s2) ? 0 : 1;
            var m_min = v0[s1_idx+1] + 1;
            var b = v1[s1_idx] + 1;
            var c = v0[s1_idx] + cost;
            if (b < m_min) m_min = b; 
            if (c < m_min) m_min = c; 
            v1[s1_idx+1] = m_min;
        }
        var v_tmp = v0;
        v0 = v1;
        v1 = v_tmp;
    }
    return v0[s1_len]/Math.max(s1_len, s2_len);
  };

  function merge_tokens(spans, tokens) {
    var l1 = (spans)?spans.length:0, l2 = (tokens)?tokens.length:0;

    if (spans === tokens) {
      var path = new Array();
      for (var i = 0; i < l2; i++) path.push([i, i, 'N']);
      return path; 
    }

    if (l2 === 0){
      var path = new Array();
      for (var i = 0; i < l1; i++) path.push([i, -1, 'D']);
      return path; 
    }
 
    if (l1 === 0) {
      var path = new Array();
      for (var i = 0; i < l2; i++) path.push([-1, i, 'I']);
      return path; 
    }

    var i = 0, j = 0, d = [], b = [];
    for (i = 0 ; i <= l1 ; i++) {
        d[i] = [];
        d[i][0] = i;
        b[i] = [];
        b[i][0] = 'D';
    }
    for (j = 0 ; j <= l2 ; j++) {
        d[0][j] = j;
        b[0][j] = 'I';
    }
    for (i = 1 ; i <= l1 ; i++) {
        for (j = 1 ; j <= l2 ; j++) {
            var dist = (spans[i-1] === tokens[j-1])?0:1;
            if (dist > 0) {
              dist += edit_distance(spans[i-1], tokens[j-1]);
            }

            d[i][j] = d[i - 1][j - 1] + dist;
            b[i][j] = ((dist > .0)?'S':'N');

            var ins = d[i][j - 1] + 1;
            if (ins < d[i][j]) {
              d[i][j] = ins;
              b[i][j] = 'I';
            }

            var del = d[i - 1][j] + 1;
            if (del < d[i][j]) { /* deletion */
              d[i][j] = del;
              b[i][j] = 'D';
            }
        }
    }
    delete b[0][0];

    var op = b[l1][l2];
    var path = new Array();
    while (op) {
      path.push([((op == 'I')?-1:l1-1), ((op == 'D')?-1:l2-1), op]);
      if      (op == 'S' || op == 'N') op = b[--l1][--l2];
      else if (op == 'D') op = b[--l1][  l2];
      else if (op == 'I') op = b[  l1][--l2];
    }
    return path.reverse();
  };




(function($) {

  var methods = {
    init: function(options) {
      return this.each(function() {
        
        var $this = $(this),
            data = $this.data('editable');
        
        $this.attr('contenteditable', true);
        // If the plugin hasn't been initialized yet
        if (!data) {
          $(this).data('editable', {ntok: 0});
        }

      });
    },

    destroy: function() {
      return this.each(function() {

        var $this = $(this),
            data = $this.data('editable');

        // Namespacing FTW
        $(window).unbind('.editable');
        data.editable.remove();
        $this.removeData('editable');
      })
    },

    getCaretPos: function() { 
      var $this = $(this),
          data = $this.data('editable'),
          node = $this.get(0);

      var caretOffset = 0;
      try {
        if (typeof window.getSelection != "undefined") {
          var range = window.getSelection().getRangeAt(0);
          var preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(node);
          preCaretRange.setEnd(range.endContainer, range.endOffset);
          caretOffset = preCaretRange.toString().length;
        } else if (typeof document.selection != "undefined" && document.selection.type != "Control") {
          var textRange = document.selection.createRange();
          var preCaretTextRange = document.body.createTextRange();
          preCaretTextRange.moveToElementText(node);
          preCaretTextRange.setEndPoint("EndToEnd", textRange);
          caretOffset = preCaretTextRange.text.length;
        }
      }
      catch (err) {}
      return caretOffset;
    },

    getElementAtCaretPos: function(pos) {
      var $this = $(this),
          data = $this.data('editable'),
          node = $this.get(0),
          w;

      var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false)

      while (walker.nextNode()) {
        w = walker.currentNode;
        if ((pos - w.length) > 0) pos -= w.length;
        else break;
      }

      return w;
    },

    setCaretPos: function(pos) {
      var $this = $(this),
          data = $this.data('editable'),
          node = $this.get(0),
          w;

      var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false)

      while (walker.nextNode()) {
        w = walker.currentNode;
        if ((pos - w.length) > 0) pos -= w.length;
        else break;
      }

      var range = document.createRange();
      range.setStart(w, pos);
      range.collapse(true);

      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    },

    getText: function() {
      return $(this).text();
    },

    setText: function(str, segs) {
      var $this = $(this),
          data = $this.data('editable');

      //XXX: can we assume this?
      //console.log('tokens gotten "' + data['str'] + '" === "' + str + '"');
      if (data['str'] === str) return;
      data['str'] = str;

      if (segs && segs.length > 0) {

        var spans = $.makeArray($('span', $this));
        var old_tokens = new Array();
        for (var i = 0; i < spans.length; i++) {
          spans[i] = $(spans[i]);
          old_tokens.push(spans[i].text());
        }

        // get old tokens from data and new tokens
        var new_tokens = tokenize_by_segments(str, segs);
        // diff both tokens to keep unchanged spans
        var merge = merge_tokens(old_tokens, new_tokens);

        //console.log("old tokens:", old_tokens);
        //console.log("new tokens:", new_tokens);
        //console.log(merge);

        var tokens = $this.clone(); 
        var id = $this.attr('id');

        tokens.empty();
        // add initial spaces
        if (segs[0][0] > 0) {
          var spaces = str.slice(0, segs[0][0]);
          tokens.append(document.createTextNode(spaces));
        }

        // add rest of tokens
        for (var mi = 0; mi < merge.length; mi++) {
          var merge_pos = merge[mi][0], 
              tok_id = merge[mi][1],
              merge_type = merge[mi][2];

          if (tok_id < 0) continue;
          var pos = segs[tok_id];

          // get next token
          var span, txt = str.slice(pos[0], pos[1]);
          // if the action is none or substitution then leave the node as is 
          if (merge_pos >= 0) {
            span = spans[merge_pos].clone(true); 
          }
          // else create a new node 
          else { 
            span = $('<span/>');
          }

          // if the text changed (not action none) 
          if (merge_type != 'N') { 
            // set the new token id and change the text
            span.attr('id', id + '_' + (data.ntok++)); 
          }

          span.text(txt);
          span.data('tok', tok_id); 
          tokens.append(span);

          // add space token
          var spaces = '';
          if (tok_id < segs.length - 1) {
            spaces = str.slice(pos[1], segs[tok_id + 1][0]);
          }
          else {
            spaces = str.slice(pos[1]);
          }
          //if (spaces.length > 0) {
            tokens.append(document.createTextNode(spaces));
          //}
        }

        if ($this.is(':focus')) {
          var pos = $this.editable('getCaretPos');
          //console.log(pos, $this.html());
          $this.html(tokens.html()); 
          $this.editable('setCaretPos', pos);
          //console.log(pos, $this.html());
        }
        else {
          $this.html(tokens.html()); 
        }
      }
      else { // not tokenization
        $this.text(str); 
      }
    },

  };



  $.fn.editable = function(method) {
    if (methods[method]) {
      return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
    } else if (typeof method === 'object' || ! method) {
      return methods.init.apply(this, arguments);
    } else {
      $.error('Method ' +  method + ' does not exist on jQuery.editable');
    }    
  };

})(jQuery);

$(function() {
  $('.editable').editable();
});
