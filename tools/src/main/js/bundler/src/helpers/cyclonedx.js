/**
 * CycloneDX specifics.
 */

const CDX_MODULE_NAME_RE = Object.freeze(/^cyclonedx-(.+)-\d\.\d.schema.json$/);


/**
 * Make a module name from a file name.
 * @param {string} s
 * @return {string}
 */
export function makeModuleName(s) {
    const match = s.match(CDX_MODULE_NAME_RE);
    if (match === null) { throw new Error(`Failed making module name from "${s}"`); }
    return match[1];
}
