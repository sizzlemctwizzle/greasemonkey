// Globals.
var GM_config = GM_getConfig();

var GM_stringBundle = Components
    .classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle("chrome://greasemonkey/locale/gm-manage.properties");
function GM_string(key) { return GM_stringBundle.GetStringFromName(key); }

(function() {
// Override some built-in functions, with a closure reference to the original
// function, to either handle or delegate the call.
var _origShowView = showView;
showView = function(aView) {
  if ('userscripts' == aView) {
    greasemonkeyAddons.showView();
  } else {
    _origShowView(aView);
  }
};

var _origBuildContextMenu = buildContextMenu;
buildContextMenu = function(aEvent) {
  if ('userscripts' == gView) {
    greasemonkeyAddons.buildContextMenu(aEvent);
  } else {
    _origBuildContextMenu(aEvent);
  }
};

// Set up an "observer" on the config, to keep the displayed items up to date
// with their actual state.
var config = GM_config;
window.addEventListener("load", function() {
  config.addObserver(observer);
}, false);
window.addEventListener("unload", function() {
  config.removeObserver(observer);
}, false);

var observer = {
  notifyEvent: function(script, event, data) {
    // if the currently open tab is not the userscripts tab, then ignore event.
    if (gView != 'userscripts') return;

    if (event == "install") {
      var item = greasemonkeyAddons.addScriptToList(script);
      gExtensionsView.selectedItem = item;
      return;
    }

    // find the script's node in the listbox
    var listbox = gExtensionsView;
    var node;
    for (var i = 0; node = listbox.childNodes[i]; i++) {
      if (node.getAttribute('addonId') == script.id) {
        break;
      }
    }
    if (!node) return;

    switch (event) {
      case "edit-enabled":
        node.setAttribute('isDisabled', !data);
        break;
      case "uninstall":
        listbox.removeChild(node);
        if (greasemonkeyAddons.lastSelected) {
          var item = greasemonkeyAddons.lastSelected.item;
          if (item.getAttribute('addonId') == script.namespace + script.name) {
            greasemonkeyAddons.lastSelected = null;
          }
        }
        break;
      case "move":
        listbox.removeChild(node);
        listbox.insertBefore(node, listbox.childNodes[data]);
        break;
      case "modified":
        var item = greasemonkeyAddons.listitemForScript(script);
        gExtensionsView.replaceChild(item, node);
        break;
    }
  }
};
})();

// Set event listeners.
window.addEventListener('load', function() {
  greasemonkeyAddons.onAddonSelect();
  gExtensionsView.addEventListener(
      'select', greasemonkeyAddons.onAddonSelect, false);

  // Work-around for Stylish compatibility, which does not update gView in
  // its overridden showView() function.
  var stylishRadio = document.getElementById('userstyles-view');
  if (stylishRadio) {
    stylishRadio.addEventListener(
        'command',
        function() { gView = 'userstyles' },
        false);
  }
}, false);

// Uninstall scripts that have been selected when the window closes
window.addEventListener('unload', function() {
    var scripts = GM_config._scripts;
    for (var i = scripts.length - 1, script; script = scripts[i]; i--) {
      if (script._uninstallReady) {
        GM_config.uninstall(script); 
      }
    }
}, false);

var greasemonkeyAddons = {
  uninstallMsg: "This user script will be removed when the Add-on manager window is closed.",
  lastSelected: null,

  showView: function() {
    if ('userscripts' == gView) return;
    updateLastSelected('userscripts');
    gView='userscripts';

    // Update any possibly modified scripts.
    GM_config.updateModifiedScripts();

    // Hide the native controls that don't work in the user scripts view.
    function $(id) { return document.getElementById(id); }
    function hide(el) { el=$(el); el && (el.hidden=true); }
    var elementIds=[
      'searchPanel', 'installFileButton', 'checkUpdatesAllButton',
      'skipDialogButton', 'themePreviewArea', 'themeSplitter',
      'showUpdateInfoButton', 'hideUpdateInfoButton',
      'installUpdatesAllButton',
      // Stylish injects these elements.
      'copy-style-info', 'new-style'];
    elementIds.forEach(hide);

    var getMore = document.getElementById('getMore');
    getMore.setAttribute('getMoreURL', 'http://userscripts.org/');
    getMore.hidden = false;
    getMore.value = 'Get User Scripts';

    greasemonkeyAddons.fillList();
    gExtensionsView.selectedItem = gExtensionsView.children[0];
    // The setTimeout() here is for timing, to make sure the selection above
    // has really happened.
    setTimeout(greasemonkeyAddons.onAddonSelect, 0);
  },

  fillList: function() {
    var config = GM_config;
    var listbox = gExtensionsView;

    // Remove any pre-existing contents.
    while (listbox.firstChild) {
      listbox.removeChild(listbox.firstChild);
    }

    // Add a list item for each script.
    for (var i = 0, script = null; script = config.scripts[i]; i++) {
      greasemonkeyAddons.addScriptToList(script);
    }
  },

  listitemForScript: function(script) {
    var item = document.createElement('richlistitem');
    item.setAttribute('class', 'userscript');
    // Fake this for now.
    // Setting these attributes inherits the values into the same place they
    // would go for extensions.
    item.setAttribute('addonId', script.id);
    item.setAttribute('name', script.name);
    if (script._uninstallReady) {
      item.setAttribute('description', greasemonkeyAddons.uninstallMsg);
    } else {
      item.setAttribute('description', script.description);
    }
    item.setAttribute('version', script.version);
    item.setAttribute('id', 'urn:greasemonkey:item:'+script.id);
    item.setAttribute('isDisabled', !script.enabled);
    // These hide extension-specific bits we don't want to display.
    item.setAttribute('blocklisted', 'false');
    item.setAttribute('blocklistedsoft', 'false');
    item.setAttribute('compatible', 'true');
    item.setAttribute('locked', 'false');
    item.setAttribute('providesUpdatesSecurely', 'true');
    item.setAttribute('satisfiesDependencies', 'true');
    item.setAttribute('type', nsIUpdateItem.TYPE_EXTENSION);
    return item;
  },

  addScriptToList: function(script, beforeNode) {
    var item = greasemonkeyAddons.listitemForScript(script);
    gExtensionsView.insertBefore(item, beforeNode || null);
    return item;
  },

  findSelectedScript: function() {
    if (!gExtensionsView.selectedItem) return null;
    var scripts = GM_config.scripts;
    var selectedScriptId = gExtensionsView.selectedItem.getAttribute('addonId');
    for (var i = 0, script = null; script = scripts[i]; i++) {
      if (selectedScriptId == script.id) {
        return script;
      }
    }
    return null;
  },

  onAddonSelect: function(aEvent) {
    // We do all this work here, because the elements we want to change do
    // not exist until the item is selected.

    if (!gExtensionsView.selectedItem) return;
    if ('userscripts' != gView) return;
    var lastSelected = greasemonkeyAddons.lastSelected;
    var script = greasemonkeyAddons.findSelectedScript();

    // Remove/change the anonymous nodes we don't want.
    var item = gExtensionsView.selectedItem;
    var button;

    if (lastSelected) {
      // reset description
      if (lastSelected.script._uninstallReady) {
        lastSelected.item.setAttribute('description', greasemonkeyAddons.uninstallMsg);
      }
    }
    greasemonkeyAddons.lastSelected = {
      script: script,
      item: item
    };

    // set this description
    item.setAttribute('description', script.description);

    // Replace 'preferences' with 'edit'.
    button = item.ownerDocument.getAnonymousElementByAttribute(
        item, 'command', 'cmd_options');
    if (!button) return;
    button.setAttribute('label', GM_string('Edit'));
    button.setAttribute('accesskey', GM_string('Edit.accesskey'));
    button.setAttribute('tooltiptext', GM_string('Edit.tooltip'));
    button.setAttribute('command', 'cmd_userscript_edit');
    button.setAttribute('disabled', false);
    if (script._uninstallReady) button.style.display = "none";

    // Rewire enable, disable, uninstall, cancelUninstall.
    button = item.ownerDocument.getAnonymousElementByAttribute(
        item, 'command', 'cmd_enable');
    if (!button) return;
    button.setAttribute('tooltiptext', GM_string('Enable.tooltip'));
    button.setAttribute('command', 'cmd_userscript_enable');
    button.setAttribute('disabled', false);
    if (script._uninstallReady) button.style.display = "none";

    button = item.ownerDocument.getAnonymousElementByAttribute(
        item, 'command', 'cmd_disable');
    if (!button) return;
    button.setAttribute('tooltiptext', GM_string('Disable.tooltip'));
    button.setAttribute('command', 'cmd_userscript_disable');
    button.setAttribute('disabled', false);
    if (script._uninstallReady) button.style.display = "none";

    button = item.ownerDocument.getAnonymousElementByAttribute(
        item, 'command', 'cmd_uninstall');
    if (!button) return;
    button.setAttribute('tooltiptext', GM_string('Uninstall.tooltip'));
    button.setAttribute('command', 'cmd_userscript_uninstall');
    button.setAttribute('disabled', 'false');
    button.setAttribute('class', 'uninstallButton');
    if (script._uninstallReady)
      button.style.display = "none";
    else
      button.style.display = "inline";

    button = item.ownerDocument.getAnonymousElementByAttribute(
        item, 'command', 'cmd_cancelUninstall');
    if (button) {
      button.setAttribute('tooltiptext', 'Cancel Uninstall of the selected User Script');
      button.setAttribute('command', 'cmd_userscript_cancelUninstall');
      button.setAttribute('disabled', 'false');
      button.removeAttribute('hidden');
      button.setAttribute('class', 'cancelUninstallButton');
      button.hidden = !script._uninstallReady;
      if (!script._uninstallReady)
        button.style.display = "none";
      else
        button.style.display = "inline";
    }
  },

  doCommand: function(command) {
    var script = greasemonkeyAddons.findSelectedScript();
    if (!script) {
      dump("greasemonkeyAddons.doCommand() could not find selected script.\n");
      return;
    }


    var selectedListitem = gExtensionsView.selectedItem;
    function cmdGet(command) {
      var cmd = selectedListitem.ownerDocument.getAnonymousElementByAttribute(
        selectedListitem, 'command', command);
      return cmd;
    }

    function cmdsShow(commands) {
      commands.forEach(function(command) {
        cmdGet(command).style.display = "inline";
      });
    }
    function cmdsRemoveStyle(commands) {
      commands.forEach(function(command) {
        cmdGet(command).removeAttribute("style");
      });
    }

    function cmdsHide(commands) {
      commands.forEach(function(command) {
        cmdGet(command).style.display = "none";
      });
    }

    switch (command) {
    case 'cmd_userscript_edit':
      GM_openInEditor(script);
      break;
    case 'cmd_userscript_enable':
      script.enabled = true;
      break;
    case 'cmd_userscript_disable':
      script.enabled = false;
      break;
    case 'cmd_userscript_move_down':
      GM_config.move(script, 1);
      break;
    case 'cmd_userscript_move_bottom':
      GM_config.move(script, GM_config.scripts.length);
      break;
    case 'cmd_userscript_move_up':
      GM_config.move(script, -1);
      break;
    case 'cmd_userscript_move_top':
      GM_config.move(script, -1 * GM_config.scripts.length);
      break;
    case 'cmd_userscript_sort':
      function scriptCmp(a, b) { return a.name < b.name ? -1 : 1; }
      GM_config._scripts.sort(scriptCmp);
      GM_config._save();
      greasemonkeyAddons.fillList();
      break;
    case 'cmd_userscript_uninstall':
      script._uninstallReady = true;

      // Toggle buttons
      cmdsHide(['cmd_userscript_uninstall', 'cmd_userscript_edit', 'cmd_userscript_disable', 'cmd_userscript_enable']);
      cmdsShow(['cmd_userscript_cancelUninstall']);
      break;
    case 'cmd_userscript_confirmUninstall':
      GM_config.uninstall(script); 
      break;
    case 'cmd_userscript_cancelUninstall':
      script._uninstallReady = false;

      selectedListitem.setAttribute('description', script.description);

      // Toggle buttons
      cmdsHide(['cmd_userscript_cancelUninstall']);
      cmdsRemoveStyle(['cmd_userscript_edit', 'cmd_userscript_disable', 'cmd_userscript_enable']);
      cmdsShow(['cmd_userscript_uninstall']);
    }
  },

  buildContextMenu: function(aEvent) {
    var script = greasemonkeyAddons.findSelectedScript();
    if (!script) {
      dump("greasemonkeyAddons.buildContextMenu() could not find selected script.\n");
      return;
    }

    var popup = document.getElementById('addonContextMenu');
    while (popup.hasChildNodes()) {
      popup.removeChild(popup.firstChild);
    }

    function forceDisabled(aEvent) {
      if ('disabled' != aEvent.attrName) return;
      if ('true' == aEvent.newValue) return;
      aEvent.target.setAttribute('disabled', 'true');
    }
    function addMenuItem(label, command, enabled) {
      var menuitem = document.createElement('menuitem');
      menuitem.setAttribute('label', GM_string(label));
      menuitem.setAttribute('accesskey', GM_string(label+'.accesskey'));
      menuitem.setAttribute('command', command);

      if ('undefined' == typeof enabled) enabled = true;
      if (!enabled) {
        menuitem.setAttribute('disabled', 'true');
        // Something is un-setting the disabled attribute.  Work around that,
        // this way for now.
        menuitem.addEventListener('DOMAttrModified', forceDisabled, true);
      }

      popup.appendChild(menuitem);
    }
    function addMenuSeparator(label, command) {
      popup.appendChild(document.createElement('menuseparator'));
    }

    if (!script._uninstallReady) {
      addMenuItem('Edit', 'cmd_userscript_edit');
      if (script.enabled) {
        addMenuItem('Disable', 'cmd_userscript_disable');
      } else {
        addMenuItem('Enable', 'cmd_userscript_enable');
      }
      addMenuItem('Uninstall', 'cmd_userscript_uninstall');

      addMenuSeparator();

      addMenuItem('Move Up', 'cmd_userscript_move_up');
      addMenuItem('Move Down', 'cmd_userscript_move_down');
      addMenuItem('Move To Top', 'cmd_userscript_move_top');
      addMenuItem('Move To Bottom', 'cmd_userscript_move_bottom');
    } else {
      addMenuItem('Cancel Uninstall', 'cmd_userscript_cancelUninstall');
      addMenuSeparator();
      addMenuItem('Confirm Uninstall', 'cmd_userscript_confirmUninstall');
    }

    addMenuSeparator();

    addMenuItem('Sort Scripts', 'cmd_userscript_sort',
        gExtensionsView.itemCount > 1);
  }
};
