if (typeof window.console === "undefined") {
  window.console = {};
  console.log = console.info = console.error = function(){};
}
