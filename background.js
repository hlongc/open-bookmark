chrome.commands.onCommand.addListener(function(command) {
    if (command === "open_popup") {
      chrome.action.openPopup();
    }
  });