document.addEventListener('click', function(event) {
  var anchor = event.target.closest('a[href^="#"]');
  if (anchor) {
    // Skip ref-links; they are replaced by inline expansions
    if (anchor.classList.contains('ref-link')) {
        event.preventDefault();
        return;
    }
    // Don't interfere with Bootstrap tabs or collapse toggles
    if (anchor.getAttribute('data-bs-toggle')) return;
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


// ═══════════════════════════════════════════════════════════
// Fix duplicate IDs produced by link_to_reused_ref
// ═══════════════════════════════════════════════════════════
//
// The schema doc generator reuses the same IDs when inlining
// a $ref definition at multiple schema paths. Duplicate IDs
// break Bootstrap tabs/collapses because getElementById
// always returns the first match. This pass finds duplicates
// and rewrites subsequent occurrences so every ID is unique.
// ═══════════════════════════════════════════════════════════

(function() {
    function fixDuplicateIds() {
        var seen = {};     // id -> true for first occurrence
        var dupCount = 0;

        // Pass 1: rename duplicate IDs. First occurrence keeps
        // its id; subsequent occurrences get a unique suffix.
        var allWithId = document.querySelectorAll('[id]');
        allWithId.forEach(function(el) {
            var id = el.id;
            if (!id) return;
            if (seen[id]) {
                dupCount++;
                el.setAttribute('data-orig-id', id);
                el.id = id + '__d' + dupCount;
            } else {
                seen[id] = true;
            }
        });

        if (dupCount === 0) return;

        // Build lookup: origId -> [el, el, ...] for fast scoping
        var renamed = {};
        document.querySelectorAll('[data-orig-id]').forEach(function(el) {
            var origId = el.getAttribute('data-orig-id');
            if (!renamed[origId]) renamed[origId] = [];
            renamed[origId].push(el);
        });

        // Build full candidate list: origId -> [el, ...] including
        // both the original (first-occurrence) element and all renamed
        // duplicates so that scoping works for every occurrence.
        var allTargets = {};
        Object.keys(renamed).forEach(function(origId) {
            var orig = document.getElementById(origId);
            allTargets[origId] = orig ? [orig].concat(renamed[origId]) : renamed[origId];
        });

        // Find the target element (original or renamed) that shares
        // the closest common ancestor with the referrer.
        function findLocalTarget(referrer, origId) {
            var candidates = allTargets[origId];
            if (!candidates) return origId;
            var scope = referrer.parentElement;
            while (scope) {
                for (var i = 0; i < candidates.length; i++) {
                    if (scope.contains(candidates[i])) return candidates[i].id;
                }
                scope = scope.parentElement;
            }
            return origId;
        }

        // Pass 2: fix references that point to renamed IDs.
        function fixHashAttr(el, attr) {
            var val = el.getAttribute(attr);
            if (!val || val.charAt(0) !== '#') return;
            var refId = val.substring(1);
            if (!renamed[refId]) return;
            var localId = findLocalTarget(el, refId);
            if (localId !== refId) el.setAttribute(attr, '#' + localId);
        }

        function fixPlainAttr(el, attr) {
            var val = el.getAttribute(attr);
            if (!val || !renamed[val]) return;
            var localId = findLocalTarget(el, val);
            if (localId !== val) el.setAttribute(attr, localId);
        }

        document.querySelectorAll('a[href^="#"]').forEach(function(el) {
            fixHashAttr(el, 'href');
        });
        document.querySelectorAll('[data-bs-target^="#"]').forEach(function(el) {
            fixHashAttr(el, 'data-bs-target');
        });
        document.querySelectorAll('[data-bs-parent^="#"]').forEach(function(el) {
            fixHashAttr(el, 'data-bs-parent');
        });
        document.querySelectorAll('[aria-controls]').forEach(function(el) {
            fixPlainAttr(el, 'aria-controls');
        });
        document.querySelectorAll('[aria-labelledby]').forEach(function(el) {
            fixPlainAttr(el, 'aria-labelledby');
        });
        document.querySelectorAll('[onclick]').forEach(function(el) {
            var onclick = el.getAttribute('onclick');
            if (!onclick) return;
            var changed = false;
            var updated = onclick.replace(
                /anchorLink\('([^']+)'\)/g,
                function(match, id) {
                    if (!renamed[id]) return match;
                    var localId = findLocalTarget(el, id);
                    if (localId !== id) { changed = true; return "anchorLink('" + localId + "')"; }
                    return match;
                }
            ).replace(
                /setAnchor\('#([^']+)'\)/g,
                function(match, id) {
                    if (!renamed[id]) return match;
                    var localId = findLocalTarget(el, id);
                    if (localId !== id) { changed = true; return "setAnchor('#" + localId + "')"; }
                    return match;
                }
            );
            if (changed) el.setAttribute('onclick', updated);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixDuplicateIds);
    } else {
        fixDuplicateIds();
    }
})();


// ═══════════════════════════════════════════════════════════
// Automatic inline expansion for reused definitions
// ═══════════════════════════════════════════════════════════
//
// When link_to_reused_ref is enabled, repeated definitions
// render as "Same definition as X" links pointing to the
// original. This enhancement hides those links and clones
// the original definition inline automatically when the
// parent property row is expanded. No user click required.
// The full HTML stays in the DOM for SEO crawlability.
// ═══════════════════════════════════════════════════════════

(function() {
    var expandCounter = 0;

    /**
     * Rewrite IDs inside a cloned subtree so they don't collide
     * with the originals. Also updates internal href="#...",
     * data-bs-target, data-bs-parent, and aria attributes.
     */
    function deduplicateIds(container, suffix) {
        var elements = container.querySelectorAll('[id]');
        var idMap = {};
        elements.forEach(function(el) {
            var oldId = el.id;
            var newId = oldId + suffix;
            idMap[oldId] = newId;
            el.id = newId;
        });

        container.querySelectorAll('[href]').forEach(function(el) {
            var href = el.getAttribute('href');
            if (href && href.charAt(0) === '#') {
                var refId = href.substring(1);
                if (idMap[refId]) {
                    el.setAttribute('href', '#' + idMap[refId]);
                }
            }
        });
        container.querySelectorAll('[data-bs-target]').forEach(function(el) {
            var val = el.getAttribute('data-bs-target');
            if (val && val.charAt(0) === '#') {
                var refId = val.substring(1);
                if (idMap[refId]) {
                    el.setAttribute('data-bs-target', '#' + idMap[refId]);
                }
            }
        });
        container.querySelectorAll('[data-bs-parent]').forEach(function(el) {
            var val = el.getAttribute('data-bs-parent');
            if (val && val.charAt(0) === '#') {
                var refId = val.substring(1);
                if (idMap[refId]) {
                    el.setAttribute('data-bs-parent', '#' + idMap[refId]);
                }
            }
        });
        container.querySelectorAll('[aria-controls]').forEach(function(el) {
            var val = el.getAttribute('aria-controls');
            if (val && idMap[val]) {
                el.setAttribute('aria-controls', idMap[val]);
            }
        });
        container.querySelectorAll('[aria-labelledby]').forEach(function(el) {
            var val = el.getAttribute('aria-labelledby');
            if (val && idMap[val]) {
                el.setAttribute('aria-labelledby', idMap[val]);
            }
        });

        container.querySelectorAll('[onclick]').forEach(function(el) {
            var onclick = el.getAttribute('onclick');
            if (onclick) {
                var updated = onclick.replace(
                    /anchorLink\('([^']+)'\)/g,
                    function(match, id) {
                        return idMap[id] ? "anchorLink('" + idMap[id] + "')" : match;
                    }
                ).replace(
                    /setAnchor\('#([^']+)'\)/g,
                    function(match, id) {
                        return idMap[id] ? "setAnchor('#" + idMap[id] + "')" : match;
                    }
                );
                el.setAttribute('onclick', updated);
            }
        });
    }

    /**
     * Check whether a node is "leading metadata" that already
     * appears in the ref-link's container: the type badge
     * (span.badge.value-type), a <br>, a description span,
     * or whitespace text nodes between them.
     */
    function isLeadingMeta(node) {
        if (node.nodeType === 3) {
            // Text node: skip if whitespace-only
            return node.textContent.trim() === '';
        }
        if (node.nodeType !== 1) return false;
        var el = node;
        // Type badge, e.g. <span class="badge ... value-type">
        if (el.tagName === 'SPAN' && el.classList.contains('value-type')) return true;
        // <br> element right after the type badge
        if (el.tagName === 'BR') return true;
        // Description span
        if (el.tagName === 'SPAN' && el.classList.contains('description')) return true;
        return false;
    }

    /**
     * Clone a source definition into the container that holds
     * the ref-link. The ref-link itself is hidden via CSS.
     * Leading type badge, <br>, and description are skipped
     * because the container already shows them.
     */
    function expandRefLink(link) {
        // Skip if already expanded
        if (link.getAttribute('data-ref-expanded') === 'true') return;
        link.setAttribute('data-ref-expanded', 'true');

        var targetId = link.getAttribute('href').substring(1);
        var source = document.getElementById(targetId);
        if (!source) return;

        expandCounter++;
        var suffix = '__exp' + expandCounter;

        var content = document.createElement('div');
        content.className = 'ref-expand-content';

        // Clone child nodes, skipping leading metadata that
        // duplicates what the container already displays.
        var nodes = source.childNodes;
        var pastLeading = false;
        for (var i = 0; i < nodes.length; i++) {
            if (!pastLeading && isLeadingMeta(nodes[i])) continue;
            pastLeading = true;
            content.appendChild(nodes[i].cloneNode(true));
        }

        deduplicateIds(content, suffix);

        // Insert the cloned content after the ref-link
        link.parentNode.insertBefore(content, link.nextSibling);
    }

    /**
     * Check whether a ref-link is directly visible within the
     * panel that was just shown. Returns false if the link sits
     * inside a nested collapse that is still hidden.
     */
    function isVisibleInPanel(link, panel) {
        var el = link.parentElement;
        while (el && el !== panel) {
            if (el.classList.contains('collapse') && !el.classList.contains('show')) {
                return false;
            }
            el = el.parentElement;
        }
        return true;
    }

    /**
     * When a collapse panel is shown, expand only the ref-links
     * that are directly visible (not buried in nested collapses).
     */
    function onCollapseShown(e) {
        var panel = e.target;
        var refLinks = panel.querySelectorAll('.ref-link');
        refLinks.forEach(function(link) {
            if (isVisibleInPanel(link, panel)) {
                expandRefLink(link);
            }
        });
    }

    /**
     * Initialize: hide ref-link text, listen for collapse events.
     */
    function initRefLinks() {
        var refLinks = document.querySelectorAll('.ref-link');
        refLinks.forEach(function(link) {
            // Remove the original onclick
            link.removeAttribute('onclick');

            // Expand ref-links that are already visible on load
            // (not inside any collapsed panel)
            var parentCollapse = link.closest('.collapse');
            if (!parentCollapse || parentCollapse.classList.contains('show')) {
                expandRefLink(link);
            }
        });

        // Listen for Bootstrap collapse show events
        document.addEventListener('shown.bs.collapse', onCollapseShown);
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRefLinks);
    } else {
        initRefLinks();
    }
})();
