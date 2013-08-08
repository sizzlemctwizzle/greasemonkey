window.addEventListener('load', function() {
  var args = window.arguments;
  if (!args) return;
  if (!(args[0] instanceof Ci.nsIDialogParamBlock)) return;
  args = args[0].GetString(1);
  if (!args) return;
  args = JSON.parse(args);
  if (!args.filename) return;
  if (!args.filename.match(/\.user\.js$/)) return;

  // If we're opening a user script:
  // Put the cursor at the top.  Workaround for #1708 ; remove when
  // http://bugzil.la/843597 is fixed.
  function moveCursorToTop() {
    // Retry via timeout until initialization is complete.
    if (!Scratchpad.initialized) {
      ScratchpadInitializedLoop++;
      if (ScratchpadInitializedLoop == 1)
        ScratchpadInitializedInterval = setInterval(moveCursorToTop, ScratchpadInitializedIntervalMs);
      if (ScratchpadInitializedLoop > ScratchpadInitializedLoopMax)
        clearInterval(ScratchpadInitializedInterval);
      return false;
    }
    else
      clearInterval(ScratchpadInitializedInterval);
    // Then move the cursor to the top.
    Scratchpad.selectRange(0, 0);
    return true;
  }
  var ScratchpadInitializedLoop = 0;
  var ScratchpadInitializedLoopMax = 10;
  var ScratchpadInitializedInterval = null;
  var ScratchpadInitializedIntervalMs = 20;
  moveCursorToTop();

  // Hide the menus which don't make sense when editing a script.  See #1771.
  var executeMenu = document.getElementById('sp-execute-menu');
  if (executeMenu) executeMenu.collapsed = true;
  var environmentMenu = document.getElementById('sp-environment-menu');
  if (environmentMenu) environmentMenu.collapsed = true;
  var textPopupFunction = function(e) {
    var textRunId = 'sp-text-run';
    var textInspectId = 'sp-text-inspect';
    var textDisplayId = 'sp-text-display';
    for (var i = 0, childNodesCount = textPopup.childNodes.length; i < childNodesCount; i++) {
      if (textPopup.childNodes[i].id.toLowerCase() == textRunId.toLowerCase()) {
        if (textPopup.childNodes[i - 1] && (textPopup.childNodes[i - 1].nodeName.toLowerCase() == 'menuseparator'))
          textPopup.childNodes[i - 1].parentNode.removeChild(textPopup.childNodes[i - 1]);
        break;
      }
    }
    var textRun = document.getElementById(textRunId);
    if (textRun) textRun.parentNode.removeChild(textRun);
    var textInspect = document.getElementById(textInspectId);
    if (textInspect) textInspect.parentNode.removeChild(textInspect);
    var textDisplay = document.getElementById(textDisplayId);
    if (textDisplay) textDisplay.parentNode.removeChild(textDisplay);
  }
  var textPopup = document.getElementById('scratchpad-text-popup');
  if (textPopup) {
    document.addEventListener('contextmenu', textPopupFunction, false);
    textPopup.addEventListener('popupshowing', textPopupFunction, false);
  }
  var toolbar = document.getElementById('sp-toolbar');
  if (toolbar) {
    var toolbarRunId = 'sp-toolbar-run';
    var toolbarInspectId = 'sp-toolbar-inspect';
    var toolbarDisplayId = 'sp-toolbar-display';
    var toolbarRun = document.getElementById(toolbarRunId);
    var toolbarInspect = document.getElementById(toolbarInspectId);
    var toolbarDisplay = document.getElementById(toolbarDisplayId);
    for (var i = 0, childNodesCount = toolbar.childNodes.length; i < childNodesCount; i++) {
      if (toolbar.childNodes[i].id.toLowerCase() == toolbarRunId.toLowerCase()) {
        if (toolbar.childNodes[i - 1] && (toolbar.childNodes[i - 1].nodeName.toLowerCase() == 'toolbarspacer'))
          toolbar.childNodes[i - 1].parentNode.removeChild(toolbar.childNodes[i - 1]);
        break;
      }
    }
    if (toolbarRun) toolbarRun.parentNode.removeChild(toolbarRun);
    if (toolbarInspect) toolbarInspect.parentNode.removeChild(toolbarInspect);
    if (toolbarDisplay) toolbarDisplay.parentNode.removeChild(toolbarDisplay);
  }
  // Disable access keys
  var keyRun = document.getElementById('sp-key-run');
  if (keyRun) keyRun.setAttribute('disabled', true);
  var keyInspect = document.getElementById('sp-key-inspect');
  if (keyInspect) keyInspect.setAttribute('disabled', true);
  var keyDisplay = document.getElementById('sp-key-display');
  if (keyDisplay) keyDisplay.setAttribute('disabled', true);
}, true);