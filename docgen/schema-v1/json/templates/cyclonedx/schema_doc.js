document.addEventListener('click', function(event) {
  var anchor = event.target.closest('a[href^="#"]');
  if (anchor) {
    event.preventDefault();
    history.pushState({}, '', anchor.href);
  }
});

function flashElement(elementId) {
    var myElement = document.getElementById(elementId);
    if (myElement) {
        myElement.classList.add("jsfh-animated-property");
        setTimeout(function() {
            myElement.classList.remove("jsfh-animated-property");
        }, 1000);
    }
}

function setAnchor(anchorLinkDestination) {
    // Set anchor link without reloading
    history.pushState({}, '', anchorLinkDestination);
}

function anchorOnLoad() {
    // Added to onload on body, checks if there is an anchor link and if so, expand
    var linkTarget = decodeURIComponent(window.location.hash.split("?")[0].split("&")[0]);
    if (linkTarget[0] === "#") {
        linkTarget = linkTarget.substr(1);
    }

    if (linkTarget.length > 0) {
        anchorLink(linkTarget);
    }
}

function anchorLink(linkTarget) {
    var target = document.getElementById(linkTarget);
    if (!target) return;

    // Find the targeted element and all its parents that can be expanded
    var element = target;
    while (element) {
        // Expand collapsed sections
        if (element.classList.contains("collapse") && !element.classList.contains("show")) {
            var bsCollapse = new bootstrap.Collapse(element, { toggle: true });
        }
        // Activate tab panes
        if (element.classList.contains("tab-pane")) {
            var tabTrigger = document.querySelector('a[href="#' + element.id + '"]');
            if (tabTrigger) {
                var bsTab = new bootstrap.Tab(tabTrigger);
                bsTab.show();
            }
        }
        // Handle direct tab links
        if (element.getAttribute("role") === "tab") {
            var bsTab = new bootstrap.Tab(element);
            bsTab.show();
        }
        element = element.parentElement;
    }

    // Wait a little so the user has time to see the page scroll
    setTimeout(function() {
        var targetElement = document.getElementById(linkTarget);
        if (targetElement) {
            targetElement.scrollIntoView({ block: "center", behavior:"smooth" });
            // Flash the element so that the user notices where the link points to
            setTimeout(function() {
                flashElement(linkTarget);
            }, 500);
        }
    }, 1000);
}