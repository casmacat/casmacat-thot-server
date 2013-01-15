// Dependencies: jquery.mousewheel plugin

(function(window){

  function mwObject(elem, options) {
    
    // Private -----------------------------------------------------------------
    var stack = [], pos = 0;
    
    function saveState(obj) {
      stack.push(obj);
      //pos = stack.length - 1;
    };
    
    function updatePos() {
      if (pos > stack.length) {
        pos = stack.length;
      }
      if (pos < 0) {
        pos = 0;
      }
    };
    
    function resetState() {
      stack = [];
      pos   = 0;
    };
    
    function onMoveUp(e) {
      pos++;
      updatePos();
      console.log( "onMoveUp", pos, stack.length );
      //if (pos < stack.length)
        self.change(stack[pos - 1]);
    };
    
    function onMoveDown(e) {
      pos--;
      updatePos();
      console.log( "onMoveUp", pos, stack.length );
      //if (pos < stack.length)
        self.change(stack[pos - 1]);
    };
    

    var self = this;

    // Listeners ---------------------------------------------------------------
    self.change = function(data) {
    };
    
    // Public API --------------------------------------------------------------
    self.addElement = function(elem) {
      saveState(elem);
      console.log("addElement", stack.length, pos);
    };
    
    self.invalidate = function() {
      resetState();
    };
    
    // Mandatory intialization method ------------------------------------------
    self.init = function(elem, options) {
      $(elem).mousewheel(function(e,delta){
        if (delta > 0) onMoveUp(e);
        else if (delta < 0) onMoveDown(e);
        // block scroll over element
        return false;
      });
      // Attach listeners
      for (var opt in options) {
        if (options.hasOwnProperty(opt) && typeof options[opt] !== 'undefined') {
          self[opt] = options[opt];
        }
      }
    }
        
  };
  
  // Expose module
  window.MW = mwObject;
  
})(this);
